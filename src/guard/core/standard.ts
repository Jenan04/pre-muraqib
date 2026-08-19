// import { GuardSchema } from "../../types/interface.js";

// interface StandardValidationResult {
//   success: boolean;
//   data?: any;
//   errors: Array<{ path: string[]; message: string }>;
// }

// /**
//  * ⚡ المحرك المركزي لتنفيذ الفحص والتوافق مع الـ Standard Schema
//  */
// export async function createGuard(
//   schema: GuardSchema, 
//   envData: Record<string, string>
// ): Promise<StandardValidationResult> {
  
//   // 1️⃣ الفحص إذا كانت السكيمة تتبع معيار Standard Schema الموحد (مثل Zod الحية لو لُقطت)
//   if (schema && typeof schema === 'object' && '~standard' in schema) {
//     const result = await schema['~standard'].validate(envData);
    
//     if (result.issues && result.issues.length > 0) {
//       return {
//         success: false,
//         data: null,
//         errors: result.issues.map((issue) => ({
//           // تحويل الـ Path إلى مصفوفة نصوص دائماً لتسهيل قراءتها في الـ CLI
//           path: issue.path ? issue.path.map(String) : [],
//           message: issue.message
//         }))
//       };
//     }
    
//     return { 
//       success: true, 
//       data: result.value, 
//       errors: [] 
//     };
//   }
  
//   // 2️⃣ الـ Fallback: لو السكيمة ممررة كـ Object عادي (في حالة الـ Native Fallbacks أوفلاين)
//   // الفحص هنا بيتم داخلياً جوة ملف الـ presets نفسه، لذلك المحرك بيمرره بأمان
//   return { 
//     success: true, 
//     data: envData, 
//     errors: [] 
//   };
// }
// src/guard/core/standard.ts

// import type { GuardSchema, MuraqibSchema } from "../../types/interface.js";

// interface StandardValidationResult {
//   success: boolean;
//   data: Record<string, string> | unknown;
//   errors: Array<{ path: string[]; message: string }>;
// }

// /**
//  * ⚙️ محول السكيمات الديناميكي الموحد (The Enterprise Adapter Engine)
//  * يأخذ الـ Config الموحد ويبني سكيمة حية بناءً على المكتبة المتاحة عند العميل
//  */
// export async function compileAndValidate(
//   muraqibSchema: MuraqibSchema,
//   envData: Record<string, string>
// ): Promise<{ success: boolean; errors: Array<{ path: string[]; message: string }> }> {
  
//   // 1️⃣ محاولة تشغيل التحقق عبر Zod إذا كانت متوفرة عند العميل
//   try {
//     const zodModule = await import("zod");
//     const z = zodModule.z;
//     const zodShape: Record<string, unknown> = {};

//     for (const key of Object.keys(muraqibSchema)) {
//       const field = muraqibSchema[key];
//       let rule: unknown;

//       if (field.type === "url") rule = z.string().url(field.message);
//       else if (field.type === "enum" && field.choices) rule = z.enum(field.choices as [string, ...string[]]);
//       else if (field.type === "number") rule = z.string().regex(/^\d+$/).transform(Number);
//       else rule = z.string();

//       zodShape[key] = field.required ? rule : (rule as { optional: () => unknown }).optional();
//     }

//     const compiledValidator = z.object(zodShape as Parameters<typeof z.object>[0]);
//     const parsedResult = compiledValidator.safeParse(envData);

//     if (!parsedResult.success) {
//       return {
//         success: false,
//         errors: parsedResult.error.errors.map((e) => ({
//           path: e.path.map(String),
//           message: e.message
//         }))
//       };
//     }
//     return { success: true, errors: [] };

//   } catch {
//     // 2️⃣ محاولة تشغيل التحقق عبر Valibot إذا لم تتوفر Zod
//     try {
//       const v = await import("valibot");
//       const valibotShape: Record<string, unknown> = {};

//       for (const key of Object.keys(muraqibSchema)) {
//         const field = muraqibSchema[key];
//         let rule: unknown;

//         if (field.type === "url") rule = v.string([v.url(field.message)]);
//         else if (field.type === "enum" && field.choices) rule = v.picklist(field.choices);
//         else rule = v.string();

//         valibotShape[key] = field.required ? rule : v.optional(rule);
//       }

//       const compiledValidator = v.object(valibotShape);
//       const parsedResult = v.safeParse(compiledValidator, envData);

//       if (!parsedResult.success && parsedResult.issues) {
//         return {
//           success: false,
//           errors: parsedResult.issues.map((issue: any) => ({
//             path: issue.path ? issue.path.map((p: any) => String(p.key)) : [key],
//             message: issue.message
//           }))
//         };
//       }
//     } catch {
//       // إذا فشلت المكتبات الخارجية تماماً، نلقي خطأ ليتم تفعيل الـ Native Fallback أوفلاين
//       throw new Error("Trigger Native Fallback");
//     }
//   }

//   return { success: true, errors: [] };
// }

/**
 * ⚡ المحرك المركزي والأوركسترا لتنفيذ الفحص الكامل لـ "مراقب"
 */
// export async function createGuard(
//   schema: GuardSchema, 
//   envData: Record<string, string>
// ): Promise<StandardValidationResult> {
  
//   // 🅰️ الحالة الأولى: السكيمة الممررة تتبع معيار Standard Schema الموحد (مكتبة حية مباشرة)
//   if (schema && typeof schema === 'object' && '~standard' in schema) {
//     const result = await schema['~standard'].validate(envData);
    
//     if (result.issues && result.issues.length > 0) {
//       return {
//         success: false,
//         data: null,
//         errors: result.issues.map((issue) => ({
//           path: issue.path ? issue.path.map(String) : [],
//           message: issue.message
//         }))
//       };
//     }
    
//     return { 
//       success: true, 
//       data: result.value, 
//       errors: [] 
//     };
//   }
  
//   // 🅱️ الحالة الثانية: السكيمة ممررة كـ MuraqibSchema (كائن إعدادات المنصات السحابية الخاص بنا)
//   // هنا نقوم بتحويلها ديناميكياً وتشغيل المحرك الذكي
//   if (schema && typeof schema === 'object') {
//     try {
//       const adapterResult = await compileAndValidate(schema as MuraqibSchema, envData);
//       return {
//         success: adapterResult.success,
//         data: envData,
//         errors: adapterResult.errors
//       };
//     } catch {
//       // لو ألقى محرك الـ Adapter خطأ (بسبب عدم وجود Zod أو Valibot)، نرجع النجاح كـ Fallback 
//       // لنسمح للمحرك الخارجي بتشغيل الـ Native Logic المكتوب بجافاسكريبت النقي
//       return {
//         success: true,
//         data: envData,
//         errors: []
//       };
//     }
//   }
  
//   // 🅲 الحالة الاحتياطية المطلقة
//   return { 
//     success: true, 
//     data: envData, 
//     errors: [] 
//   };
// }

// src/guard/core/standard.ts

// import type { GuardSchema, MuraqibSchema } from "../../types/interface.js";

// interface StandardValidationResult {
//   success: boolean;
//   data: Record<string, string> | unknown;
//   errors: Array<{ path: string[]; message: string }>;
// }

// export async function compileAndValidate(
//   muraqibSchema: MuraqibSchema,
//   envData: Record<string, string>
// ): Promise<{ success: boolean; errors: Array<{ path: string[]; message: string }> }> {
  
//   // 1️⃣ محاولة تشغيل التحقق عبر Zod
//   try {
//     const zodModule = await import("zod");
//     const z = zodModule.z;
//     const zodShape: Record<string, unknown> = {};

//     for (const key of Object.keys(muraqibSchema)) {
//       const field = muraqibSchema[key];
//       let rule: any; // كسر محلي مؤقت ومحمي ومخفي تماما داخل الـ Adapter لبناء الـ chain

//       // if (field.type === "url") rule = z.string().url(field.message || `${key} must be a valid URL`);
//       // else if (field.type === "enum" && field.choices) rule = z.enum(field.choices as [string, ...string[]]);
//       // else if (field.type === "number") rule = z.string().regex(/^\d+$/, { message: `${key} must be a numeric string` });
//       // else rule = z.string();

//       // zodShape[key] = field.required ? rule : rule.optional();

//       if (field.type === "url") rule = z.string().url(field.message || `${key} must be a valid URL`);
// else if (field.type === "enum" && field.choices) rule = z.enum(field.choices as [string, ...string[]]);
// else if (field.type === "number") rule = z.string().regex(/^\d+$/);
// else {
//   // لو التايب string عادي وفيه شرط الحد الأدنى للطول
//   let strRule = z.string();
//   if (field.min) strRule = strRule.min(field.min, field.message);
//   rule = strRule;
// }
//     }

//     const compiledValidator = z.object(zodShape);
//     const parsedResult = compiledValidator.safeParse(envData);

//     if (!parsedResult.success) {
//       return {
//         success: false,
//         errors: parsedResult.error.errors.map((e) => ({
//           path: e.path.map(String),
//           message: e.message
//         }))
//       };
//     }
//     return { success: true, errors: [] };

//   } catch (zodError) {
//     // لو الـ Zod مش نازلة أصلا (Module Not Found)، بنروح للبديل
//     // لكن لو الـ Zod موجودة وعملت خطأ فحص، الـ safeParse تكلفت فيه فوق ولن يمر لهنا
//     try {
//       const v = await import("valibot");
//       const valibotShape: Record<string, any> = {};

//       for (const key of Object.keys(muraqibSchema)) {
//         const field = muraqibSchema[key];
//         let rule: any;

//         if (field.type === "url") rule = v.string([v.url(field.message)]);
//         else if (field.type === "enum" && field.choices) rule = v.picklist(field.choices);
//         else rule = v.string();

//         valibotShape[key] = field.required ? rule : v.optional(rule);
//       }

//       const compiledValidator = v.object(valibotShape);
//       const parsedResult = v.safeParse(compiledValidator, envData);

//       // إصلاح فحص Valibot الصارم
//       if (parsedResult.issues && parsedResult.issues.length > 0) {
//         return {
//           success: false,
//           errors: parsedResult.issues.map((issue: any) => ({
//             path: issue.path ? issue.path.map((p: any) => String(p.key)) : [key],
//             message: issue.message
//           }))
//         };
//       }
//       return { success: true, errors: [] };
//     } catch {
//       // الـ Fallback النهائي لو مفيش مكتبات من الأساس
//       throw new Error("Trigger Native Fallback");
//     }
//   }
// }

// export async function createGuard(
//   schema: GuardSchema, 
//   envData: Record<string, string>
// ): Promise<StandardValidationResult> {
  
//   if (schema && typeof schema === 'object' && '~standard' in schema) {
//     const result = await schema['~standard'].validate(envData);
//     if (result.issues && result.issues.length > 0) {
//       return {
//         success: false,
//         data: null,
//         errors: result.issues.map((issue) => ({
//           path: issue.path ? issue.path.map(String) : [],
//           message: issue.message
//         }))
//       };
//     }
//     return { success: true, data: result.value, errors: [] };
//   }
  
//   if (schema && typeof schema === 'object') {
//     try {
//       const adapterResult = await compileAndValidate(schema as MuraqibSchema, envData);
//       return {
//         success: adapterResult.success,
//         data: envData,
//         errors: adapterResult.errors
//       };
//     } catch {
//       return { success: true, data: envData, errors: [] };
//     }
//   }
  
//   return { success: true, data: envData, errors: [] };
// }