// import { type } from "arktype";

// const PRESET_RULES: Record<string, Record<string, string>> = {
//   app: {
//     NODE_ENV: "'development'|'production'|'test'|'staging'",
//     PORT: "string.integer", // التحقق الأولي كـ String يمثل رقماً
//     CORS_ORIGIN: "string",
//     LOG_LEVEL: "'info'|'warn'|'error'|'debug'",
//   },
//   auth: {
//     JWT_SECRET: "string>=32",
//     NEXTAUTH_SECRET: "string>=32",
//     NEXTAUTH_URL: "string.url",
//   },
//   aws: {
//     AWS_ACCESS_KEY_ID: "string",
//     AWS_SECRET_ACCESS_KEY: "string",
//     AWS_REGION: "string",
//     AWS_BUCKET_NAME: "string>=3",
//   },
//   cloudinary: {
//     CLOUDINARY_URL: "string",
//     CLOUDINARY_CLOUD_NAME: "string",
//     CLOUDINARY_API_KEY: "string",
//     CLOUDINARY_API_SECRET: "string",
//   },
//   supabase: {
//     SUPABASE_URL: "string.url",
//     SUPABASE_ANON_KEY: "string>=50",
//   },
//   neon: {
//     DATABASE_URL: "string",
//   },
//   pg: {
//     PGHOST: "string",
//     PGPORT: "string.integer",
//     PGUSER: "string",
//     PGPASSWORD: "string",
//     PGDATABASE: "string",
//   },
//   mongodb: {
//     MONGODB_URI: "string",
//   },
//   redis: {
//     REDIS_URL: "string",
//   }
// };

// // خرائط الرسائل المخصصة لجعل مخرجات Arktype مطابقة تماماً للمواصفات الأمنية
// const CUSTOM_MESSAGES: Record<string, string> = {
//   JWT_SECRET: "JWT Secret must be at least 32 characters long.",
//   NEXTAUTH_SECRET: "NextAuth Secret must be at least 32 characters long.",
//   SUPABASE_URL: "Must be a valid secured Supabase project URL (https://...).",
//   SUPABASE_ANON_KEY: "Supabase Anon Key looks truncated or too short.",
//   PORT: "Port must be a valid integer network port.",
//   NODE_ENV: "NODE_ENV must be one of: development, production, test, staging."
// };

// export function runArktypeValidation(runtimeEnv: Record<string, string>, presets: string[]) {
//   const errors: { path: string[]; message: string }[] = [];
//   const combinedSchemaShape: Record<string, string> = {};
//   const presetKeys = new Set<string>();

//   const targetPresets = Array.from(new Set(["app", ...presets.map(p => p.toLowerCase())]));

//   targetPresets.forEach((preset) => {
//     const rules = PRESET_RULES[preset];
//     if (rules) {
//       Object.keys(rules).forEach((key) => {
//         combinedSchemaShape[`${key}?`] = rules[key]; // جعل الحقول Optional في Arktype باستخدام علامة الاستفهام
//         presetKeys.add(key);
//       });
//     }
//   });

//   // فحص أولي للمنافذ مانيولي لتجنب القيود الإضافية داخل Arktype
//   if (runtimeEnv.PORT) {
//     const pNum = Number(runtimeEnv.PORT);
//     if (isNaN(pNum) || pNum < 1024 || pNum > 65535) {
//       errors.push({ path: ["PORT"], message: "Port must be a valid network integer between 1024 and 65535." });
//     }
//   }

//   // بناء الاسكيما وفحصها
//   const schema = type(combinedSchemaShape);
//   const result = schema(runtimeEnv);

//   if (result instanceof type.errors) {
//     result.forEach((err) => {
//       const field = String(err.path[0]);
//       // تجنب تكرار خطأ البورت لو لُقط بالأعلى
//       if (field === "PORT" && errors.some(e => e.path.includes("PORT"))) return;
      
//       errors.push({
//         path: [field],
//         message: CUSTOM_MESSAGES[field] || err.message,
//       });
//     });
//   }

//   const unknownKeys = Object.keys(runtimeEnv).filter((key) => !presetKeys.has(key));
//   return { errors, unknownKeys };
// }
// src/guard/engines/arktype.engine.ts

import { type } from "arktype";
import { PRESET_RULES, validateField, detectPresets } from "../rules/preset-rules.js";

function buildArktypeSchema(presets: string[], runtimeEnv: Record<string, string>) {
  const shape: Record<string, string> = {};
  const presetKeys = new Set<string>();

  presets.forEach((preset) => {
    const rules = PRESET_RULES[preset];
    if (!rules) return;

    Object.entries(rules).forEach(([key, rule]) => {
      // ArkType syntax: "key?" للـ optional
      shape[`${key}?`] = "string";
      presetKeys.add(key);
    });
  });

  // فحص أي _URL أو _URI مش في الـ presets
  Object.keys(runtimeEnv).forEach((key) => {
    if ((key.endsWith("_URL") || key.endsWith("_URI")) && !presetKeys.has(key)) {
      shape[`${key}?`] = "string";
      presetKeys.add(key);
    }
  });

  return { schema: type(shape), presetKeys };
}

export function runArktypeValidation(
  runtimeEnv: Record<string, string>,
  presets?: string[]
): { errors: { path: string[]; message: string }[]; unknownKeys: string[] } {

  const activePresets = presets ?? detectPresets(runtimeEnv);
  const { schema, presetKeys } = buildArktypeSchema(activePresets, runtimeEnv);
  const errors: { path: string[]; message: string }[] = [];

  // ArkType يتحقق من الـ shape أولاً
  const result = schema(runtimeEnv);

  if (result instanceof type.errors) {
    result.forEach((err) => {
      const field = String(err.path[0]);
      errors.push({
        path: [field],
        message: err.message,
      });
    });
  }

  // ✅ الفحص العميق — نستخدم validateField من preset-rules مباشرة
  // هذا هو السر: ArkType يتحقق من الـ types، ونحن نتحقق من الـ rules
  activePresets.forEach((preset) => {
    const rules = PRESET_RULES[preset];
    if (!rules) return;

    Object.entries(rules).forEach(([key, rule]) => {
      const value = runtimeEnv[key];

      // تخطي لو القيمة مش موجودة (optional)
      if (!value) return;

      // تخطي لو في error على هذا الحقل بالفعل
      if (errors.some((e) => e.path[0] === key)) return;

      const errorMessage = validateField(key, value, rule);
      if (errorMessage) {
        errors.push({ path: [key], message: errorMessage });
      }
    });
  });

  // فحص الـ _URL و _URI
  Object.keys(runtimeEnv).forEach((key) => {
    if ((key.endsWith("_URL") || key.endsWith("_URI")) && presetKeys.has(key)) {
      const value = runtimeEnv[key];
      if (!value) return;
      if (errors.some((e) => e.path[0] === key)) return;

      if (!/^(https?|postgres(ql)?|mongodb(\+srv)?|rediss?|cloudinary):\/\//.test(value)) {
        errors.push({
          path: [key],
          message: "Field suggests a URL/URI format but lacks a valid protocol prefix.",
        });
      }
    }
  });

  const unknownKeys = Object.keys(runtimeEnv).filter((k) => !presetKeys.has(k));
  return { errors, unknownKeys };
}