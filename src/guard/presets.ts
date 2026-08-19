function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}


export async function getPresetSchema(presetName: string, envData: Record<string, string>) {
  const errors: Array<{ path: string[]; message: string }> = [];

  try {
    const { z } = await import("zod");

    const schemas: Record<string, any> = {
      vercel: z.object({
        VERCEL: z.string().optional(),
        VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
        VERCEL_URL: z.string().optional(),
      }),
      neon: z.object({
        DATABASE_URL: z.string().url("Must be a valid database connection URL."),
      }),
      supabase: z.object({
        SUPABASE_URL: z.string().url("Must be a valid Supabase project URL."),
        SUPABASE_ANON_KEY: z.string().min(20, "Key looks truncated or too short."),
      })
    };

    // لو الـ Preset مش مدعوم عندنا، مرقيه سليم
    if (!schemas[presetName]) {
      return { success: true, errors: [] };
    }

    // لتجنب ضرب الفحص لو المتغيرات مش مكتوبة أصلاً والـ Preset مش إجباري بالكامل
    // نفحص فقط إذا كان هناك متغير واحد على الأقل للمنصة ممرر في الـ .env
    const hasKeys = Object.keys(envData).some(key => key.startsWith(presetName.toUpperCase()));
    if (!hasKeys && presetName !== "neon") { 
      // اعتبرنا neon إجباري كمثال أو اتركيه يمرق لو مش موجود
      return { success: true, errors: [] };
    }

    const res = schemas[presetName].safeParse(envData);
    if (!res.success) {
      return {
        success: false,
        errors: res.error.errors.map((e: any) => ({
          path: e.path.length > 0 ? e.path.map(String) : [e.path[0] || presetName.toUpperCase() + "_FIELD"],
          message: e.message
        }))
      };
    }

    return { success: true, errors: [] };

  } catch {
    // 🛡️ الـ Native Fallback الـ 100% أوفلاين في حال ضرب الـ Zod أو حذفه
    if (presetName === "vercel") {
      if (envData.VERCEL_ENV && !["development", "preview", "production"].includes(envData.VERCEL_ENV)) {
        errors.push({ path: ["VERCEL_ENV"], message: "Invalid Vercel environment type." });
      }
    }

    if (presetName === "neon") {
      if (!envData.DATABASE_URL) {
        errors.push({ path: ["DATABASE_URL"], message: "Neon DATABASE_URL is missing." });
      } else if (!isValidUrl(envData.DATABASE_URL)) {
        errors.push({ path: ["DATABASE_URL"], message: "Invalid URL structure for Neon connection." });
      }
    }

    if (presetName === "supabase") {
      if (!envData.SUPABASE_URL) errors.push({ path: ["SUPABASE_URL"], message: "Supabase URL is missing." });
      if (!envData.SUPABASE_ANON_KEY) errors.push({ path: ["SUPABASE_ANON_KEY"], message: "Supabase Anon Key is missing." });
      if (envData.SUPABASE_ANON_KEY && envData.SUPABASE_ANON_KEY.length < 20) {
        errors.push({ path: ["SUPABASE_ANON_KEY"], message: "Key looks too short to be a valid anon key." });
      }
    }

    return {
      success: errors.length === 0,
      errors
    };
  }
}
