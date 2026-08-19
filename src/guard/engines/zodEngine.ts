// import { z } from "zod";

// const PRESET_RULES: Record<string, Record<string, z.ZodTypeAny>> = {
//   // ─── APP CORE ───
//   app: {
//     NODE_ENV: z.enum(["development", "production", "test", "staging"]),
//     PORT: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1024).max(65535)),
//     CORS_ORIGIN: z.string().refine(val => val === "*" || val.startsWith("http://") || val.startsWith("https://"), {
//       message: "CORS_ORIGIN must be a valid URL (http/https) or '*'"
//     }),
//     LOG_LEVEL: z.enum(["info", "warn", "error", "debug"]),
//   },

//   // ─── AUTHENTICATION ───
//   auth: {
//     JWT_SECRET: z.string().min(32, { message: "JWT Secret must be at least 32 characters long." }),
//     NEXTAUTH_SECRET: z.string().min(32, { message: "NextAuth Secret must be at least 32 characters long." }),
//     NEXTAUTH_URL: z.string().url({ message: "NEXTAUTH_URL must be a valid absolute application URL." }),
//   },

//   // ─── CLOUD PROVIDERS & CLOUDINARY ───
//   aws: {
//     AWS_ACCESS_KEY_ID: z.string().regex(/^(AKIA|ASIA)[0-9A-Z]{16}$/, { message: "AWS Access Key ID must start with AKIA/ASIA and be exactly 20 characters." }),
//     AWS_SECRET_ACCESS_KEY: z.string().regex(/^[A-Za-z0-9/+=]{40}$/, { message: "AWS Secret Access Key must be exactly 40 base64 characters." }),
//     AWS_REGION: z.string().regex(/^[a-z]{2}-[a-z]+-\d$/, { message: "Invalid AWS Region format (e.g., us-east-1)." }),
//     AWS_BUCKET_NAME: z.string().min(3).max(63, { message: "AWS S3 Bucket name must be between 3 and 63 characters." }),
//   },
//   cloudinary: {
//     CLOUDINARY_URL: z.string().refine(val => val.startsWith("cloudinary://"), { message: "Cloudinary URL must start with 'cloudinary://'." }),
//     CLOUDINARY_CLOUD_NAME: z.string().min(1),
//     CLOUDINARY_API_KEY: z.string().min(1),
//     CLOUDINARY_API_SECRET: z.string().min(1),
//   },

//   // ─── DATABASES ───
//   supabase: {
//     SUPABASE_URL: z.string().url({ message: "Must be a valid secured Supabase project URL (https://...)." }),
//     SUPABASE_ANON_KEY: z.string().min(50, { message: "Supabase Anon Key looks truncated or too short." }),
//   },
//   neon: {
//     DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, { message: "Must be a valid Neon PostgreSQL connection string." }),
//   },
//   pg: {
//     PGHOST: z.string().min(1, { message: "PostgreSQL Host cannot be empty." }),
//     PGPORT: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(65535)),
//     PGUSER: z.string().min(1),
//     PGPASSWORD: z.string().min(1),
//     PGDATABASE: z.string().min(1),
//   },
//   mongodb: {
//     MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, { message: "Must be a valid MongoDB Atlas connection string starting with mongodb:// or mongodb+srv://." }),
//   },
//   redis: {
//     REDIS_URL: z.string().regex(/^rediss?:\/\//, { message: "Must be a valid Redis connection string starting with redis:// or rediss://." }),
//   }
// };

// export function runZodValidation(runtimeEnv: Record<string, string>, presets: string[]) {
//   const errors: { path: string[]; message: string }[] = [];
//   let combinedSchemaShape: Record<string, z.ZodTypeAny> = {};
//   const presetKeys = new Set<string>();

//   // دائماً نشمل فحص الـ app بشكل افتراضي لأنه يغطي المتغيرات القياسية لكل المشاريع
//   const targetPresets = Array.from(new Set(["app", ...presets.map(p => p.toLowerCase())]));

//   targetPresets.forEach((preset) => {
//     const rules = PRESET_RULES[preset];
//     if (rules) {
//       Object.keys(rules).forEach((key) => {
//         combinedSchemaShape[key] = rules[key].optional(); // نضعها optional لكي لا تضرب لو لم تكن بالملف الحالي
//         presetKeys.add(key);
//       });
//     }
//   });

//   // فحص روابط الـ URL العامة تلقائياً
//   Object.keys(runtimeEnv).forEach((key) => {
//     if ((key.endsWith("_URL") || key.endsWith("_URI")) && !presetKeys.has(key)) {
//       combinedSchemaShape[key] = z.string().refine(val => /^(https?|postgres(ql)?|mongodb(\+srv)?|redis(s)?|cloudinary):\/\//.test(val), {
//         message: "Field suggests a URL/URI format but lacks a valid standard protocol prefix."
//       }).optional();
//       presetKeys.add(key);
//     }
//   });

//   const schema = z.object(combinedSchemaShape);
//   const result = schema.safeParse(runtimeEnv);

//   if (!result.success) {
//     result.error.errors.forEach((err) => {
//       errors.push({
//         path: err.path.map(String),
//         message: err.message,
//       });
//     });
//   }

//   const unknownKeys = Object.keys(runtimeEnv).filter((key) => !presetKeys.has(key));
//   return { errors, unknownKeys };
// }
// src/guard/engines/zod.engine.ts

import { z } from "zod";
import { PRESET_RULES, validateField, detectPresets } from "../rules/preset-rules.js";

function buildZodSchema(presets: string[], runtimeEnv: Record<string, string>) {
  const shape: Record<string, z.ZodTypeAny> = {};
  const presetKeys = new Set<string>();

  presets.forEach((preset) => {
    const rules = PRESET_RULES[preset];
    if (!rules) return;

    Object.entries(rules).forEach(([key, rule]) => {
      // نبني الـ Zod schema من الـ FieldRule مباشرة
      shape[key] = z
        .string()
        .refine((val) => validateField(key, val, rule) === null, {
          message: rule.message,
        })
        .optional();

      presetKeys.add(key);
    });
  });

  // فحص أي _URL أو _URI مش في الـ presets
  Object.keys(runtimeEnv).forEach((key) => {
    if ((key.endsWith("_URL") || key.endsWith("_URI")) && !presetKeys.has(key)) {
      shape[key] = z
        .string()
        .refine(
          (val) => /^(https?|postgres(ql)?|mongodb(\+srv)?|rediss?|cloudinary):\/\//.test(val),
          { message: "Field suggests a URL/URI format but lacks a valid protocol prefix." }
        )
        .optional();
      presetKeys.add(key);
    }
  });

  return { schema: z.object(shape), presetKeys };
}

export function runZodValidation(
  runtimeEnv: Record<string, string>,
  presets?: string[]
): { errors: { path: string[]; message: string }[]; unknownKeys: string[] } {
  
  const activePresets = presets ?? detectPresets(runtimeEnv);
  const { schema, presetKeys } = buildZodSchema(activePresets, runtimeEnv);
  const errors: { path: string[]; message: string }[] = [];

  const result = schema.safeParse(runtimeEnv);

  if (!result.success) {
    result.error.errors.forEach((err) => {
      errors.push({
        path: err.path.map(String),
        message: err.message,
      });
    });
  }

  const unknownKeys = Object.keys(runtimeEnv).filter((k) => !presetKeys.has(k));
  return { errors, unknownKeys };
}