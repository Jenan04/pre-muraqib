import path from "node:path";
import type { ProjectContext } from "../context/project-context.js";
import { FindingCollector } from "../findings/finding-collector.js";
import type { Finding } from "../findings/finding.js";
import { parseEnvFile } from "../parsers/env-parser.js";
import { createEnv } from "../../guard/env-validator.js";
import { EnvValidationError } from "../../guard/errors/env-validation-error.js";
import { OsvScanner } from "../../scanners/dependency/osv-engine.js";
import { CompatibilityEngine } from "../../scanners/compatibility/compatibility-engine.js";
import { analyzeUnknownVariablesWithAi } from "../../ai/fallback.js";
import { generateAdvisory } from "../../ai/advisor.js";
import type { ValidationEngineName } from "../../guard/core/engine-detector.js";

export interface AuditOptions {
  mode?: "build" | "prod" | undefined;
  engine?: ValidationEngineName | undefined;
  enableAi?: boolean | undefined;
}

export interface AuditReport {
  findings: Finding[];
  totalParsedLines: number;
  engine: string;
  scannedEnvFiles: string[];
  cleanEnv: Record<string, string>;
  aiAdvisory: string | null;
  hasBlockingIssues: boolean;
  exitCode: number;
}

export class AuditRunner {
  async run(context: ProjectContext, options: AuditOptions = {}): Promise<AuditReport> {
    const collector = new FindingCollector();
    const envMetaDataRegistry: Record<string, { fileName: string; line: number }> = {};
    let accumulatedCleanEnv: Record<string, string> = {};
    let totalParsedLines = 0;

    // 1. Parse .env files
    for (const file of context.envFiles) {
      const fullPath = path.join(context.projectPath, file);
      try {
        const result = parseEnvFile(fullPath);
        totalParsedLines += result.parsedLines.length;

        accumulatedCleanEnv = { ...accumulatedCleanEnv, ...result.parsedData };

        result.parsedLines.forEach((p) => {
          envMetaDataRegistry[p.key] = { fileName: file, line: p.line };
        });

        collector.addMany(result.findings);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to read environment file ${file}: ${msg}`);
      }
    }

    // 2. Semantic validation
    let activeEngineName: string = options.engine ?? "custom";
    let unknownKeys: string[] = [];

    if (Object.keys(accumulatedCleanEnv).length > 0) {
      try {
        const guardResult = await createEnv({
          runtimeEnvStrict: accumulatedCleanEnv,
          emptyStringAsUndefined: true,
          engine: options.engine,
          projectRoot: context.projectPath,
        });

        activeEngineName = guardResult.engine;
        unknownKeys = guardResult.unknownKeys;
      } catch (err: unknown) {
        if (err instanceof EnvValidationError) {
          activeEngineName = err.engine;
          unknownKeys = err.unknownKeys;

          for (const valErr of err.errors) {
            const field = valErr.path[0] ?? "UNKNOWN";
            const meta = envMetaDataRegistry[field] ?? { fileName: ".env", line: 0 };

            collector.add({
              id: `preset-violation-${field}`,
              title: `Preset Violation: ${field}`,
              message: valErr.message,
              severity: "high",
              category: "validation",
              source: `preset-guard (${err.engine})`,
              file: meta.fileName,
              line: meta.line,
              key: field,
            });
          }
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Environment validation execution failed: ${msg}`);
        }
      }
    }

    // 3. AI Unknown Variables Fallback (if enabled and key present)
    const canUseAi = options.enableAi !== false && Boolean(process.env.GEMINI_API_KEY);
    if (unknownKeys.length > 0 && canUseAi) {
      const aiErrors = await analyzeUnknownVariablesWithAi(unknownKeys, accumulatedCleanEnv);
      for (const err of aiErrors) {
        const field = err.path[0] ?? "UNKNOWN";
        const meta = envMetaDataRegistry[field] ?? { fileName: ".env", line: 0 };
        collector.add({
          id: `ai-finding-${field}`,
          title: `AI Configuration Finding: ${field}`,
          message: err.message,
          severity: "medium",
          category: "security",
          source: "ai-advisor",
          file: meta.fileName,
          line: meta.line,
          key: field,
        });
      }
    }

    // 4. Scanner Engines (OSV + Compatibility)
    const scanContext = {
      projectPath: context.projectPath,
      files: context.files,
      packageManager: context.packageManager,
      dependencies: context.dependencies,
      devDependencies: context.devDependencies,
      runtimeEnv: accumulatedCleanEnv,
    };

    const osvScanner = new OsvScanner();
    if (osvScanner.supports(scanContext)) {
      const osvResult = await osvScanner.scan(scanContext);
      if (osvResult.status === "failed") {
        throw new Error(`OSV request failed: ${osvResult.error || "Unknown error"}`);
      }
      collector.addMany(osvResult.findings);
    }

    const compatScanner = new CompatibilityEngine();
    if (compatScanner.supports(scanContext)) {
      const compatResult = await compatScanner.scan(scanContext);
      if (compatResult.status === "failed") {
        throw new Error(`Compatibility scanner failed: ${compatResult.error || "Unknown error"}`);
      }
      collector.addMany(compatResult.findings);
    }

    const allFindings = collector.getAll();

    // 5. AI Remediation Advisory for Security Findings
    let aiAdvisory: string | null = null;
    const securityFindings = collector.getByCategory("security");
    if (securityFindings.length > 0 && canUseAi) {
      aiAdvisory = await generateAdvisory(securityFindings, {
        ...context.dependencies,
        ...context.devDependencies,
      });
    }

    const hasBlockingIssues = collector.hasBlockingIssues();
    const exitCode = hasBlockingIssues ? 1 : 0;

    return {
      findings: allFindings,
      totalParsedLines,
      engine: activeEngineName,
      scannedEnvFiles: context.envFiles,
      cleanEnv: accumulatedCleanEnv,
      aiAdvisory,
      hasBlockingIssues,
      exitCode,
    };
  }
}
