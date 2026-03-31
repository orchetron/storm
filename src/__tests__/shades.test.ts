import { describe, it, expect } from "vitest";
import { generateShades, generateThemeShades } from "../theme/shades.js";

describe("generateShades", () => {
  it("returns base color unchanged", () => {
    const shades = generateShades("#ff0000");
    expect(shades.base).toBe("#ff0000");
  });

  it("lightening white stays white (cannot lighten further)", () => {
    const shades = generateShades("#ffffff");
    expect(shades.lighten1).toBe("#ffffff");
    expect(shades.lighten2).toBe("#ffffff");
    expect(shades.lighten3).toBe("#ffffff");
  });

  it("darkening black stays black (cannot darken further)", () => {
    const shades = generateShades("#000000");
    expect(shades.darken1).toBe("#000000");
    expect(shades.darken2).toBe("#000000");
    expect(shades.darken3).toBe("#000000");
  });

  it("lightening produces lighter values", () => {
    const shades = generateShades("#808080");
    // Parse the hex values to verify they are brighter
    const baseR = parseInt("80", 16); // 128
    const l1R = parseInt(shades.lighten1.slice(1, 3), 16);
    const l2R = parseInt(shades.lighten2.slice(1, 3), 16);
    const l3R = parseInt(shades.lighten3.slice(1, 3), 16);

    expect(l1R).toBeGreaterThan(baseR);
    expect(l2R).toBeGreaterThan(l1R);
    expect(l3R).toBeGreaterThan(l2R);
  });

  it("darkening produces darker values", () => {
    const shades = generateShades("#808080");
    const baseR = parseInt("80", 16); // 128
    const d1R = parseInt(shades.darken1.slice(1, 3), 16);
    const d2R = parseInt(shades.darken2.slice(1, 3), 16);
    const d3R = parseInt(shades.darken3.slice(1, 3), 16);

    expect(d1R).toBeLessThan(baseR);
    expect(d2R).toBeLessThan(d1R);
    expect(d3R).toBeLessThan(d2R);
  });

  it("generates valid hex strings", () => {
    const shades = generateShades("#3498db");
    const hexPattern = /^#[0-9a-f]{6}$/;
    expect(shades.base).toMatch(hexPattern);
    expect(shades.lighten1).toMatch(hexPattern);
    expect(shades.lighten2).toMatch(hexPattern);
    expect(shades.lighten3).toMatch(hexPattern);
    expect(shades.darken1).toMatch(hexPattern);
    expect(shades.darken2).toMatch(hexPattern);
    expect(shades.darken3).toMatch(hexPattern);
  });

  it("handles shorthand #RGB hex format", () => {
    const shades = generateShades("#f00");
    // #f00 = #ff0000 — lightening red should increase G and B channels
    const l1G = parseInt(shades.lighten1.slice(3, 5), 16);
    expect(l1G).toBeGreaterThan(0);
  });

  it("all shades stay in 0-255 range per channel", () => {
    const colors = ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#808080"];
    for (const color of colors) {
      const shades = generateShades(color);
      const allHexes = [
        shades.lighten1, shades.lighten2, shades.lighten3,
        shades.darken1, shades.darken2, shades.darken3,
      ];
      for (const hex of allHexes) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe("generateThemeShades", () => {
  it("generates shades for all semantic colors", () => {
    const theme = {
      brand: { primary: "#3498db" },
      success: "#2ecc71",
      warning: "#f39c12",
      error: "#e74c3c",
      info: "#1abc9c",
    };
    const shades = generateThemeShades(theme);

    expect(shades.brand.base).toBe("#3498db");
    expect(shades.success.base).toBe("#2ecc71");
    expect(shades.warning.base).toBe("#f39c12");
    expect(shades.error.base).toBe("#e74c3c");
    expect(shades.info.base).toBe("#1abc9c");

    // Each should have all shade variants
    for (const key of ["brand", "success", "warning", "error", "info"] as const) {
      const s = shades[key];
      expect(s).toHaveProperty("lighten1");
      expect(s).toHaveProperty("lighten2");
      expect(s).toHaveProperty("lighten3");
      expect(s).toHaveProperty("darken1");
      expect(s).toHaveProperty("darken2");
      expect(s).toHaveProperty("darken3");
    }
  });
});
