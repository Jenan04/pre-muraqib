import { styleText } from "node:util";
import type { AuditReport } from "../../core/runner/audit-runner.js";

export function formatSummaryText(report: AuditReport): string {
  let summary = `• Scanned Env Files: ${styleText("cyan", report.scannedEnvFiles.join(", ") || "None")}\n`;
  summary += `• Valid Env Variables: ${styleText("green", String(report.totalParsedLines))}\n`;
  summary += `• Active Validation Engine: ${styleText("cyan", report.engine)}\n`;
  summary += `• Total Findings: ${report.findings.length === 0 ? styleText("green", "0") : styleText("yellow", String(report.findings.length))}\n`;

  if (!report.hasBlockingIssues && report.findings.length === 0) {
    summary += `• Status: ${styleText("green", "✔ No blocking findings detected by completed checks")}`;
  } else if (!report.hasBlockingIssues) {
    summary += `• Status: ${styleText("yellow", "⚠ Informational warnings detected (Non-blocking)")}`;
  } else {
    summary += `• Status: ${styleText("red", "✖ Fix required before deployment")}`;
  }

  return summary;
}
