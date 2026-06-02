import { GoogleGenAI } from "@google/genai";
import os from "node:os";
import { styleText } from "node:util";
import type { syntaxIssue } from "../types/interface.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const systemPrompt = `
You are Muraqib (مراقب) - a Senior DevSecOps & Build Performance Expert CLI tool.
Your job is to analyze the provided Security Vulnerabilities, Project Dependencies, and Developer Environment to detect BOTH security risks and compilation/architecture conflicts.

Strict Formatting & Versioning Rules:
1. Output exactly 3 lines max in plain text (No markdown, no asterisks, no backticks).
2. Line 1 must start with "⚠️ Security Risk:" and briefly summarize the core security threats.
3. Line 2 must start with "🔄 Build & OS Conflict:" Scan the environment and full dependencies for ecosystem conflicts or breaking changes.
4. Line 3 must start with "💡 Actionable Remediation:" Provide the EXACT, SPECIFIC, and LATEST STABLE target version numbers to upgrade to.
   - UPGRADE POLICY: Always prefer recommending the LATEST STABLE release that fixes the vulnerability. Do not downgrade to older major versions (e.g., dropping from v15 to v14) unless the current pre-release is fundamentally broken with no stable upgrade path available.
   - CONFIG TRANSITION: If upgrading to the latest stable version involves a major architectural shift (like Tailwind v4 zero-config, Prisma 6/7 engines, or Next.js stable 15 async APIs), recommend that exact stable version and explicitly state the quick migration tip (e.g., "Upgrade to stable Tailwind 4.0.0 and migrate configurations directly into the CSS file").
   - CRITICAL: NEVER use version range prefixes like '^' or '~' (e.g., write "1.6.0", NOT "^1.6.0").
`;

export async function generateFixRecommendations(
  issue: syntaxIssue[],
  allDependencies: Record<string, string>,
): Promise<void> {
  // let vulnerabilitiesContext = "";

  // issue.forEach((item, index) => {
  //   vulnerabilitiesContext += `${index + 1}. [Line ${item.line}] ${item.message}\n`;
  // });
  const developerEnvironment = `
- OS Platform: ${os.platform()}
- Architecture: ${os.arch()} (e.g., arm64, x64)
- Node.js Version: ${process.version}
`;

  let vulnerabilitiesContext = "";
  issue.forEach((item, index) => {
    vulnerabilitiesContext += `${index + 1}. [Line ${item.line}] ${item.message}\n`;
  });

  const fullProjectDepsContext = JSON.stringify(allDependencies, null, 2);

  //   const contents = `
  // ${systemPrompt}

  // Here is the current project security context detected by Muraqib:
  // ${vulnerabilitiesContext}

  // Please generate the 2-line advice now.
  // `;

  const contents = `
${systemPrompt}

[DEVELOPER CURRENT ENVIRONMENT]
${developerEnvironment}

[FULL PROJECT DEPENDENCIES]
${fullProjectDepsContext}

[DETECTED SECURITY VULNERABILITIES (FROM OSV)]
${vulnerabilitiesContext}

Please generate the 3-line compliance advice now.
`;

  const response = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: contents,
  });

  let fullAiResponse = "";
  for await (const chunk of response) {
    fullAiResponse += chunk.text;
  }

  // process.stdout.write(
  //   "│\n✦  Muraqib AI Fix Recommendations ⚡ (Automated Advice)\n│  ",
  // );

  console.log("│");
  console.log(
    `├  ${styleText(["bgCyan", "black"], " Muraqib AI Advice ⚡ ")} ${styleText("dim", "◈ Contextual Remediation")}`,
  );
  console.log("│");

  // for await (const chunk of response) {
  //   console.log(chunk.text);
  // }

  // process.stdout.write("\n│\n");
  const lines = fullAiResponse.split("\n").filter((line) => line.trim() !== "");

  // 4. طباعة كل سطر بمحاذاة حافة الـ CLI "│" بشكل نظيف واحترافي
  lines.forEach((line) => {
    console.log(`│  ${line}`);
  });

  console.log("│");
}

// generateFixRecommendations();
