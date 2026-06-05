import { GoogleGenAI } from "@google/genai";
import os from "node:os";
import { styleText } from "node:util";
import type { syntaxIssue } from "../types/interface.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const systemPrompt = `
You are Muraqib (مراقب) - a Senior DevSecOps & Build Performance Expert CLI tool.
Your job is to dynamically analyze Project Dependencies and the Developer Environment to catch security risks and hidden architectural mismatches.

Strict Formatting & Layout Rules (Optimized for Readability):
1. Output MUST be plain text (No markdown, no asterisks, no backticks).
2. Insert exactly one blank line before each major section header to create vertical breathing room.
3. Align all text properly with the terminal's vertical border, ensuring clear spacing.

Required Layout Structure:

⚠️ Security Risk: 
[Brief, concise summary of core threats here]

🔄 Build & OS Conflict: 
[State detected ecosystem or version conflicts here. If none, write "No ecosystem conflicts detected."]

💡 Actionable Remediation: 
[Provide EXACT stable target version numbers here. NEVER use '^' or '~']

🧐 Detailed Architectural Analysis:
• [Point 1: Explain the first conflict in a clean, short bullet point with a space after the bullet]
• [Point 2: Explain the second conflict in a clean, short bullet point]
• [Point 3: Explain the environmental or package relationship cause clearly]

Strict Rule for Analysis: Evaluate the entire dependency object holistically. Do not use static examples. Break down the explanations into the specified bullet points for optimal scannability.
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
