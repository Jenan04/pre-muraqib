import type { Finding } from "../findings/finding.js";
import type {
  ResolutionPlan,
  PackageChange,
  CompatibilityStatus,
  RiskLevel,
  ResolutionDirection,
} from "./resolution-plan.js";
import { DependencyGraph } from "./dependency-graph.js";

export class ResolutionEngine {
  private graph: DependencyGraph;

  constructor(graph: DependencyGraph) {
    this.graph = graph;
  }

  /**
   * Generates deterministically ranked resolution plans for detected dependency findings.
   */
  public generatePlans(findings: Finding[]): ResolutionPlan[] {
    const plans: ResolutionPlan[] = [];
    const dependencyFindings = findings.filter(
      (f) => f.dependencyProblem !== undefined
    );

    for (const finding of dependencyFindings) {
      const problem = finding.dependencyProblem!;
      const fixedVersions = problem.fixedVersions || [];
      if (fixedVersions.length === 0) {
        continue;
      }

      // 1. Identify Safe Upgrade Candidates
      // Sort fixed versions in ascending semver
      const sortedCandidates = [...fixedVersions].sort((a, b) => this.compareSemver(a, b));
      // Minimal safe candidate that resolves all advisories
      const minSafeCandidate = sortedCandidates[sortedCandidates.length - 1];
      if (!minSafeCandidate) continue;

      const currentVer = problem.installedVersion;
      const isUp = this.compareSemver(minSafeCandidate, currentVer) > 0;
      const direction: ResolutionDirection = isUp ? "upgrade" : "downgrade";

      // Compatibility check
      const compat = this.graph.checkCompatibility(problem.package, minSafeCandidate);

      // Assess Risk
      const currentMajor = parseInt(currentVer.split(".")[0] || "0", 10);
      const targetMajor = parseInt(minSafeCandidate.split(".")[0] || "0", 10);
      const isMajorJump = targetMajor !== currentMajor;
      const risk: RiskLevel = isMajorJump ? "Medium" : "Low";

      const baseChange: PackageChange = {
        packageName: problem.package,
        currentVersion: currentVer,
        targetVersion: minSafeCandidate,
        direction,
        reason: `Resolves ${problem.advisoryCount} applicable OSV security advisories.`,
      };

      // Plan A: Minimal / Safe Upgrade
      const planA: ResolutionPlan = {
        id: `plan-${problem.package}-safe`,
        title: `Safe ${direction === "upgrade" ? "Upgrade" : "Downgrade"}`,
        planName: `Plan A — Safe ${direction === "upgrade" ? "Upgrade" : "Downgrade"}`,
        reason: `Resolves ${problem.advisoryCount} applicable OSV security advisories with minimal justified changes.`,
        changes: [baseChange],
        findingsResolved: [finding],
        securityImpact: "Resolves applicable OSV vulnerabilities.",
        compatibility: compat.status,
        risk,
        affectedPackages: [problem.package],
        explanation: `Updates ${problem.package} from ${currentVer} to ${minSafeCandidate} to resolve all known vulnerabilities.`,
      };
      plans.push(planA);

      // Check for Coordinated Changes (e.g. Prisma + @prisma/client, or peer dependencies)
      const relatedPackages = this.graph.getRelatedPackages(problem.package);
      if (relatedPackages.length > 0) {
        const coordinatedChanges: PackageChange[] = [baseChange];
        for (const relName of relatedPackages) {
          const relPkg = this.graph.getPackage(relName);
          if (relPkg) {
            const relCurrent = relPkg.installedVersion || relPkg.declaredVersion;
            // Coordinated target: matching target major or compatible version
            const relTarget = minSafeCandidate; // e.g. @prisma/client matches prisma
            coordinatedChanges.push({
              packageName: relName,
              currentVersion: relCurrent,
              targetVersion: relTarget,
              direction: "coordinated-upgrade",
              reason: `Maintains ecosystem compatibility with ${problem.package}@${minSafeCandidate}.`,
            });
          }
        }

        const planB: ResolutionPlan = {
          id: `plan-${problem.package}-coordinated`,
          title: "Coordinated Upgrade",
          planName: "Plan B — Coordinated Upgrade",
          reason: `Coordinates upgrade of ${problem.package} with related ecosystem packages (${relatedPackages.join(", ")}).`,
          changes: coordinatedChanges,
          findingsResolved: [finding],
          securityImpact: "Resolves applicable OSV vulnerabilities and keeps related packages in sync.",
          compatibility: "Compatible",
          risk: isMajorJump ? "Medium" : "Low",
          affectedPackages: coordinatedChanges.map((c) => c.packageName),
          explanation: `Simultaneously upgrades ${coordinatedChanges.map((c) => c.packageName).join(" and ")} to prevent breaking changes.`,
        };
        plans.push(planB);
      }

      // Check for Downgrade alternative if available
      // If the current version is vulnerable but an older LTS/patch is unaffected
      const olderCandidates = sortedCandidates.filter((v) => this.compareSemver(v, currentVer) < 0);
      if (olderCandidates.length > 0) {
        const safeDowngradeTarget = olderCandidates[olderCandidates.length - 1];
        if (safeDowngradeTarget) {
          const planC: ResolutionPlan = {
            id: `plan-${problem.package}-downgrade`,
            title: "Compatible Downgrade",
            planName: "Plan C — Compatible Downgrade",
            reason: `Reverts to older safe release ${safeDowngradeTarget} that is unaffected by recent vulnerabilities.`,
            changes: [
              {
                packageName: problem.package,
                currentVersion: currentVer,
                targetVersion: safeDowngradeTarget,
                direction: "downgrade",
                reason: "Reverts to unaffected prior release.",
              },
            ],
            findingsResolved: [finding],
            securityImpact: "Removes vulnerable code by reverting to an unaffected stable release.",
            compatibility: "Compatible",
            risk: "Medium",
            affectedPackages: [problem.package],
            explanation: `Downgrades ${problem.package} from ${currentVer} to ${safeDowngradeTarget}.`,
          };
          plans.push(planC);
        }
      }
    }

    return this.rankPlans(plans);
  }

  /**
   * Deterministically rank plans based on security, compatibility, package count, and risk.
   */
  private rankPlans(plans: ResolutionPlan[]): ResolutionPlan[] {
    const riskScore = (r: RiskLevel): number => {
      switch (r) {
        case "Low":
          return 1;
        case "Medium":
          return 2;
        case "High":
          return 3;
      }
    };

    const compatScore = (c: CompatibilityStatus): number => {
      switch (c) {
        case "Compatible":
          return 1;
        case "Unknown":
          return 2;
        case "Incompatible":
          return 3;
      }
    };

    return [...plans].sort((a, b) => {
      // 1. Compatibility
      const compDiff = compatScore(a.compatibility) - compatScore(b.compatibility);
      if (compDiff !== 0) return compDiff;

      // 2. Risk level
      const riskDiff = riskScore(a.risk) - riskScore(b.risk);
      if (riskDiff !== 0) return riskDiff;

      // 3. Number of affected packages (fewer is safer)
      const countDiff = a.changes.length - b.changes.length;
      if (countDiff !== 0) return countDiff;

      // 4. Stable alphabetical ID
      return a.id.localeCompare(b.id);
    });
  }

  private compareSemver(v1: string, v2: string): number {
    const p1 = v1.split(".").map((n) => parseInt(n.replace(/\D/g, ""), 10) || 0);
    const p2 = v2.split(".").map((n) => parseInt(n.replace(/\D/g, ""), 10) || 0);
    for (let i = 0; i < 3; i++) {
      const a = p1[i] ?? 0;
      const b = p2[i] ?? 0;
      if (a !== b) return a - b;
    }
    return 0;
  }
}
