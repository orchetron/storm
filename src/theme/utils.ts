export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deepMerge<T>(base: T, overrides: Partial<T>): T {
  const result = { ...base } as Record<string, unknown>;
  const over = overrides as Record<string, unknown>;
  for (const key of Object.keys(over)) {
    // Prototype pollution protection
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const baseVal = result[key];
    const overVal = over[key];
    if (isPlainObject(baseVal) && isPlainObject(overVal)) {
      result[key] = deepMerge(baseVal as Record<string, unknown>, overVal as Partial<Record<string, unknown>>);
    } else {
      result[key] = overVal;
    }
  }
  return result as T;
}
