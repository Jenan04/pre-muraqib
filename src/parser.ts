import * as fs from "node:fs"; //existsSync(), readFileSync()
import type { parsedLine, syntaxIssue } from "./types/interface.js";

export function parseEnvFile(filePath: string) {
  const parsedLines: parsedLine[] = [];
  const issues: syntaxIssue[] = [];
  const seenKeys = new Set<string>();
  // Set is a built in object that has a `has()` method , it search inside the collection with constant complexity O(1) (hash table)
  // seenKeys.has(key)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Target file not found at: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const allLines = content.split("\n");

  const VALID_LINE_REGEX = /^\s*([a-zA-Z_][\w]*)\s*=\s*(.*)?\s*$/;
  // \s* => 0 or more than spaces
  // first letter should be re;ated to [a-zA-Z_]
  // [\w] word char(any letter, number, _)

  allLines.forEach((content, index) => {
    const lineNum = index + 1;
    const trimmed = content.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

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

    if (!match) {
      issues.push({
        line: lineNum,
        type: "syntax",
        severity: "error",
        message:
          "Invalid Environment Variable name. Keys must start with a letter or underscore and contain only alphanumeric characters.",
      });
      return;
    }

    const key = match[1];
    let value = match[2] ? match[2].trim() : "";

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }

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


    parsedLines.push({
      line: lineNum,
      key,
      value,
    });
  });

  return { parsedLines, issues };
}
