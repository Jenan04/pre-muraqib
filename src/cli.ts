import * as x from "@clack/prompts"; // import * => select(), intro(), outro(), spinner(), confirm(), note(), isCancel()
import { styleText, parseArgs } from "node:util";
import { parseEnvFile } from "./parser";

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
    `${styleText(["bgCyan", "black"], "Muraqib 🛡️ ")} ${styleText("dim", "◈ DevSecOps Config Auditor")}`,
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
  // fake spinner for now
  const s = x.spinner();
  s.start("Analyzing configuration files...");

  const targetFile = ".env.test";
  let auditResult;

  try {
    auditResult = parseEnvFile(targetFile);
    s.stop("Analysis complete!");
  } catch (error: any) {
    s.stop("Analysis failed!");
    x.log.error(`${styleText("red", "Error:")} ${error.message}`);
    process.exit(1);
  }

  const { parsedLines, issues } = auditResult;

  if (issues.length > 0) {
    x.log.warn(
      styleText(
        "yellow",
        `Found ${issues.length} issue(s) in your configuration:`,
      ),
    );
    console.log("");

    issues.forEach((issue) => {
      const isError = issue.severity === "error";
      const badgeColor = isError ? ["bgRed", "white"] : ["bgYellow", "black"];
      const badgeText = isError ? " ERROR " : " WARN  ";

      const prefix = `${styleText(badgeColor as any, badgeText)} ${styleText("dim", `Line ${issue.line}:`)}`;

      console.log(`  ${prefix} ${issue.message}`);
    });

    console.log("");
  }

  const hasErrors = issues.some((i) => i.severity === "error");

  let summaryContent = `• Target File: ${styleText("cyan", targetFile)}\n`;
  summaryContent += `• Target Environment: ${styleText("cyan", String(mode))}\n`;
  summaryContent += `• Valid Variables Parsed: ${styleText("green", String(parsedLines.length))}\n`;

  if (issues.length === 0) {
    summaryContent += `• Status: ${styleText("green", "✔ Clean & Secure Syntax")}`;
  } else {
    summaryContent += `• Status: ${hasErrors ? styleText("red", "✖ Fix required before deployment") : styleText("yellow", "⚠ Code health warnings detected")}`;
  }

  x.note(summaryContent, "Audit Summary");

  if (hasErrors) {
    x.outro(
      styleText("red", "Muraqib scan failed. Please resolve errors above. ❌"),
    );
    process.exit(1);
  } else {
    x.outro(styleText("green", "Stay secure! ✨"));
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("An error occurred:", err);
  process.exit(1);
});
