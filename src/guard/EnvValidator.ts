import type{ GuardOptions } from "../types/interface.js";
import { getPresetSchema } from "./presets.ts";
import { validateCacheRules } from "./rules/cache-guard.js";

/**
 * 🛡️ المحرك المركزي لفحص البيئات أوفلاين بالكامل (Offline-First)
 */
export async function createEnv(opts: GuardOptions) {
  // الاعتماد كلياً وبشكل صارم على الـ Object الممرر من بارسر جنان
  const processedEnv = { ...(opts.runtimeEnvStrict || {}) };

  // 🧹 مرحلة التطهير البرمجي أوفلاين: تحويل النصوص الفارغة إلى undefined
  const shouldSanitize = opts.emptyStringAsUndefined ?? true;
  if (shouldSanitize) {
    for (const key in processedEnv) {
      if (processedEnv[key] === "") {
        processedEnv[key] = undefined as any;
      }
    }
  }

  const allErrors: Array<{ path: string[]; message: string }> = [];

  // 1. فحص قواعد الكاش المحلية أوفلاين
  const cacheErrors = validateCacheRules(processedEnv);
  allErrors.push(...cacheErrors);

  // 2. فحص الـ Presets المطلوبة ديناميكياً وأوفلاين
  const activePresets = opts.extends || ["vercel", "neon", "supabase"];
  
  for (const preset of activePresets) {
    const presetResult = await getPresetSchema(preset, processedEnv);
    if (!presetResult.success) {
      allErrors.push(...presetResult.errors);
    }
  }

  // إذا تم العثور على أخطاء سيمانتيك، نرفعها فوراً ليلقطها الـ CLI ويعرضها بألوانك
  if (allErrors.length > 0) {
    const validationError = new Error("Muraqib Semantic Validation Failed");
    (validationError as any).errors = allErrors;
    throw validationError;
  }

  return processedEnv;
}

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