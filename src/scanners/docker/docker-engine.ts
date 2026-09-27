import type { ScannerEngine, ScanContext, ScanResult, ScanStatus } from "../../core/contracts/scanner-engine.js";
import type { Finding } from "../../core/findings/finding.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "yaml";

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
              await execFileAsync("docker", ["build", "--check", "-f", fullPath, "."], { cwd: context.projectPath });
            } catch (err: any) {
              const stderr = err.stderr || err.message;
              findings.push({
                id: "DF-01",
                title: "Invalid Dockerfile or build instruction",
                message: "Docker build checks failed: " + stderr.split("\n")[0],
                severity: "high",
                category: "validation",
                source: "docker-build-check",
                confidence: "confirmed",
                file: dockerfile,
              });
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
              await execFileAsync("docker", ["compose", "-f", fullPath, "config", "-q"], { cwd: context.projectPath });
            } catch (err: any) {
              const stderr = err.stderr || err.message;
              findings.push({
                id: "CO-01-CLI",
                title: "Invalid Compose model",
                message: stderr.split("\n")[0] || "Invalid compose configuration",
                severity: "high",
                category: "validation",
                source: "docker-compose",
                confidence: "confirmed",
                file: composeFile,
              });
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

    if (context.dockerfiles && context.dockerfiles.length > 0) {
      diagnostics.push("Built-image vulnerability analysis (IM-04) requires an external tool like Docker Scout or Trivy. This check is currently skipped.");
      if (status === "success") {
        status = "partial";
      }
    }

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
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line || line.startsWith("#")) continue;

      // IM-01
      if (line.toUpperCase().startsWith("FROM ")) {
        const parts = line.split(/\s+/);
        const image = parts[1];
        if (image && (image.endsWith(":latest") || !image.includes(":"))) {
          if (image !== "scratch") {
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

      // SE-01
      if (line.toUpperCase().startsWith("ENV ") || line.toUpperCase().startsWith("ARG ")) {
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
}
