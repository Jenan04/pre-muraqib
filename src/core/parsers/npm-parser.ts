import * as fs from "node:fs";
import path from "node:path";
import type { syntaxIssue } from "../../types/interface.js";
import type { Finding } from "../findings/finding.js";
import { OsvScanner } from "../../scanners/dependency/osv-engine.js";

export interface NpmParserResult {
  issues: syntaxIssue[];
  findings: Finding[];
}

export async function NpmParser(packageJsonPath: string = "package.json"): Promise<NpmParserResult> {
  const issues: syntaxIssue[] = [];
  const projectDir = path.dirname(path.resolve(packageJsonPath));

  const scanner = new OsvScanner();
  const scanResult = await scanner.scan({
    projectPath: projectDir,
    files: [packageJsonPath],
  });

  // Read lines to compute line numbers for UI presentation
  let allLines: string[] = [];
  if (fs.existsSync(packageJsonPath)) {
    try {
      allLines = fs.readFileSync(packageJsonPath, "utf8").split("\n");
    } catch {
      allLines = [];
    }
  }

  for (const finding of scanResult.findings) {
    let realLineNum = 0;
    if (finding.key) {
      const idx = allLines.findIndex((l) => l.includes(`"${finding.key}"`));
      if (idx !== -1) {
        realLineNum = idx + 1;
      }
    }

    issues.push({
      line: realLineNum,
      type: "syntax", // backwards compatibility for existing CLI formatters
      severity: finding.severity === "critical" || finding.severity === "high" ? "error" : "warning",
      message: `${finding.message} Remediation: ${finding.remediation ?? "Review advisory"}`,
      key: finding.key,
    });
  }

  return { issues, findings: scanResult.findings };
}