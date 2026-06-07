import * as fs from "node:fs"; 
import type { parsedLine, syntaxIssue } from "../types/interface.js";

export function parseEnvFile(filePath: string) {
  const parsedLines: parsedLine[] = [];
  const issues: syntaxIssue[] = [];
  const seenKeys = new Set<string>();
  const parsedData: Record<string, string> = {}; 

  if (!fs.existsSync(filePath)) {
    throw new Error(`Target file not found at: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const allLines = content.split("\n"); // 👈 تعريفه هنا سليم

  const VALID_LINE_REGEX = /^\s*([a-zA-Z_][\w]*)\s*=\s*(.*)?\s*$/;

  allLines.forEach((lineContent, index) => {
    const lineNum = index + 1;
    const trimmed = lineContent.trim();

    // 1. تخطي السطور الفارغة والتعليقات
    if (!trimmed || trimmed.startsWith("#")) {
      return; // الـ return هنا مسموحة لأنها داخل الـ forEach لتخطي السطر الحالي فقط
    }

    // 2. فحص وجود علامة اليساوي
    if (!trimmed.includes("=")) {
      issues.push({
        line: lineNum,
        type: "syntax",
        severity: "error",
        message: "Malformed line: Missing equals sign (=) separator.",
      });
      return; 
    }

    const match = trimmed.match(VALID_LINE_REGEX);

    // 3. فحص تسمية المفتاح (Key)
    if (!match) {
      issues.push({
        line: lineNum,
        type: "syntax",
        severity: "error",
        message: "Invalid Environment Variable name. Keys must start with a letter or underscore and contain only alphanumeric characters.",
      });
      return; 
    }

    const key = match[1];
    let value = match[2] ? match[2].trim() : "";

    // تنظيف التعليقات الجانبية لو وجدت
    if (value.includes("#")) {
      value = value.split("#")[0].trim();
    }

    const startsWithQuote = value.startsWith('"') || value.startsWith("'");
    const endsWithQuote = value.endsWith('"') || value.endsWith("'");
    const matchesPerfect =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));

    let hasSyntaxError = false;

    // 4. فحص علامات الاقتباس (Quotes)
    if (startsWithQuote || endsWithQuote) {
      if (!matchesPerfect) {
        issues.push({
          line: lineNum,
          type: "syntax",
          severity: "error",
          message: "Malformed value: Unmatched or missing quotes around the variable value.",
        });
        hasSyntaxError = true; // نرفع الراية عشان السنتاكس خربان بس ما بنعمل return!
      } else {
        value = value.slice(1, -1).trim();
      }
    } else {
      // 5. فحص المسافات بدون اقتباس
      if (value.includes(" ")) {
        issues.push({
          line: lineNum,
          type: "syntax",
          severity: "error",
          message: `Malformed value: Values with spaces must be enclosed in quotes (e.g., KEY="value with spaces").`,
        });
        hasSyntaxError = true; // نرفع الراية
      }
    }

    // 6. فحص التكرار (Duplicate Keys)
    if (seenKeys.has(key)) {
      issues.push({
        line: lineNum,
        type: "syntax",
        severity: "warning",
        message: `Duplicate key detected: "${key}" is defined multiple times. Subsequent values will overwrite it.`,
        key,
      });
    } else {
      seenKeys.add(key);
    }

    // ضخ البيانات للـ Lines للتوثيق في الـ CLI
    parsedLines.push({
      line: lineNum,
      key,
      value,
    });

    // 🚀 التدفق الذهبي: بنمرر الداتا للـ parsedData دائماً لكي يراها الـ Semantic Validator ويفحص الـ URLs حتى لو السنتاكس مشوه!
    parsedData[key] = value; 
  });

  return { parsedLines, issues, parsedData };
}