// import * as v from "valibot";

// const PRESET_RULES: Record<string, Record<string, any>> = {
//   // ─── APP CORE ───
//   app: {
//     NODE_ENV: v.picklist(["development", "production", "test", "staging"], "NODE_ENV must be one of: development, production, test, staging."),
//     PORT: v.pipe(v.string(), v.regex(/^\d+$/, "Port must be a valid digits string."), v.transform(Number), v.number(), v.minValue(1024, "Port must be >= 1024"), v.maxValue(65535, "Port must be <= 65535")),
//     CORS_ORIGIN: v.pipe(v.string(), v.check(val => val === "*" || val.startsWith("http://") || val.startsWith("https://"), "CORS_ORIGIN must be a valid URL (http/https) or '*'")),
//     LOG_LEVEL: v.picklist(["info", "warn", "error", "debug"]),
//   },

//   // ─── AUTHENTICATION ───
//   auth: {
//     JWT_SECRET: v.pipe(v.string(), v.minLength(32, "JWT Secret must be at least 32 characters long.")),
//     NEXTAUTH_SECRET: v.pipe(v.string(), v.minLength(32, "NextAuth Secret must be at least 32 characters long.")),
//     NEXTAUTH_URL: v.pipe(v.string(), v.url("NEXTAUTH_URL must be a valid absolute application URL.")),
//   },

//   // ─── CLOUD PROVIDERS & CLOUDINARY ───
//   aws: {
//     AWS_ACCESS_KEY_ID: v.pipe(v.string(), v.regex(/^(AKIA|ASIA)[0-9A-Z]{16}$/, "AWS Access Key ID must start with AKIA/ASIA and be exactly 20 characters.")),
//     AWS_SECRET_ACCESS_KEY: v.pipe(v.string(), v.regex(/^[A-Za-z0-9/+=]{40}$/, "AWS Secret Access Key must be exactly 40 base64 characters.")),
//     AWS_REGION: v.pipe(v.string(), v.regex(/^[a-z]{2}-[a-z]+-\d$/, "Invalid AWS Region format (e.g., us-east-1).")),
//     AWS_BUCKET_NAME: v.pipe(v.string(), v.minLength(3), v.maxLength(63, "AWS S3 Bucket name must be between 3 and 63 characters.")),
//   },
//   cloudinary: {
//     CLOUDINARY_URL: v.pipe(v.string(), v.check(val => val.startsWith("cloudinary://"), "Cloudinary URL must start with 'cloudinary://'.")),
//     CLOUDINARY_CLOUD_NAME: v.string(),
//     CLOUDINARY_API_KEY: v.string(),
//     CLOUDINARY_API_SECRET: v.string(),
//   },

//   // ─── DATABASES ───
//   supabase: {
//     SUPABASE_URL: v.pipe(v.string(), v.url("Must be a valid secured Supabase project URL (https://...).")),
//     SUPABASE_ANON_KEY: v.pipe(v.string(), v.minLength(50, "Supabase Anon Key looks truncated or too short.")),
//   },
//   neon: {
//     DATABASE_URL: v.pipe(v.string(), v.regex(/^postgres(ql)?:\/\//, "Must be a valid Neon PostgreSQL connection string.")),
//   },
//   pg: {
//     PGHOST: v.pipe(v.string(), v.minLength(1, "PostgreSQL Host cannot be empty.")),
//     PGPORT: v.pipe(v.string(), v.regex(/^\d+$/), v.transform(Number), v.number(), v.minValue(1), v.maxValue(65535)),
//     PGUSER: v.string(),
//     PGPASSWORD: v.string(),
//     PGDATABASE: v.string(),
//   },
//   mongodb: {
//     MONGODB_URI: v.pipe(v.string(), v.regex(/^mongodb(\+srv)?:\/\//, "Must be a valid MongoDB Atlas connection string starting with mongodb:// or mongodb+srv://.")),
//   },
//   redis: {
//     REDIS_URL: v.pipe(v.string(), v.regex(/^rediss?:\/\//, "Must be a valid Redis connection string starting with redis:// or rediss://.")),
//   }
// };

// export function runValibotValidation(runtimeEnv: Record<string, string>, presets: string[]) {
//   const errors: { path: string[]; message: string }[] = [];
//   const combinedSchemaShape: Record<string, any> = {};
//   const presetKeys = new Set<string>();

//   const targetPresets = Array.from(new Set(["app", ...presets.map(p => p.toLowerCase())]));

//   targetPresets.forEach((preset) => {
//     const rules = PRESET_RULES[preset];
//     if (rules) {
//       Object.keys(rules).forEach((key) => {
//         combinedSchemaShape[key] = v.optional(rules[key]);
//         presetKeys.add(key);
//       });
//     }
//   });

//   // الفحص التلقائي لروابط الـ URL المخصصة
//   Object.keys(runtimeEnv).forEach((key) => {
//     if ((key.endsWith("_URL") || key.endsWith("_URI")) && !presetKeys.has(key)) {
//       combinedSchemaShape[key] = v.optional(v.pipe(v.string(), v.check(val => /^(https?|postgres(ql)?|mongodb(\+srv)?|redis(s)?|cloudinary):\/\//.test(val), "Field suggests a URL/URI format but lacks a valid standard protocol prefix.")));
//       presetKeys.add(key);
//     }
//   });

//   const schema = v.object(combinedSchemaShape);
//   const result = v.safeParse(schema, runtimeEnv);

//   if (!result.success) {
//     result.issues.forEach((issue) => {
//       const path = issue.path ? issue.path.map((p: any) => String(p.key)) : ["UNKNOWN"];
//       errors.push({ path, message: issue.message });
//     });
//   }

//   const unknownKeys = Object.keys(runtimeEnv).filter((key) => !presetKeys.has(key));
//   return { errors, unknownKeys };
// }
// src/guard/engines/valibot.engine.ts

import * as v from "valibot";
import { PRESET_RULES, validateField, detectPresets } from "../rules/preset-rules.js";

function buildValibotSchema(presets: string[], runtimeEnv: Record<string, string>) {
  const shape: Record<string, any> = {};
  const presetKeys = new Set<string>();

  presets.forEach((preset) => {
    const rules = PRESET_RULES[preset];
    if (!rules) return;

    Object.entries(rules).forEach(([key, rule]) => {
      shape[key] = v.optional(
        v.pipe(
          v.string(),
          v.check(
            (val) => validateField(key, val, rule) === null,
            rule.message
          )
        )
      );
      presetKeys.add(key);
    });
  });

  // فحص أي _URL أو _URI مش في الـ presets
  Object.keys(runtimeEnv).forEach((key) => {
    if ((key.endsWith("_URL") || key.endsWith("_URI")) && !presetKeys.has(key)) {
      shape[key] = v.optional(
        v.pipe(
          v.string(),
          v.check(
            (val) => /^(https?|postgres(ql)?|mongodb(\+srv)?|rediss?|cloudinary):\/\//.test(val),
            "Field suggests a URL/URI format but lacks a valid protocol prefix."
          )
        )
      );
      presetKeys.add(key);
    }
  });

  return { schema: v.object(shape), presetKeys };
}

export function runValibotValidation(
  runtimeEnv: Record<string, string>,
  presets?: string[]
): { errors: { path: string[]; message: string }[]; unknownKeys: string[] } {

  const activePresets = presets ?? detectPresets(runtimeEnv);
  const { schema, presetKeys } = buildValibotSchema(activePresets, runtimeEnv);
  const errors: { path: string[]; message: string }[] = [];

  const result = v.safeParse(schema, runtimeEnv);

  if (!result.success) {
    result.issues.forEach((issue) => {
      const path = issue.path
        ? issue.path.map((p: any) => String(p.key))
        : ["UNKNOWN"];
      errors.push({ path, message: issue.message });
    });
  }

  const unknownKeys = Object.keys(runtimeEnv).filter((k) => !presetKeys.has(k));
  return { errors, unknownKeys };
}