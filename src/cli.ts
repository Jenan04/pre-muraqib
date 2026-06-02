import * as x from "@clack/prompts";
import { styleText, parseArgs } from "node:util";
import { parseEnvFile } from "./core/EnvParser.js";
import { NpmParser } from "./core/NpmParser.js";
import * as fs from "node:fs";
import { generateFixRecommendations } from "./core/AiAdvisor.js";

async function main() {
  console.clear();

  const { values } = parseArgs({
    options: {
      env: {
        type: "string",
        short: "e",
      },
    },
    strict: false,
  });

  x.intro(
    `${styleText(["bgCyan", "black"], "Muraqib 🛡️ ")} ${styleText("dim", "◈ DevSecOps Config & Dependency Auditor")}`,
  );

  let mode = values.env;
  if (mode) {
    x.log.info(`Environment passed via flag: ${styleText("cyan", mode)}`);
  } else {
    mode = await x.select({
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

    if (x.isCancel(mode)) {
      x.cancel("Scan cancelled by user.");
      process.exit(0);
    }
  }

  const sEnv = x.spinner();
  sEnv.start("📋 Scanning all configuration (.env) files...");

  const targetFiles = fs
    .readdirSync(".")
    .filter((file) => file.startsWith(".env"));

  if (targetFiles.length === 0) {
    sEnv.stop("Scan failed!");
    x.log.error(styleText("red", "No .env files found in the root directory."));
    process.exit(1);
  }

  let totalParsedLines = 0;
  let envIssues: {
    fileName: string;
    line: number;
    severity: string;
    message: string;
  }[] = [];

  targetFiles.forEach((file) => {
    try {
      const result = parseEnvFile(file);
      totalParsedLines += result.parsedLines.length;

      result.issues.forEach((issue) => {
        envIssues.push({
          fileName: file,
          ...issue,
        });
      });
    } catch (error: any) {
      envIssues.push({
        fileName: file,
        line: 0,
        severity: "error",
        message: error.message,
        // message: `Package [${packageName}@${actualVersion}] has...`,
        // key: packageName,
      });
    }
  });

  sEnv.stop("Configuration analysis complete!");

  if (envIssues.length > 0) {
    x.log.warn(
      styleText(
        "yellow",
        `Found ${envIssues.length} issue(s) in your .env files:`,
      ),
    );
    envIssues.forEach((issue) => {
      const isError = issue.severity === "error";
      const badgeColor = isError ? ["bgRed", "white"] : ["bgYellow", "black"];
      const badgeText = isError ? " ERROR " : " WARN  ";
      const fileAndLine = `${styleText("cyan", issue.fileName)}:${styleText("dim", String(issue.line))}`;
      const prefix = `${styleText(badgeColor as any, badgeText)} [${fileAndLine}]`;
      console.log(`  ${prefix} ${issue.message}`);
    });
    console.log("");
  }

  const sNpm = x.spinner();
  sNpm.start("📦 Scanning dependencies for known vulnerabilities (OSV API)...");

  let npmIssues: any[] = [];

  if (fs.existsSync("package.json")) {
    const npmResult = await NpmParser("package.json");
    npmIssues = npmResult.issues;
    sNpm.stop("Dependency vulnerability analysis complete!");
  } else {
    sNpm.stop("Skipped!");
    x.log.info("No package.json found, skipping dependency scan.");
  }

  if (npmIssues.length > 0) {
    x.log.error(
      styleText(
        "red",
        `🚨 Security Alert: Found ${npmIssues.length} vulnerability issues:`,
      ),
    );
    npmIssues.forEach((issue) => {
      const fileAndLine = `${styleText("cyan", "package.json")}:${styleText("dim", String(issue.line))}`;
      const prefix = `${styleText(["bgRed", "white"], " VULN  ")} [${fileAndLine}]`;
      console.log(`  ${prefix} ${issue.message}`);
    });
    console.log("");

    if (process.env.GEMINI_API_KEY) {
      await generateFixRecommendations(npmIssues);
    }
    
  } else if (fs.existsSync("package.json")) {
    x.log.success(
      styleText(
        "green",
        "✔ All dependencies are secure. No known vulnerabilities found!",
      ),
    );
    console.log("");
  }

  const totalIssuesCount = envIssues.length + npmIssues.length;
  const hasErrors =
    envIssues.some((i) => i.severity === "error") || npmIssues.length > 0;

  let summaryContent = `• Scanned Env Files: ${styleText("cyan", targetFiles.join(", "))}\n`;
  summaryContent += `• Total Valid Env Variables: ${styleText("green", String(totalParsedLines))}\n`;
  summaryContent += `• Checked NPM Packages: ${styleText("cyan", "Active on Disk")}\n`;

  if (totalIssuesCount === 0) {
    summaryContent += `• Status: ${styleText("green", "✔ Clean, Secure Syntax & Safe Dependencies")}`;
  } else {
    summaryContent += `• Status: ${hasErrors ? styleText("red", "✖ Fix required before deployment") : styleText("yellow", "⚠ Code health warnings detected")}`;
  }

  x.note(summaryContent, "Muraqib Audit Summary");

  if (hasErrors) {
    x.outro(
      styleText(
        "red",
        "Muraqib scan failed. Please resolve the security/syntax errors above. ❌",
      ),
    );
    process.exit(1);
  } else {
    x.outro(styleText("green", "Everything looks secure! Stay safe! ✨"));
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("An error occurred during Muraqib execution:", err);
  process.exit(1);
});
