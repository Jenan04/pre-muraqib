// src/core/EngineDetector.ts

import * as fs from "node:fs";
import * as path from "node:path";

export type ValidationEngine = "zod" | "valibot" | "arktype" | "custom";

export function detectValidationEngine(): ValidationEngine {
  const pkgPath = path.join(process.cwd(), "package.json");

  // لو مفيش package.json، نرجع الـ custom engine مباشرة
  if (!fs.existsSync(pkgPath)) {
    return "custom";
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

    // نجمع كل الـ dependencies في مكان واحد
    const allDeps: Record<string, string> = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    // الأولوية: zod أولاً لأنه الأكثر شيوعاً
    if ("zod" in allDeps)     return "zod";
    if ("valibot" in allDeps) return "valibot";
    if ("arktype" in allDeps) return "arktype";

    return "custom";

  } catch {
    // لو الـ package.json خربان، نرجع custom بأمان
    return "custom";
  }
}