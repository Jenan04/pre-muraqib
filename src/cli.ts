import * as x from "@clack/prompts";
import { styleText, parseArgs } from "node:util";
import { parseEnvFile } from "./core/EnvParser.js";
import { NpmParser } from "./core/NpmParser.js";
import * as fs from "node:fs";
import { generateFixRecommendations } from "./core/AiAdvisor.js";

// 🛡️ استيراد محرك فحص البيئات من مجلد guard الجديد
import { createEnv } from "./guard/EnvValidator.js";

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

  // =========================================================================
  // المرحلة 1: الـ Syntax Parser (شغل جنان العبقري)
  // =========================================================================
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

  // كائن لتجميع البيانات النظيفة لتمريرها للمرحلة القادمة
  let accumulatedCleanEnv: Record<string, string> = {};

  // 🚀 خريطة ذكية لحفظ مرجع: [المفتاح] -> { اسم الملف، رقم السطر الحقيقي }
  const envMetaDataRegistry: Record<string, { fileName: string; line: number }> = {};

  targetFiles.forEach((file) => {
    try {
      const result = parseEnvFile(file);
      totalParsedLines += result.parsedLines.length;

      // تجميع المتغيرات السليمة من البارسر
      if (result.parsedData) {
        accumulatedCleanEnv = { ...accumulatedCleanEnv, ...result.parsedData };
        
        // تسجيل ميتا داتا الأسطر لكل مفتاح تم قراءته
        result.parsedLines.forEach((p) => {
          envMetaDataRegistry[p.key] = { fileName: file, line: p.line };
        });
      }

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
      });
    }
  });

  sEnv.stop("Configuration syntax analysis complete!");

  // =========================================================================
  // المرحلة 2: الـ Semantic Validation والـ Presets (التدفق المتوازي والمدمج)
  // =========================================================================
  
  // 🚀 التعديل الجوهري: تم إلغاء فحص hasSyntaxErrors لكي يعمل الفاليديشن والسنتناكس معاً دائماً
  if (Object.keys(accumulatedCleanEnv).length > 0) {
    const sGuard = x.spinner();
    sGuard.start("🛡️ Guarding environment logic and cloud presets...");

    try {
      // استدعاء دالة الفحص
      await createEnv({
        extends: ["vercel", "neon", "supabase"], 
        runtimeEnvStrict: accumulatedCleanEnv, 
        emptyStringAsUndefined: true,
      });

      sGuard.stop("Cloud presets and semantic validations passed!");
    } catch (validationError: any) {
      sGuard.stop("Validation issues detected in configuration values!");
      
      if (validationError && validationError.errors && Array.isArray(validationError.errors)) {
        validationError.errors.forEach((err: any) => {
          const fieldPath = err.path ? err.path.join('.') : 'UNKNOWN';
          
          // 🚀 استدعاء رقم السطر والملف الحقيقيين من الـ Registry بأمان تام وبدون مشاكل Scope
          const meta = envMetaDataRegistry[fieldPath] || { fileName: ".env", line: 0 };

          envIssues.push({
            fileName: meta.fileName, 
            line: meta.line, 
            severity: "error",
            message: `[Preset Violation] Field '${styleText("yellow", fieldPath)}': ${err.message}`,
          });
        });
      } else {
        envIssues.push({
          fileName: ".env",
          line: 0,
          severity: "error",
          message: validationError?.message || String(validationError),
        });
      }
    }
  }

  // عرض المشاكل المجمعة (سنتاكس + سيمانتيك)
  if (envIssues.length > 0) {
    x.log.warn(
      styleText(
        "yellow",
        `Found ${envIssues.length} issue(s) in your .env files:`,
      ),
    );
  const syntaxIssues = envIssues.filter(issue => !issue.message.includes("[Preset Violation]"));
    if (syntaxIssues.length > 0) {
      console.log(`\n  ${styleText(["cyan", "bold"], "── Syntax & Formatting Issues 📋 ──────────────────")}`);
      syntaxIssues.forEach((issue) => {
        const isError = issue.severity === "error";
        const badgeColor = isError ? ["bgRed", "white"] : ["bgYellow", "black"];
        const badgeText = isError ? " ERROR " : " WARN  ";
        const fileAndLine = `${styleText("cyan", issue.fileName)}:${styleText("dim", String(issue.line))}`;
        const prefix = `${styleText(badgeColor as any, badgeText)} [${fileAndLine}]`;
        console.log(`    ${prefix} ${issue.message}`);
      });
    }

    // 2. تصفية وطباعة أخطاء الفاليديشن والقيم (التي تأتي من الـ Presets)
    const validationIssues = envIssues.filter(issue => issue.message.includes("[Preset Violation]"));
    if (validationIssues.length > 0) {
      console.log(`\n  ${styleText(["magenta", "bold"], "── Semantic & Preset Violations 🛡️ ────────────────")}`);
      validationIssues.forEach((issue) => {
        const badgeColor = ["bgRed", "white"];
        const badgeText = " ERROR ";
        const fileAndLine = `${styleText("cyan", issue.fileName)}:${styleText("dim", String(issue.line))}`;
        const prefix = `${styleText(badgeColor as any, badgeText)} [${fileAndLine}]`;
        
        // تنظيف الرسالة من كلمة [Preset Violation] الداخلية عشان الـ UI يطلع أرتب
        const cleanMessage = issue.message.replace("[Preset Violation] ", "");
        console.log(`    ${prefix} ${cleanMessage}`);
      });
    }
    
    console.log("\n");
  } else {
    x.log.success(
      styleText(
        "green",
        "✔ Environment configurations are clean. No syntax errors or leaks found!",
      ),
    );
    console.log("");
  }

  // =========================================================================
  // المرحلة 3: فحص الـ Dependencies (ثابت كما هو)
  // =========================================================================
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
      const prefix = `${styleText(["bgRed", "white"], " VULN    ")} [${fileAndLine}]`;
      console.log(`  ${prefix} ${issue.message}`);
    });
    console.log("");

    if (process.env.GEMINI_API_KEY) {
      try {
        const packageJsonRaw = fs.readFileSync("package.json", "utf8");
        const packageJson = JSON.parse(packageJsonRaw);

        const allDependencies = {
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {}),
        };

        await generateFixRecommendations(npmIssues, allDependencies);
      } catch (e) {
        await generateFixRecommendations(npmIssues, {});
      }
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

  // =========================================================================
  // المرحلة 4: ملخص التقرير والنهو (Summary & Outro)
  // =========================================================================
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