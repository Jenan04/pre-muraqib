export interface parsedLine {
    line: number;
    key: string;
    value: string;
}

export interface syntaxIssue {
    line: number;
    type: 'syntax';
    severity: 'error' | 'warning';
    message: string;
    key?: string;
}

// =========================================================================
// 🛡️ الـ Interfaces الخاصة بالـ Semantic Validation والـ Guards (شغل آية)
// =========================================================================

/**
 * معيار متوافق مع الـ Standard Schema لدعم مكتبات التحقق الحية ديناميكياً (مثل Zod)
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => Promise<
      | { value: Output; issues?: never } 
      | { issues: Array<{ message: string; path?: Array<string | number> }>; value?: never }
    >;
  };
}

/**
 * السكيمة المسموحة؛ إما سكيمة تتبع معيار Standard Schema أو كائن مخصص للـ Native Fallback أوفلاين
 */
export type GuardSchema = StandardSchemaV1<any, any> | Record<string, any>;

/**
 * الخيارات المتاحة لتخصيص سلوك محرك الفحص البيئي
 */
export interface GuardOptions {
  isServer?: boolean;
  emptyStringAsUndefined?: boolean;
  runtimeEnvStrict?: Record<string, string>; // كائن المتغيرات النقي الممرر من بارسر جنان
  runtimeEnv?: Record<string, string>;
  extends?: string[];                        // لتحديد الـ Presets المطلوبة (vercel, neon, supabase...)
}

// /**
//  * 📊 القالب الموحد لتعريف المتغيرات داخل أداة مراقب (Commercial Schema Definition)
//  */
// export interface SchemaField {
//   type: "string" | "number" | "enum" | "url";
//   required?: boolean;
//   min?: number;
//   regex?: RegExp;
//   choices?: readonly string[];
//   message?: string;
// }

// export type MuraqibSchema = Record<string, SchemaField>;

// /**
//  * 🛡️ الهيكل المعماري النقي للاستراتيجيات (Strategy Pattern Interface)
//  */
// export interface PresetStrategy {
//   name: string;
//   schema: MuraqibSchema;
//   native: (envData: Record<string, string>, errors: Array<{ path: string[]; message: string }>) => void;
// }


// export interface parsedLine {
//   line: number;
//   key: string;
//   value: string;
// }

// export interface syntaxIssue {
//   line: number;
//   type: 'syntax';
//   severity: 'error' | 'warning';
//   message: string;
//   key?: string;
// }

// // =========================================================================
// // 🛡️ الـ Interfaces الخاصة بالـ Semantic Validation والـ Guards
// // =========================================================================

// export interface StandardSchemaV1Issue {
//   readonly message: string;
//   readonly path?: readonly (string | number)[];
// }

// /**
//  * معيار متوافق مع الـ Standard Schema لدعم مكتبات التحقق الحية ديناميكياً (مثل Zod)
//  */
// export interface StandardSchemaV1<Input = unknown, Output = Input> {
//   readonly '~standard': {
//     readonly version: 1;
//     readonly vendor: string;
//     readonly validate: (value: unknown) => Promise<
//       | { value: Output; issues?: never } 
//       | { issues: readonly StandardSchemaV1Issue[]; value?: never }
//     >;
//   };
// }

// /**
//  * 📊 القالب الموحد لتعريف المتغيرات داخل أداة مراقب (Commercial Schema Definition)
//  */
// export interface SchemaField {
//   type: "string" | "number" | "enum" | "url";
//   required?: boolean;
//   min?: number;
//   regex?: RegExp;
//   choices?: readonly string[];
//   message?: string;
// }

// export type MuraqibSchema = Record<string, SchemaField>;

// /**
//  * السكيمة المسموحة: إما سكيمة تتبع معيار Standard Schema صارم (بدون any) أو كائن المقاييس التجاري الخاص بمراقب
//  */
// export type GuardSchema = StandardSchemaV1<unknown, unknown> | MuraqibSchema;

// /**
//  * الخيارات المتاحة لتخصيص سلوك محرك الفحص البيئي
//  */
// export interface GuardOptions {
//   isServer?: boolean;
//   emptyStringAsUndefined?: boolean;
//   runtimeEnvStrict?: Record<string, string>; // كائن المتغيرات النقي الممرر من بارسر جنان
//   runtimeEnv?: Record<string, string>;
//   extends?: string[];                        // لتحديد الـ Presets المطلوبة (vercel, neon, supabase...)
// }

// /**
//  * 🛡️ الهيكل المعماري النقي للاستراتيجيات (Strategy Pattern Interface)
//  */
// export interface PresetStrategy {
//   name: string;
//   schema: MuraqibSchema;
//   native: (envData: Record<string, string>, errors: Array<{ path: string[]; message: string }>) => void;
// }