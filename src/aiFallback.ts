import { GoogleGenAI } from "@google/genai";

// التأكد من تهيئة العميل باستخدام المفتاح المخزن في البيئة
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI() : null;

export async function analyzeUnknownVariablesWithAi(
  unknownKeys: string[],
  runtimeEnv: Record<string, string>
): Promise<{ path: string[]; message: string }[]> {
  // إذا لم يتم توفير مفتاح الـ API أو لا توجد حقول مجهولة، نخرج فوراً بأمان
  if (!ai || unknownKeys.length === 0) return [];

  // تجميع المتغيرات المجهولة مع قيمها لإرسالها في البرومبت (دون إرسال باقي الـ env المحمية)
  const payload: Record<string, string> = {};
  unknownKeys.forEach((key) => {
    payload[key] = runtimeEnv[key] || "";
  });

  const prompt = `
You are an expert DevSecOps Security Auditor. I have detected some environment variables that are not covered by standard pre-defined system patterns.
Analyze these variables and their values carefully for any deployment configuration mistakes or security vulnerabilities.

Unknown Environment Variables Data:
${JSON.stringify(payload, null, 2)}

Strict Requirements:
1. Evaluate if the value violates common safety standards (e.g., exposed passwords, raw secrets that look generic, weak keys, or broken formatting).
2. If a variable looks totally valid and secure for custom business logic, DO NOT generate an error for it.
3. Your response MUST be a raw JSON array of objects matching this exact structure:
   [{"path": ["VARIABLE_NAME"], "message": "Detailed error message here explaining the issue."}]
4. Do not include markdown code blocks like \\\`\\\`\\\`json or any regular text. Output ONLY the raw JSON array.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // استخدام أحدث موديل سريع وذكي للـ Text Tasks
      contents: prompt,
      config: {
        // إجبار الموديل على إرجاع الناتج كـ JSON مطابق للـ Interface تبعنا
        responseMimeType: "application/json",
      }
    });

    const responseText = response.text?.trim();
    if (!responseText) return [];

    // تحويل النص المستلم إلى مصفوفة الأخطاء الموحدة للـ CLI
    const aiErrors = JSON.parse(responseText);
    if (Array.isArray(aiErrors)) {
      return aiErrors;
    }
    return [];
  } catch (error) {
    // معالجة الأخطاء بصمت لضمان عدم توقف الـ CLI بالكامل في حال حدوث مشكلة بالشبكة أو الـ API Key
    // console.error("AI Analysis failed:", error);
    return [];
  }
}