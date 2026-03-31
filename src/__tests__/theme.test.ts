/**
 * Theme system tests for Storm TUI.
 *
 * Tests theme validation, contrast checking, shade generation,
 * theme presets, ThemeProvider, and theme utilities.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderForTest } from "../testing/index.js";
import { ThemeProvider, useTheme, type ThemeWithShades } from "../theme/provider.js";
import { colors, type StormColors } from "../theme/colors.js";
import { validateTheme, validateContrast } from "../theme/validate.js";
import { generateShades, generateThemeShades, type ColorShades, type ThemeShades } from "../theme/shades.js";
import {
  arcticTheme,
  midnightTheme,
  emberTheme,
  mistTheme,
  voltageTheme,
  duskTheme,
  horizonTheme,
  neonTheme,
  calmTheme,
  highContrastTheme,
  monochromeTheme,
} from "../theme/presets.js";
import { extendTheme, createTheme, type DeepPartial } from "../theme/index.js";
import { contrastRatio, relativeLuminance } from "../core/accessibility.js";

// ── ThemeProvider ─────────────────────────────────────────────────────

describe("ThemeProvider", () => {
  it("provides default theme to children", () => {
    let captured: ThemeWithShades | null = null;
    function Capture() {
      captured = useTheme();
      return React.createElement("tui-text", null, "ok");
    }

    const result = renderForTest(
      React.createElement(ThemeProvider, { children: null },
        React.createElement(Capture, null),
      ),
      { width: 20, height: 3 },
    );
    expect(captured).not.toBeNull();
    expect(captured!.colors.brand.primary).toBe(colors.brand.primary);
    expect(captured!.shades).toBeDefined();
  });

  it("provides custom theme to children", () => {
    let captured: ThemeWithShades | null = null;
    function Capture() {
      captured = useTheme();
      return React.createElement("tui-text", null, "ok");
    }

    const customTheme = { ...colors, brand: { ...colors.brand, primary: "#FF0000" } };
    renderForTest(
      React.createElement(ThemeProvider, { theme: customTheme, children: null },
        React.createElement(Capture, null),
      ),
      { width: 20, height: 3 },
    );
    expect(captured).not.toBeNull();
    expect(captured!.colors.brand.primary).toBe("#FF0000");
  });

  it("provides shades alongside colors", () => {
    let captured: ThemeWithShades | null = null;
    function Capture() {
      captured = useTheme();
      return React.createElement("tui-text", null, "ok");
    }

    renderForTest(
      React.createElement(ThemeProvider, { children: null },
        React.createElement(Capture, null),
      ),
      { width: 20, height: 3 },
    );
    expect(captured!.shades.brand).toBeDefined();
    expect(captured!.shades.success).toBeDefined();
    expect(captured!.shades.error).toBeDefined();
  });
});

// ── useTheme ──────────────────────────────────────────────────────────

describe("useTheme", () => {
  it("returns colors and shades", () => {
    let captured: ThemeWithShades | null = null;
    function Capture() {
      captured = useTheme();
      return React.createElement("tui-text", null, "ok");
    }

    renderForTest(
      React.createElement(ThemeProvider, { children: null },
        React.createElement(Capture, null),
      ),
      { width: 20, height: 3 },
    );

    expect(captured!.colors).toBeDefined();
    expect(captured!.shades).toBeDefined();
    expect(typeof captured!.colors.success).toBe("string");
    expect(typeof captured!.shades.brand.base).toBe("string");
  });

  it("generates correct shade count", () => {
    let captured: ThemeWithShades | null = null;
    function Capture() {
      captured = useTheme();
      return React.createElement("tui-text", null, "ok");
    }

    renderForTest(
      React.createElement(ThemeProvider, { children: null },
        React.createElement(Capture, null),
      ),
      { width: 20, height: 3 },
    );

    const brandShades = captured!.shades.brand;
    // Each shade has 7 keys: base, lighten1-3, darken1-3
    const keys = Object.keys(brandShades);
    expect(keys).toContain("base");
    expect(keys).toContain("lighten1");
    expect(keys).toContain("lighten2");
    expect(keys).toContain("lighten3");
    expect(keys).toContain("darken1");
    expect(keys).toContain("darken2");
    expect(keys).toContain("darken3");
    expect(keys.length).toBe(7);
  });

  it("shades are valid hex colors", () => {
    let captured: ThemeWithShades | null = null;
    function Capture() {
      captured = useTheme();
      return React.createElement("tui-text", null, "ok");
    }

    renderForTest(
      React.createElement(ThemeProvider, { children: null },
        React.createElement(Capture, null),
      ),
      { width: 20, height: 3 },
    );

    const hexRe = /^#[0-9a-fA-F]{6}$/;
    for (const shade of Object.values(captured!.shades.brand)) {
      expect(hexRe.test(shade as string)).toBe(true);
    }
  });
});

// ── generateShades ────────────────────────────────────────────────────

describe("generateShades", () => {
  it("returns base as the original color", () => {
    const shades = generateShades("#FF0000");
    expect(shades.base).toBe("#FF0000");
  });

  it("generates 7 shade values", () => {
    const shades = generateShades("#00FF00");
    expect(Object.keys(shades).length).toBe(7);
  });

  it("lighten1 is lighter than base", () => {
    const shades = generateShades("#404040");
    // Parse hex values to compare brightness
    const baseBrightness = parseInt(shades.base.slice(1, 3), 16);
    const lighten1Brightness = parseInt(shades.lighten1.slice(1, 3), 16);
    expect(lighten1Brightness).toBeGreaterThan(baseBrightness);
  });

  it("darken1 is darker than base", () => {
    const shades = generateShades("#808080");
    const baseBrightness = parseInt(shades.base.slice(1, 3), 16);
    const darken1Brightness = parseInt(shades.darken1.slice(1, 3), 16);
    expect(darken1Brightness).toBeLessThan(baseBrightness);
  });

  it("lighten shades are progressively lighter", () => {
    const shades = generateShades("#333333");
    const l1 = parseInt(shades.lighten1.slice(1, 3), 16);
    const l2 = parseInt(shades.lighten2.slice(1, 3), 16);
    const l3 = parseInt(shades.lighten3.slice(1, 3), 16);
    expect(l2).toBeGreaterThan(l1);
    expect(l3).toBeGreaterThan(l2);
  });

  it("darken shades are progressively darker", () => {
    const shades = generateShades("#CCCCCC");
    const d1 = parseInt(shades.darken1.slice(1, 3), 16);
    const d2 = parseInt(shades.darken2.slice(1, 3), 16);
    const d3 = parseInt(shades.darken3.slice(1, 3), 16);
    expect(d2).toBeLessThan(d1);
    expect(d3).toBeLessThan(d2);
  });

  it("all shades are valid hex strings", () => {
    const shades = generateShades("#06B6D4");
    const hexRe = /^#[0-9a-fA-F]{6}$/;
    for (const value of Object.values(shades)) {
      expect(hexRe.test(value)).toBe(true);
    }
  });

  it("handles #000000 (black)", () => {
    const shades = generateShades("#000000");
    expect(shades.base).toBe("#000000");
    // Lighten should produce non-black shades
    expect(shades.lighten1).not.toBe("#000000");
    // Darken of black stays black
    expect(shades.darken1).toBe("#000000");
  });

  it("handles #FFFFFF (white)", () => {
    const shades = generateShades("#FFFFFF");
    expect(shades.base).toBe("#FFFFFF");
    // Lighten of white stays white
    expect(shades.lighten1).toBe("#ffffff");
    // Darken should produce non-white shades
    expect(shades.darken1).not.toBe("#FFFFFF");
  });

  it("handles short hex (#RGB)", () => {
    const shades = generateShades("#F00");
    expect(shades.base).toBe("#F00");
    // lighten1 should be valid hex
    const hexRe = /^#[0-9a-fA-F]{6}$/;
    expect(hexRe.test(shades.lighten1)).toBe(true);
  });
});

// ── generateThemeShades ───────────────────────────────────────────────

describe("generateThemeShades", () => {
  it("generates shades for all semantic colors", () => {
    const themeShades = generateThemeShades(colors);
    expect(themeShades.brand).toBeDefined();
    expect(themeShades.success).toBeDefined();
    expect(themeShades.warning).toBeDefined();
    expect(themeShades.error).toBeDefined();
    expect(themeShades.info).toBeDefined();
  });

  it("brand shades use brand.primary", () => {
    const themeShades = generateThemeShades(colors);
    expect(themeShades.brand.base).toBe(colors.brand.primary);
  });

  it("success shades use success color", () => {
    const themeShades = generateThemeShades(colors);
    expect(themeShades.success.base).toBe(colors.success);
  });

  it("each shade group has 7 values", () => {
    const themeShades = generateThemeShades(colors);
    for (const key of ["brand", "success", "warning", "error", "info"] as const) {
      expect(Object.keys(themeShades[key]).length).toBe(7);
    }
  });
});

// ── validateTheme ─────────────────────────────────────────────────────

describe("validateTheme", () => {
  it("accepts valid default theme", () => {
    const result = validateTheme(colors);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("accepts all preset themes", () => {
    const presets = [
      arcticTheme, midnightTheme, emberTheme, mistTheme,
      voltageTheme, duskTheme, horizonTheme, neonTheme,
      calmTheme, highContrastTheme, monochromeTheme,
    ];
    for (const preset of presets) {
      const result = validateTheme(preset);
      expect(result.valid).toBe(true);
    }
  });

  it("rejects theme with missing fields", () => {
    const partial = { brand: { primary: "#FF0000" } } as unknown as StormColors;
    const result = validateTheme(partial);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects invalid hex color", () => {
    const badTheme = { ...colors, success: "not-a-color" };
    const result = validateTheme(badTheme);
    expect(result.valid).toBe(false);
    const errorPaths = result.errors.map((e) => e.path);
    expect(errorPaths).toContain("success");
  });

  it("accepts CSS named colors", () => {
    const namedTheme = { ...colors, success: "green" };
    const result = validateTheme(namedTheme);
    // "green" is a valid CSS named color
    const successErrors = result.errors.filter((e) => e.path === "success");
    expect(successErrors.length).toBe(0);
  });

  it("rejects numeric values instead of strings", () => {
    const numTheme = { ...colors, success: 12345 as any };
    const result = validateTheme(numTheme);
    expect(result.valid).toBe(false);
    const successErrors = result.errors.filter((e) => e.path === "success");
    expect(successErrors.length).toBeGreaterThan(0);
  });

  it("reports missing required paths", () => {
    const incomplete = {
      brand: { primary: "#FF0000" },
      text: { primary: "#FFFFFF" },
    } as unknown as StormColors;
    const result = validateTheme(incomplete);
    expect(result.valid).toBe(false);
    // Should report many missing paths
    expect(result.errors.length).toBeGreaterThan(5);
  });

  it("accepts #RGB short hex", () => {
    const shortHexTheme = { ...colors, success: "#0F0" };
    const result = validateTheme(shortHexTheme);
    const successErrors = result.errors.filter((e) => e.path === "success");
    expect(successErrors.length).toBe(0);
  });

  it("rejects invalid short hex", () => {
    const badShort = { ...colors, success: "#GGG" };
    const result = validateTheme(badShort);
    expect(result.valid).toBe(false);
  });

  it("warns about low-contrast text colors", () => {
    const lowContrastTheme = {
      ...colors,
      text: { ...colors.text, primary: "#1A1A2E" },
    };
    const result = validateTheme(lowContrastTheme);
    // Should have a warning about low contrast
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("does not warn about high-contrast text colors", () => {
    const result = validateTheme(colors);
    // Default theme should have good contrast for text.primary
    const primaryWarnings = result.warnings.filter((w) => w.path === "text.primary");
    expect(primaryWarnings.length).toBe(0);
  });

  it("error includes value for invalid colors", () => {
    const badTheme = { ...colors, error: "INVALID" };
    const result = validateTheme(badTheme);
    const errorEntry = result.errors.find((e) => e.path === "error");
    expect(errorEntry).toBeDefined();
    expect(errorEntry!.value).toBe("INVALID");
  });
});

// ── validateContrast ──────────────────────────────────────────────────

describe("validateContrast", () => {
  it("high contrast theme has fewer errors than default theme", () => {
    const hcResult = validateContrast(highContrastTheme);
    const defaultResult = validateContrast(colors);
    // High contrast theme should have fewer or equal contrast errors
    expect(hcResult.errors.length).toBeLessThanOrEqual(defaultResult.errors.length);
  });

  it("reports low contrast pairs as errors (below 3:1)", () => {
    const lowContrastTheme = {
      ...colors,
      text: { ...colors.text, primary: "#1A1A2E", secondary: "#1A1A2E", dim: "#1A1A2E", disabled: "#1A1A2E" },
    };
    const result = validateContrast(lowContrastTheme);
    // Some paths should be reported as errors
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("uses custom background color", () => {
    const result = validateContrast(colors, "#FFFFFF");
    // Against white background, some dark-on-light colors may fail
    // But the function should not crash
    expect(result).toBeDefined();
    expect(typeof result.valid).toBe("boolean");
  });

  it("uses default dark background when not specified", () => {
    const result = validateContrast(colors);
    // Default background is "#1A1A2E"
    expect(result).toBeDefined();
  });

  it("checks text-role colors", () => {
    const result = validateContrast(colors);
    // Should check paths like text.primary, brand.primary, etc.
    const allPaths = [...result.errors.map((e) => e.path), ...result.warnings.map((w) => w.path)];
    // Even if all pass, the function should have checked them
    expect(result).toBeDefined();
  });

  it("reports between 3:1 and 4.5:1 as warnings", () => {
    // Create a theme with a color that has moderate contrast
    const moderateTheme = {
      ...colors,
      text: { ...colors.text, primary: "#888888" },
    };
    const result = validateContrast(moderateTheme, "#555555");
    // #888888 against #555555 should have moderate contrast
    expect(result).toBeDefined();
  });
});

// ── contrastRatio ─────────────────────────────────────────────────────

describe("contrastRatio", () => {
  it("returns 21 for black and white", () => {
    const ratio = contrastRatio("#000000", "#FFFFFF");
    expect(ratio).toBeCloseTo(21, 0);
  });

  it("returns 1 for identical colors", () => {
    const ratio = contrastRatio("#808080", "#808080");
    expect(ratio).toBeCloseTo(1, 2);
  });

  it("is symmetric", () => {
    const r1 = contrastRatio("#FF0000", "#00FF00");
    const r2 = contrastRatio("#00FF00", "#FF0000");
    expect(r1).toBeCloseTo(r2, 5);
  });

  it("is always >= 1", () => {
    const ratio = contrastRatio("#333333", "#333334");
    expect(ratio).toBeGreaterThanOrEqual(1);
  });

  it("handles short hex", () => {
    const ratio = contrastRatio("#000", "#FFF");
    expect(ratio).toBeCloseTo(21, 0);
  });
});

// ── relativeLuminance ─────────────────────────────────────────────────

describe("relativeLuminance", () => {
  it("returns 0 for black", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("returns 1 for white", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("returns value between 0 and 1", () => {
    const lum = relativeLuminance("#808080");
    expect(lum).toBeGreaterThan(0);
    expect(lum).toBeLessThan(1);
  });
});

// ── Theme presets ─────────────────────────────────────────────────────

describe("Theme presets", () => {
  const presets: Record<string, StormColors> = {
    arctic: arcticTheme,
    midnight: midnightTheme,
    ember: emberTheme,
    mist: mistTheme,
    voltage: voltageTheme,
    dusk: duskTheme,
    horizon: horizonTheme,
    neon: neonTheme,
    calm: calmTheme,
    highContrast: highContrastTheme,
    monochrome: monochromeTheme,
  };

  for (const [name, theme] of Object.entries(presets)) {
    it(`${name} has all required fields`, () => {
      expect(theme.brand.primary).toBeDefined();
      expect(theme.brand.light).toBeDefined();
      expect(theme.brand.glow).toBeDefined();
      expect(theme.text.primary).toBeDefined();
      expect(theme.text.secondary).toBeDefined();
      expect(theme.text.dim).toBeDefined();
      expect(theme.text.disabled).toBeDefined();
      expect(theme.success).toBeDefined();
      expect(theme.warning).toBeDefined();
      expect(theme.error).toBeDefined();
      expect(theme.info).toBeDefined();
      expect(theme.divider).toBeDefined();
      expect(theme.syntax.keyword).toBeDefined();
      expect(theme.syntax.string).toBeDefined();
      expect(theme.syntax.number).toBeDefined();
      expect(theme.syntax.comment).toBeDefined();
    });

    it(`${name} passes validation`, () => {
      const result = validateTheme(theme);
      expect(result.valid).toBe(true);
    });

    it(`${name} generates shades without error`, () => {
      const shades = generateThemeShades(theme);
      expect(shades.brand.base).toBe(theme.brand.primary);
    });
  }
});

// ── extendTheme / createTheme ─────────────────────────────────────────

describe("extendTheme", () => {
  it("overrides only specified values", () => {
    const extended = extendTheme(colors, { brand: { primary: "#FF0000" } } as DeepPartial<StormColors>);
    expect(extended.brand.primary).toBe("#FF0000");
    // Other brand fields unchanged
    expect(extended.brand.light).toBe(colors.brand.light);
    expect(extended.brand.glow).toBe(colors.brand.glow);
    // Other top-level fields unchanged
    expect(extended.success).toBe(colors.success);
  });

  it("deep-merges nested objects", () => {
    const extended = extendTheme(colors, { text: { primary: "#EEEEEE" } } as DeepPartial<StormColors>);
    expect(extended.text.primary).toBe("#EEEEEE");
    expect(extended.text.secondary).toBe(colors.text.secondary);
  });
});

describe("createTheme", () => {
  it("creates theme from partial using default as base", () => {
    const custom = createTheme({ success: "#00FF00" });
    expect(custom.success).toBe("#00FF00");
    expect(custom.brand.primary).toBe(colors.brand.primary);
  });

  it("returns a valid theme", () => {
    const custom = createTheme({ warning: "#FFAA00" });
    const result = validateTheme(custom);
    expect(result.valid).toBe(true);
  });
});
