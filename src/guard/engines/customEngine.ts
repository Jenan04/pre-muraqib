// export function runCustomValidation(runtimeEnv: Record<string, string>, presets: string[]) {
//   const errors: { path: string[]; message: string }[] = [];
//   const checkedKeys = new Set<string>();
//   const lowerPresets = presets.map(p => p.toLowerCase());

//   // =========================================================================
//   // 1. فحص متغيرات التطبيق الأساسية (App Core & Server Configurations)
//   // =========================================================================
  
//   if (runtimeEnv.NODE_ENV) {
//     checkedKeys.add("NODE_ENV");
//     const allowed = ["development", "production", "test", "staging"];
//     if (!allowed.includes(runtimeEnv.NODE_ENV.toLowerCase())) {
//       errors.push({ path: ["NODE_ENV"], message: "NODE_ENV must be one of: development, production, test, staging." });
//     }
//   }

//   if (runtimeEnv.PORT) {
//     checkedKeys.add("PORT");
//     const portNum = Number(runtimeEnv.PORT);
//     if (isNaN(portNum) || !Number.isInteger(portNum) || portNum < 1024 || portNum > 65535) {
//       errors.push({ path: ["PORT"], message: "Port must be a valid network integer between 1024 and 65535." });
//     }
//   }

//   if (runtimeEnv.CORS_ORIGIN) {
//     checkedKeys.add("CORS_ORIGIN");
//     // فحص لو كان الرابط مش مبلش بـ http أو https أو ليس * (كل النطاقات)
//     if (runtimeEnv.CORS_ORIGIN !== "*" && !runtimeEnv.CORS_ORIGIN.startsWith("http://") && !runtimeEnv.CORS_ORIGIN.startsWith("https://")) {
//       errors.push({ path: ["CORS_ORIGIN"], message: "CORS_ORIGIN must be a valid URL (http/https) or '*'." });
//     }
//   }

//   if (runtimeEnv.LOG_LEVEL) {
//     checkedKeys.add("LOG_LEVEL");
//     const allowedLogs = ["info", "warn", "error", "debug"];
//     if (!allowedLogs.includes(runtimeEnv.LOG_LEVEL.toLowerCase())) {
//       errors.push({ path: ["LOG_LEVEL"], message: "LOG_LEVEL must be one of: info, warn, error, debug." });
//     }
//   }

//   // =========================================================================
//   // 2. فحص الـ Authentication & Tokens (NextAuth, JWT, OAuth)
//   // =========================================================================
  
//   if (lowerPresets.includes("auth") || runtimeEnv.JWT_SECRET || runtimeEnv.NEXTAUTH_SECRET) {
//     // فحص قوة الـ Secrets لمنع الـ Brute Force
//     ["JWT_SECRET", "NEXTAUTH_SECRET", "APP_SECRET", "SESSION_SECRET"].forEach(key => {
//       if (runtimeEnv[key]) {
//         checkedKeys.add(key);
//         if (runtimeEnv[key].length < 32) {
//           errors.push({ path: [key], message: "Cryptographic secret is weak! Must be at least 32 characters long." });
//         }
//       }
//     });

//     if (runtimeEnv.NEXTAUTH_URL) {
//       checkedKeys.add("NEXTAUTH_URL");
//       if (!runtimeEnv.NEXTAUTH_URL.startsWith("http://") && !runtimeEnv.NEXTAUTH_URL.startsWith("https://")) {
//         errors.push({ path: ["NEXTAUTH_URL"], message: "NEXTAUTH_URL must be a valid absolute application URL." });
//       }
//     }
//   }

//   // =========================================================================
//   // 3. فحص الـ Cloud Providers (AWS & Cloudinary)
//   // =========================================================================
  
//   if (lowerPresets.includes("aws") || runtimeEnv.AWS_ACCESS_KEY_ID) {
//     if (runtimeEnv.AWS_ACCESS_KEY_ID) {
//       checkedKeys.add("AWS_ACCESS_KEY_ID");
//       if (!/^(AKIA|ASIA)[0-9A-Z]{16}$/.test(runtimeEnv.AWS_ACCESS_KEY_ID)) {
//         errors.push({ path: ["AWS_ACCESS_KEY_ID"], message: "AWS Access Key ID must start with AKIA/ASIA and be exactly 20 uppercase alphanumeric characters." });
//       }
//     }
//     if (runtimeEnv.AWS_SECRET_ACCESS_KEY) {
//       checkedKeys.add("AWS_SECRET_ACCESS_KEY");
//       if (!/^[A-Za-z0-9/+=]{40}$/.test(runtimeEnv.AWS_SECRET_ACCESS_KEY)) {
//         errors.push({ path: ["AWS_SECRET_ACCESS_KEY"], message: "AWS Secret Access Key must be exactly 40 base64 characters." });
//       }
//     }
//     if (runtimeEnv.AWS_REGION) {
//       checkedKeys.add("AWS_REGION");
//       if (!/^[a-z]{2}-[a-z]+-\d$/.test(runtimeEnv.AWS_REGION)) {
//         errors.push({ path: ["AWS_REGION"], message: "Invalid AWS Region format (e.g., us-east-1, eu-central-1)." });
//       }
//     }
//     if (runtimeEnv.AWS_BUCKET_NAME) {
//       checkedKeys.add("AWS_BUCKET_NAME");
//       if (runtimeEnv.AWS_BUCKET_NAME.length < 3 || runtimeEnv.AWS_BUCKET_NAME.length > 63) {
//         errors.push({ path: ["AWS_BUCKET_NAME"], message: "AWS S3 Bucket name must be between 3 and 63 characters long." });
//       }
//     }
//   }

//   // إضافة Cloudinary الشهيرة لرفع الصور
//   if (runtimeEnv.CLOUDINARY_URL || runtimeEnv.CLOUDINARY_CLOUD_NAME) {
//     if (runtimeEnv.CLOUDINARY_URL) {
//       checkedKeys.add("CLOUDINARY_URL");
//       if (!runtimeEnv.CLOUDINARY_URL.startsWith("cloudinary://")) {
//         errors.push({ path: ["CLOUDINARY_URL"], message: "Cloudinary connection string must start with 'cloudinary://'." });
//       }
//     }
//     ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].forEach(k => {
//       if (runtimeEnv[k]) checkedKeys.add(k);
//     });
//   }

//   // =========================================================================
//   // 4. فحص الـ Databases (PostgreSQL, Neon, Supabase, MongoDB, Redis)
//   // =========================================================================
  
//   if (lowerPresets.includes("supabase") || runtimeEnv.SUPABASE_URL) {
//     if (runtimeEnv.SUPABASE_URL) {
//       checkedKeys.add("SUPABASE_URL");
//       if (!runtimeEnv.SUPABASE_URL.startsWith("https://")) {
//         errors.push({ path: ["SUPABASE_URL"], message: "Must be a valid secured Supabase project URL (https://...)." });
//       }
//     }
//     if (runtimeEnv.SUPABASE_ANON_KEY) {
//       checkedKeys.add("SUPABASE_ANON_KEY");
//       if (runtimeEnv.SUPABASE_ANON_KEY.length < 50) {
//         errors.push({ path: ["SUPABASE_ANON_KEY"], message: "Supabase Anon Key looks truncated or too short." });
//       }
//     }
//   }

//   if (lowerPresets.includes("neon") || lowerPresets.includes("pg") || runtimeEnv.DATABASE_URL) {
//     if (runtimeEnv.DATABASE_URL) {
//       checkedKeys.add("DATABASE_URL");
//       if (!/^postgres(ql)?:\/\//.test(runtimeEnv.DATABASE_URL)) {
//         errors.push({ path: ["DATABASE_URL"], message: "Must be a valid PostgreSQL/Neon connection string starting with postgres:// or postgresql://." });
//       }
//     }
//     // فحص المتغيرات المفككة للـ Postgres
//     ["PGHOST", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGPORT"].forEach(k => {
//       if (runtimeEnv[k]) checkedKeys.add(k);
//     });
//     if (runtimeEnv.PGPORT) {
//       const pNum = Number(runtimeEnv.PGPORT);
//       if (isNaN(pNum) || pNum < 1 || pNum > 65535) {
//         errors.push({ path: ["PGPORT"], message: "PGPORT must be a valid integer between 1 and 65535." });
//       }
//     }
//   }

//   if (runtimeEnv.MONGODB_URI || runtimeEnv.MONGODB_URL) {
//     const mongoKey = runtimeEnv.MONGODB_URI ? "MONGODB_URI" : "MONGODB_URL";
//     checkedKeys.add(mongoKey);
//     if (!/^mongodb(\+srv)?:\/\//.test(runtimeEnv[mongoKey])) {
//       errors.push({ path: [mongoKey], message: "Must be a valid MongoDB Atlas connection string starting with mongodb:// or mongodb+srv://." });
//     }
//   }

//   if (runtimeEnv.REDIS_URL) {
//     checkedKeys.add("REDIS_URL");
//     if (!/^rediss?:\/\//.test(runtimeEnv.REDIS_URL)) {
//       errors.push({ path: ["REDIS_URL"], message: "Must be a valid Redis connection string starting with redis:// or rediss://." });
//     }
//   }

//   // =========================================================================
//   // 5. الفحص التلقائي الذكي للروابط (URL Safety Check)
//   // =========================================================================
//   // أي حقل ينتهي بـ _URL أو _URI ولم يتم فحص قواعده فوق، نمرر عليه فحص البروتوكول العام لمنع القيم المشوهة
//   Object.keys(runtimeEnv).forEach((key) => {
//     if (key.endsWith("_URL") || key.endsWith("_URI")) {
//       if (!checkedKeys.has(key)) {
//         const value = runtimeEnv[key];
//         if (value && !/^(https?|postgres(ql)?|mongodb(\+srv)?|redis(s)?|cloudinary):\/\//.test(value)) {
//           errors.push({ path: [key], message: `Field suggests a URL/URI format but lacks a valid standard protocol prefix.` });
//           checkedKeys.add(key);
//         }
//       }
//     }
//   });

//   // =========================================================================
//   // 6. تجميع الحقول المتبقية تماماً وإرسالها لـ مسار الـ AI
//   // =========================================================================
//   const unknownKeys = Object.keys(runtimeEnv).filter((key) => !checkedKeys.has(key));

//   // =========================================================================
// // 7. فحص إعدادات أداة مراقب الداخلية (Muraqib Internal OSV Configurations)
// // =========================================================================

// if (runtimeEnv.OSV_API_URL) {
//   checkedKeys.add("OSV_API_URL");
//   try {
//     // محاكاة لنفس اللوجيك اللي بريحك في الفايل تبع الـ Config
//     const parsed = new URL(runtimeEnv.OSV_API_URL);
//     if (!parsed.protocol.startsWith("http")) {
//       errors.push({ path: ["OSV_API_URL"], message: "OSV_API_URL must use HTTP or HTTPS protocol." });
//     }
//   } catch {
//     errors.push({ path: ["OSV_API_URL"], message: "OSV_API_URL is not a valid well-formed URL string." });
//   }
// } else {
//   // تذكير للمطور في حال نسي يضيف الرابط الأساسي لفحص الثغرات
//   errors.push({ path: ["OSV_API_URL"], message: "Missing critical configuration: OSV_API_URL is required for dependency auditing." });
// }

// if (runtimeEnv.OSV_TIMEOUT) {
//   checkedKeys.add("OSV_TIMEOUT");
//   const timeoutNum = Number(runtimeEnv.OSV_TIMEOUT);
//   if (isNaN(timeoutNum) || timeoutNum < 1000) {
//     errors.push({ path: ["OSV_TIMEOUT"], message: "OSV_TIMEOUT must be a valid number of milliseconds (minimum 1000ms)." });
//   }
// }

//   return { errors, unknownKeys };
 
// }

// src/guard/engines/custom.engine.ts
// ✅ لا يحتاج أي library خارجية — يعمل بـ validateField مباشرة

import { PRESET_RULES, validateField, detectPresets } from "../rules/preset-rules.js";

export function runCustomValidation(
  runtimeEnv: Record<string, string>,
  presets?: string[]
): { errors: { path: string[]; message: string }[]; unknownKeys: string[] } {

  const activePresets = presets ?? detectPresets(runtimeEnv);
  const errors: { path: string[]; message: string }[] = [];
  const checkedKeys = new Set<string>();

  // =========================================================================
  // الفحص الرئيسي — كل preset وكل field
  // =========================================================================
  activePresets.forEach((preset) => {
    const rules = PRESET_RULES[preset];
    if (!rules) return;

    Object.entries(rules).forEach(([key, rule]) => {
      checkedKeys.add(key);

      const value = runtimeEnv[key];

      // تخطي لو القيمة مش موجودة (optional)
      if (!value) return;

      const errorMessage = validateField(key, value, rule);
      if (errorMessage) {
        errors.push({ path: [key], message: errorMessage });
      }
    });
  });

  // =========================================================================
  // فحص أي _URL أو _URI مش في الـ presets
  // =========================================================================
  Object.keys(runtimeEnv).forEach((key) => {
    if ((key.endsWith("_URL") || key.endsWith("_URI")) && !checkedKeys.has(key)) {
      checkedKeys.add(key);
      const value = runtimeEnv[key];
      if (!value) return;

      if (!/^(https?|postgres(ql)?|mongodb(\+srv)?|rediss?|cloudinary):\/\//.test(value)) {
        errors.push({
          path: [key],
          message: "Field suggests a URL/URI format but lacks a valid protocol prefix.",
        });
      }
    }
  });

  const unknownKeys = Object.keys(runtimeEnv).filter((k) => !checkedKeys.has(k));
  return { errors, unknownKeys };
}