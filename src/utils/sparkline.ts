export const SPARK_CHARS = ["\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];

/**
 * Render an array of numbers as a mini sparkline string using block characters.
 */
export function miniSparkline(data: number[], chars: string[] = SPARK_CHARS): string {
  if (data.length === 0) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return data
    .map((v) => {
      const idx = Math.min(chars.length - 1, Math.floor(((v - min) / range) * (chars.length - 1)));
      return chars[idx]!;
    })
    .join("");
}
