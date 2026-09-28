import type { ScannerEngine, ScanContext, ScanResult, ScanStatus } from "../../core/contracts/scanner-engine.js";
import type { Finding } from "../../core/findings/finding.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "yaml";
import ignore from "ignore";

const execFileAsync = promisify(execFile);

export class DockerScanner implements ScannerEngine {
  readonly name = "docker";

  supports(context: ScanContext): boolean {
    return (context.dockerfiles && context.dockerfiles.length > 0) || 
           (context.composeFiles && context.composeFiles.length > 0) || false;
  }

  async scan(context: ScanContext): Promise<ScanResult> {
    const findings: Finding[] = [];
    const scannedInputs: string[] = [];
    const skippedInputs: string[] = [];
    const diagnostics: string[] = [];
    let isPartial = false;

    // Check if Docker is installed
    let dockerInstalled = false;
    try {
      await execFileAsync("docker", ["--version"]);
      dockerInstalled = true;
    } catch {
      diagnostics.push("Docker CLI is not available. Some checks will be skipped.");
      isPartial = true;
    }

    if (context.dockerfiles) {
      for (const dockerfile of context.dockerfiles) {
        try {
          const fullPath = path.join(context.projectPath, dockerfile);
          const content = await fs.readFile(fullPath, "utf-8");
          scannedInputs.push(dockerfile);
          
          this.analyzeDockerfile(content, dockerfile, findings);
          
          if (dockerInstalled) {
            try {
              // DF-01: Validates Dockerfile with buildx if available
              await execFileAsync("docker", ["build", "--check", "-f", fullPath, "."], { 
                cwd: context.projectPath,
                timeout: 5000,
                maxBuffer: 1024 * 512
              });
            } catch (err: any) {
              const stderr = (err.stderr || err.message || "").toLowerCase();
              if (err.killed || stderr.includes("cannot connect to the docker daemon") || stderr.includes("is not a docker command")) {
                diagnostics.push(`Docker build check skipped for ${dockerfile} due to environment issue: ${stderr.split("\n")[0]}`);
                isPartial = true;
              } else {
                findings.push({
                  id: "DF-01",
                  title: "Invalid Dockerfile or build instruction",
                  message: "Docker build checks failed for " + dockerfile,
                  severity: "high",
                  category: "validation",
                  source: "docker-build-check",
                  confidence: "confirmed",
                  file: dockerfile,
                });
              }
            }
          }
        } catch (err: any) {
          skippedInputs.push(dockerfile);
          diagnostics.push(`Failed to read Dockerfile ${dockerfile}: ${err.message}`);
          isPartial = true;
        }
      }
    }

    if (context.composeFiles) {
      for (const composeFile of context.composeFiles) {
        try {
          const fullPath = path.join(context.projectPath, composeFile);
          const content = await fs.readFile(fullPath, "utf-8");
          
          let parsed: any;
          try {
            parsed = yaml.parse(content);
          } catch (err: any) {
            findings.push({
              id: "CO-01",
              title: "Invalid YAML in Compose file",
              message: err.message,
              severity: "high",
              category: "validation",
              source: "yaml-parser",
              confidence: "confirmed",
              file: composeFile,
            });
            skippedInputs.push(composeFile);
            continue;
          }
          
          scannedInputs.push(composeFile);
          this.analyzeCompose(parsed, composeFile, findings);

          if (dockerInstalled) {
            try {
              const { stdout } = await execFileAsync("docker", ["compose", "-f", fullPath, "config", "--format", "json"], { 
                cwd: context.projectPath,
                timeout: 10000,
                maxBuffer: 1024 * 1024 * 2
              });
              
              let composeConfig;
              try {
                composeConfig = JSON.parse(stdout);
              } catch {
                // Ignore parse error
              }
              
              if (composeConfig && composeConfig.services) {
                await this.analyzeComposeContexts(composeConfig, composeFile, findings, diagnostics, context.projectPath);
              }
            } catch (err: any) {
              const stderr = (err.stderr || err.message || "").toLowerCase();
              if (err.killed || stderr.includes("cannot connect to the docker daemon") || stderr.includes("is not a docker command")) {
                diagnostics.push(`Docker compose config skipped for ${composeFile} due to environment issue: ${stderr.split("\n")[0]}`);
                isPartial = true;
              } else {
                findings.push({
                  id: "CO-01-CLI",
                  title: "Invalid Compose model",
                  message: "Invalid compose configuration in " + composeFile,
                  severity: "high",
                  category: "validation",
                  source: "docker-compose",
                  confidence: "confirmed",
                  file: composeFile,
                });
              }
            }
          }
        } catch (err: any) {
          skippedInputs.push(composeFile);
          diagnostics.push(`Failed to analyze Compose file ${composeFile}: ${err.message}`);
          isPartial = true;
        }
      }
    }
    
    let status: ScanStatus = "success";
    if (isPartial) {
      status = "partial";
    }

    // Removed forced 'partial' status for IM-04 since it shouldn't affect a static audit.

    return {
      scanner: this.name,
      status,
      findings,
      scannedInputs,
      skippedInputs,
      diagnostics
    };
  }

  private analyzeDockerfile(content: string, fileName: string, findings: Finding[]) {
    const lines = content.split("\n");
    const stages = new Set<string>();
    const buildArgs: Record<string, string> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line || line.startsWith("#")) continue;

      const upperLine = line.toUpperCase();

      if (upperLine.startsWith("ARG ")) {
        const argMatch = line.match(/^ARG\s+([^=]+)(?:=(.*))?$/);
        if (argMatch) {
          const argName = argMatch[1]?.trim() || "";
          const argValue = argMatch[2]?.trim() || "";
          buildArgs[argName] = argValue;
        }
      }

      // IM-01: Mutable latest tag (or no tag)
      if (upperLine.startsWith("FROM ")) {
        const parts = line.split(/\s+/);
        let image = parts[1] || "";
        
        // Handle AS aliases
        if (upperLine.includes(" AS ")) {
          const asIndex = upperLine.indexOf(" AS ");
          const alias = line.substring(asIndex + 4).trim();
          if (alias) stages.add(alias);
        }

        // Resolve ARG if used
        if (image.startsWith("${") && image.endsWith("}")) {
          const varName = image.substring(2, image.length - 1);
          image = buildArgs[varName] || "unknown";
        } else if (image.startsWith("$")) {
          const varName = image.substring(1);
          image = buildArgs[varName] || "unknown";
        }

        if (image && image !== "unknown" && image.toLowerCase() !== "scratch" && !stages.has(image)) {
          if (image.endsWith(":latest") || (!image.includes(":") && !image.includes("@"))) {
            findings.push({
              id: "IM-01",
              title: "Mutable latest tag",
              message: `Base image "${image}" uses the latest or no tag, which is mutable.`,
              severity: "medium",
              category: "reliability",
              source: "docker-analyzer",
              confidence: "inferred",
              file: fileName,
              line: i + 1,
              evidence: line,
              remediation: "Pin the base image by digest or a specific version tag.",
            });
          }
        }
      }

      // SE-01: Sensitive values in ARG/ENV
      if (upperLine.startsWith("ENV ") || upperLine.startsWith("ARG ")) {
        const isSecret = /password|secret|token|key|cred/i.test(line);
        if (isSecret) {
          findings.push({
            id: "SE-01",
            title: "Sensitive build value in ARG or ENV",
            message: "Detected a potentially sensitive variable name in build instructions.",
            severity: "high",
            category: "security",
            source: "docker-analyzer",
            confidence: "inferred",
            file: fileName,
            line: i + 1,
            remediation: "Use Docker Secrets (--secret) or external vaults instead of ARG/ENV for sensitive data.",
          });
        }
      }
    }
  }

  private analyzeCompose(parsed: any, fileName: string, findings: Finding[]) {
    if (!parsed || typeof parsed !== "object" || !parsed.services) return;

    for (const [serviceName, service] of Object.entries(parsed.services)) {
      if (!service || typeof service !== "object") continue;

      // PR-02
      if ((service as any).privileged === true) {
        findings.push({
          id: "PR-02",
          title: "Service runs as privileged",
          message: `Service "${serviceName}" has privileged: true, which disables isolation.`,
          severity: "high",
          category: "security",
          source: "docker-analyzer",
          confidence: "confirmed",
          file: fileName,
          key: `services.${serviceName}.privileged`,
          remediation: "Remove privileged mode and grant only specific capabilities using cap_add.",
        });
      }

      // PR-05
      const volumes = (service as any).volumes;
      if (Array.isArray(volumes)) {
        for (const vol of volumes) {
          const volStr = typeof vol === "string" ? vol : vol.source;
          if (volStr && volStr.includes("docker.sock")) {
            findings.push({
              id: "PR-05",
              title: "Docker socket mounted",
              message: `Service "${serviceName}" mounts the Docker socket, granting root-level host access.`,
              severity: "critical",
              category: "security",
              source: "docker-analyzer",
              confidence: "confirmed",
              file: fileName,
              key: `services.${serviceName}.volumes`,
              remediation: "Avoid exposing the Docker socket. If required for monitoring, use a read-only proxy.",
            });
          }
        }
      }
    }
  }
  private async analyzeComposeContexts(composeConfig: any, composeFile: string, findings: Finding[], diagnostics: string[], projectPath: string) {
    for (const [serviceName, service] of Object.entries(composeConfig.services || {})) {
      if (!service || typeof service !== "object") continue;
      
      const build = (service as any).build;
      if (!build) continue; // No local build definition
      
      let buildContext = "";
      let dockerfile = "Dockerfile";
      
      if (typeof build === "string") {
        buildContext = build;
      } else if (typeof build === "object") {
        buildContext = build.context || "";
        if (build.dockerfile) dockerfile = build.dockerfile;
      }
      
      if (!buildContext) {
        diagnostics.push(`Service ${serviceName} in ${composeFile} has an ambiguous or missing build context.`);
        continue;
      }
      
      // Ensure buildContext is absolute or resolve it
      const absoluteContext = path.resolve(projectPath, buildContext);
      
      // Basic symlink escape prevention
      try {
        const realContext = await fs.realpath(absoluteContext);
        if (!realContext.startsWith(projectPath)) {
          diagnostics.push(`Service ${serviceName} context escapes project root: ${realContext}`);
          continue;
        }
      } catch {
        // Context might not exist or be accessible
        diagnostics.push(`Service ${serviceName} build context is inaccessible: ${absoluteContext}`);
        continue;
      }

      // Check for sensitive files in context
      const candidates = [".env", ".env.local", ".env.production"];
      const existingCandidates: string[] = [];
      
      for (const candidate of candidates) {
        try {
          const stat = await fs.stat(path.join(absoluteContext, candidate));
          if (stat.isFile()) existingCandidates.push(candidate);
        } catch {
          // File doesn't exist
        }
      }
      
      if (existingCandidates.length === 0) continue; // Nothing to leak
      
      // Dockerfile ignore logic
      const ig = ignore();
      let ignoreFileUsed = "";
      
      try {
        const dockerfileIgnore = path.join(absoluteContext, `${dockerfile}.dockerignore`);
        const content = await fs.readFile(dockerfileIgnore, "utf-8");
        ig.add(content);
        ignoreFileUsed = `${dockerfile}.dockerignore`;
      } catch {
        try {
          const defaultIgnore = path.join(absoluteContext, ".dockerignore");
          const content = await fs.readFile(defaultIgnore, "utf-8");
          ig.add(content);
          ignoreFileUsed = ".dockerignore";
        } catch {
          // No ignore file
        }
      }
      
      // Filter candidates by ignore rules
      const unignoredCandidates = existingCandidates.filter(c => !ig.ignores(c));
      
      if (unignoredCandidates.length === 0) continue; // All sensitive files are ignored
      
      // Read Dockerfile to parse COPY instructions
      let dfContent = "";
      try {
        const dfPath = path.isAbsolute(dockerfile) ? dockerfile : path.join(absoluteContext, dockerfile);
        dfContent = await fs.readFile(dfPath, "utf-8");
      } catch {
        diagnostics.push(`Failed to read Dockerfile ${dockerfile} for service ${serviceName}`);
        continue;
      }
      
      const lines = dfContent.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (!line || line.startsWith("#")) continue;
        
        const upperLine = line.toUpperCase();
        if (upperLine.startsWith("COPY ") || upperLine.startsWith("ADD ")) {
          // Ignore COPY --from
          if (upperLine.includes("--FROM=")) continue;
          
          // Basic check: if it copies . or includes the candidate name
          for (const candidate of unignoredCandidates) {
            // Simplified check: if line contains '.' as source, or candidate name
            // More robust would be parsing the sources properly, but for now this catches COPY . and COPY .env
            const parts = line.split(/\s+/);
            // parts[0] is COPY, last part is dest. middle parts are sources
            const sources = parts.slice(1, parts.length - 1).filter(s => !s.startsWith("--"));
            
            let isCopied = false;
            for (const src of sources) {
              if (src === "." || src === "./" || src.includes(candidate) || src === "*") {
                isCopied = true;
                break;
              }
            }
            
            if (isCopied) {
              findings.push({
                id: "IM-05",
                title: "Sensitive file copied into build stage",
                message: `Service "${serviceName}" copies unignored sensitive file "${candidate}" into a build stage or image.`,
                severity: "high",
                category: "security",
                source: "docker-analyzer",
                confidence: "confirmed",
                file: composeFile,
                line: i + 1,
                remediation: `Add ${candidate} to ${ignoreFileUsed || '.dockerignore'} or narrow the COPY instruction in ${dockerfile}.`,
              });
            }
          }
        }
      }
    }
  }
}
