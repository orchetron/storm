

export interface ColorShades {
  base: string;
  lighten1: string;
  lighten2: string;
  lighten3: string;
  darken1: string;
  darken2: string;
  darken3: string;
}

/** Parse hex (#RGB or #RRGGBB) to [r, g, b] 0-255. Returns 0 for unparseable components. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  let r: number, g: number, b: number;
  if (h.length === 3) {
    r = parseInt(h[0]!+h[0]!, 16);
    g = parseInt(h[1]!+h[1]!, 16);
    b = parseInt(h[2]!+h[2]!, 16);
  } else {
    r = parseInt(h.slice(0,2), 16);
    g = parseInt(h.slice(2,4), 16);
    b = parseInt(h.slice(4,6), 16);
  }
  return [isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b];
}

/** Convert [r, g, b] 0-255 back to #RRGGBB */
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Lighten a color by mixing with white */
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Darken a color by mixing with black */
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/** Generate 6 shades from a base hex color */
export function generateShades(hex: string): ColorShades {
  return {
    base: hex,
    lighten1: lighten(hex, 0.15),
    lighten2: lighten(hex, 0.30),
    lighten3: lighten(hex, 0.45),
    darken1: darken(hex, 0.15),
    darken2: darken(hex, 0.30),
    darken3: darken(hex, 0.45),
  };
}

/** Generate shades for all semantic colors in a theme */
export interface ThemeShades {
  brand: ColorShades;
  success: ColorShades;
  warning: ColorShades;
  error: ColorShades;
  info: ColorShades;
}

export function generateThemeShades(theme: { brand: { primary: string }; success: string; warning: string; error: string; info: string }): ThemeShades {
  return {
    brand: generateShades(theme.brand.primary),
    success: generateShades(theme.success),
    warning: generateShades(theme.warning),
    error: generateShades(theme.error),
    info: generateShades(theme.info),
  };
}
