// import type{ GuardOptions } from "../types/interface.js";
// import { getPresetSchema } from "./presets.ts";
// import { validateCacheRules } from "./rules/cache-guard.js";

// /**
//  * 🛡️ المحرك المركزي لفحص البيئات أوفلاين بالكامل (Offline-First)
//  */
// export async function createEnv(opts: GuardOptions) {
//   // الاعتماد كلياً وبشكل صارم على الـ Object الممرر من بارسر جنان
//   const processedEnv = { ...(opts.runtimeEnvStrict || {}) };

//   // 🧹 مرحلة التطهير البرمجي أوفلاين: تحويل النصوص الفارغة إلى undefined
//   const shouldSanitize = opts.emptyStringAsUndefined ?? true;
//   if (shouldSanitize) {
//     for (const key in processedEnv) {
//       if (processedEnv[key] === "") {
//         processedEnv[key] = undefined as any;
//       }
//     }
//   }

//   const allErrors: Array<{ path: string[]; message: string }> = [];

//   // 1. فحص قواعد الكاش المحلية أوفلاين
//   const cacheErrors = validateCacheRules(processedEnv);
//   allErrors.push(...cacheErrors);

//   // 2. فحص الـ Presets المطلوبة ديناميكياً وأوفلاين
//   const activePresets = opts.extends || ["vercel", "neon", "supabase"];
  
//   for (const preset of activePresets) {
//     const presetResult = await getPresetSchema(preset, processedEnv);
//     if (!presetResult.success) {
//       allErrors.push(...presetResult.errors);
//     }
//   }

//   // إذا تم العثور على أخطاء سيمانتيك، نرفعها فوراً ليلقطها الـ CLI ويعرضها بألوانك
//   if (allErrors.length > 0) {
//     const validationError = new Error("Muraqib Semantic Validation Failed");
//     (validationError as any).errors = allErrors;
//     throw validationError;
//   }

//   return processedEnv;
// }

// src/guard/EnvValidator.ts

// import type { GuardOptions } from "../types/interface.js";
// import { getPresetSchema } from "./presets.js"; // 👈 تم تعديل الامتداد لـ .js ليطابق معايير الـ ESM
// import { validateCacheRules } from "./rules/cache-guard.js";

// export async function createEnv(opts: GuardOptions) {
//   const processedEnv = { ...(opts.runtimeEnvStrict || {}) };

//   const shouldSanitize = opts.emptyStringAsUndefined ?? true;
//   if (shouldSanitize) {
//     for (const key in processedEnv) {
//       if (processedEnv[key] === "") {
//         processedEnv[key] = undefined as any;
//       }
//     }
//   }

//   const allErrors: Array<{ path: string[]; message: string }> = [];

//   const cacheErrors = validateCacheRules(processedEnv);
//   allErrors.push(...cacheErrors);

//   const activePresets = opts.extends || ["vercel", "neon", "supabase"];
  
//   for (const preset of activePresets) {
//     const presetResult = await getPresetSchema(preset, processedEnv);
//     if (!presetResult.success) {
//       allErrors.push(...presetResult.errors);
//     }
//   }

//   if (allErrors.length > 0) {
//     const validationError = new Error("Muraqib Semantic Validation Failed");
//     (validationError as any).errors = allErrors;
//     throw validationError;
//   }

//   return processedEnv;
// }


// src/guard/EnvValidator.ts

import { detectValidationEngine } from "./core/EngineDetector.js";
import { detectPresets } from "./rules/preset-rules.ts";
import { runZodValidation } from "./engines/zodEngine.ts";
import { runValibotValidation } from "./engines/valibotEngine.js";
import { runArktypeValidation } from "./engines/arktypeEngine.js";
import { runCustomValidation } from "./engines/customEngine.js";
import type { GuardOptions } from "../types/interface.js";

export async function createEnv(opts: GuardOptions) {
  const processedEnv = { ...(opts.runtimeEnvStrict ?? {}) };

  // تنظيف القيم الفارغة
  if (opts.emptyStringAsUndefined ?? true) {
    for (const key in processedEnv) {
      if (processedEnv[key] === "") {
        delete processedEnv[key];
      }
    }
  }

  // ✅ auto-detect الـ presets من الـ env نفسه
  const activePresets = opts.extends ?? detectPresets(processedEnv);

  // ✅ detect الـ engine من package.json المستخدم
  const engine = detectValidationEngine();

  let result: { errors: { path: string[]; message: string }[]; unknownKeys: string[] };

  switch (engine) {
    case "zod":
      result = runZodValidation(processedEnv, activePresets);
      break;
    case "valibot":
      result = runValibotValidation(processedEnv, activePresets);
      break;
    case "arktype":
      result = runArktypeValidation(processedEnv, activePresets);
      break;
    default:
      result = runCustomValidation(processedEnv, activePresets);
  }

  // رفع الأخطاء للـ cli.ts
  if (result.errors.length > 0) {
    const validationError = new Error("Muraqib Semantic Validation Failed");
    (validationError as any).errors = result.errors;
    (validationError as any).unknownKeys = result.unknownKeys;
    (validationError as any).engine = engine; // ← مهم للـ UI
    throw validationError;
  }

  return { env: processedEnv, unknownKeys: result.unknownKeys, engine };
}