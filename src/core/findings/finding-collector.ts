import type { Finding } from "./finding.js";

export class FindingCollector {
  private findings: Finding[] = [];

  add(finding: Finding): void {
    this.findings.push(finding);
  }

  addMany(findings: Finding[]): void {
    this.findings.push(...findings);
  }

  getAll(): Finding[] {
    return [...this.findings];
  }

  getByCategory(category: Finding["category"]): Finding[] {
    return this.findings.filter((f) => f.category === category);
  }

  getBySeverity(severity: Finding["severity"]): Finding[] {
    return this.findings.filter((f) => f.severity === severity);
  }

  hasBlockingIssues(): boolean {
    return this.findings.some(
      (f) => f.severity === "critical" || f.severity === "high"
    );
  }

  clear(): void {
    this.findings = [];
  }
}
