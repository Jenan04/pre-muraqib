import * as x from "@clack/prompts";
import { styleText, parseArgs } from "node:util";
import { createProjectContext } from "./core/context/project-context.js";
import { AuditRunner } from "./core/runner/audit-runner.js";
import { renderFindings } from "./cli/renderers/finding-renderer.js";
import { formatSummaryText } from "./cli/renderers/summary-renderer.js";
import { renderAiAdvisory } from "./cli/renderers/ai-renderer.js";
import { renderJsonReport } from "./cli/renderers/json-renderer.js";
import type { ValidationEngineName } from "./guard/core/engine-detector.js";
import { runResolveWorkflow } from "./cli/resolve-workflow.js";

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      env: {
        type: "string",
        short: "e",
      },
      engine: {
        type: "string",
      },
      json: {
        type: "boolean",
      },
      ai: {
        type: "boolean",
      },
      help: {
        type: "boolean",
        short: "h",
      },
    },
    allowPositionals: true,
    strict: true,
  });

  const command = positionals[0] || "audit";
  const isJson = Boolean(values.json);

  if (values.help) {
    console.log(`Muraqib — local-first DevSecOps audit CLI

Usage:
  muraqib audit [-e build|prod] [--engine custom|zod|valibot|arktype] [--json] [--ai]
  muraqib resolve

Options:
  -e, --env       Blocking policy mode (build or prod)
      --engine    Environment validation engine
      --json      Machine-readable output
      --ai        Enable optional AI advisory output
  -h, --help      Show this help`);
    return;
  }

  if (command !== "audit" && command !== "resolve") {
    throw new Error(`Unknown command '${command}'. Use --help for usage.`);
  }

  if (typeof values.env === "string" && values.env !== "build" && values.env !== "prod") {
    throw new Error(`Invalid environment mode '${values.env}'. Expected 'build' or 'prod'.`);
  }

  const allowedEngines = new Set(["custom", "zod", "valibot", "arktype"]);
  if (typeof values.engine === "string" && !allowedEngines.has(values.engine)) {
    throw new Error(`Invalid validation engine '${values.engine}'.`);
  }

  const context = createProjectContext(process.cwd());

  if (command === "resolve") {
    await runResolveWorkflow(context);
    return;
  }

  if (!isJson) {
    x.intro(
      `${styleText(["bgCyan", "black"], "Muraqib 🛡️ ")} ${styleText("dim", "◈ DevSecOps Config & Dependency Auditor")}`
    );
  }

  let mode: string | undefined = typeof values.env === "string" ? values.env : undefined;

  if (!isJson) {
    if (mode) {
      x.log.info(`Environment passed via flag: ${styleText("cyan", mode)}`);
    } else {
      const selected = await x.select({
        message: "Select the tracking & monitoring environment:",
        options: [
          {
            value: "build",
            label: "Build Mode",
            hint: "Fast local checks for syntax errors & duplicate keys",
          },
          {
            value: "prod",
            label: "Production Mode",
            hint: "Strict security auditing for leaked tokens & weak secrets",
          },
        ],
      });

      if (x.isCancel(selected)) {
        x.cancel("Scan cancelled by user.");
        process.exit(0);
      }

      mode = String(selected);
    }
  }

  const preferredEngine =
    typeof values.engine === "string" ? (values.engine as ValidationEngineName) : undefined;

  let spinner: ReturnType<typeof x.spinner> | null = null;
  if (!isJson) {
    spinner = x.spinner();
    spinner.start("🔍 Executing comprehensive security & configuration audit...");
  }

  const runner = new AuditRunner();
  let report;

  try {
    report = await runner.run(context, {
      mode: mode === "prod" ? "prod" : "build",
      engine: preferredEngine,
      enableAi: Boolean(values.ai),
    });
  } catch (err: unknown) {
    if (spinner) {
      spinner.stop("Audit execution failed!");
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (isJson) {
      console.log(
        JSON.stringify(
          {
            schemaVersion: "1.0",
            status: "error",
            exitCode: 3,
            error: { code: "AUDIT_EXECUTION_FAILED", message: msg },
          },
          null,
          2
        )
      );
    } else {
      console.log("");
      x.outro(
        styleText("red", "Muraqib scan failed\n\n") +
        styleText("dim", "Cause:\n  ") +
        msg
      );
    }
    process.exit(3);
  }

  if (spinner) {
    spinner.stop(`Audit complete! ${styleText("dim", `[engine: ${report.engine}]`)}`);
  }

  if (isJson) {
    renderJsonReport(report);
    process.exit(report.exitCode);
  }

  // 1. Render findings
  renderFindings(report.findings);

  if (report.findings.some((f) => f.dependencyProblem !== undefined)) {
    console.log(
      `  ${styleText("cyan", "💡 Tip:")} Run ${styleText(["bold", "cyan"], "muraqib resolve")} to inspect evidence-based dependency resolution candidates.\n`
    );
  }

  // 2. Render AI advisory if present
  renderAiAdvisory(report.aiAdvisory);

  // 3. Render summary note
  x.note(formatSummaryText(report), "Muraqib Audit Summary");

  // 4. Outro & Exit
  if (report.hasBlockingIssues) {
    x.outro(
      styleText(
        "red",
        "Muraqib scan failed. Please resolve the security/syntax errors above. ❌"
      )
    );
    process.exit(1);
  } else {
    x.outro(
      styleText(
        "green",
        "No blocking findings were detected by the checks that completed. ✨"
      )
    );
    process.exit(0);
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Muraqib could not start: ${message}`);
  process.exitCode = 3;
});
