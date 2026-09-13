import type { AuditReport } from "../../core/runner/audit-runner.js";

export function renderJsonReport(report: AuditReport): void {
  const output = {
    timestamp: new Date().toISOString(),
    status: report.hasBlockingIssues ? "failed" : "passed",
    exitCode: report.exitCode,
    summary: {
      totalFindings: report.findings.length,
      scannedFiles: report.scannedEnvFiles,
      parsedLines: report.totalParsedLines,
      engine: report.engine,
    },
    findings: report.findings,
    aiAdvisory: report.aiAdvisory,
  };

  console.log(JSON.stringify(output, null, 2));
}
