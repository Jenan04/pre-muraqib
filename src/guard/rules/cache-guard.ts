export function validateCacheRules(env: Record<string, string>) {
  const errors: Array<{ path: string[]; message: string }> = [];
  
  if (env.STATIC_ASSETS_CACHE_MAX_AGE && isNaN(Number(env.STATIC_ASSETS_CACHE_MAX_AGE))) {
    errors.push({ 
      path: ['STATIC_ASSETS_CACHE_MAX_AGE'], 
      message: "Build optimization: Cache max age must be a valid number of seconds." 
    });
  }
  return errors;
}