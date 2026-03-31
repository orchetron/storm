import { describe, it, expect } from "vitest";
import { mergeBoxStyles, pickStyleProps } from "../styles/applyStyles.js";

describe("mergeBoxStyles", () => {
  it("returns defaults when overrides is empty", () => {
    const defaults = { color: "red", bold: true, padding: 2 };
    const result = mergeBoxStyles(defaults, {});
    expect(result).toEqual({ color: "red", bold: true, padding: 2 });
  });

  it("user override wins per-prop", () => {
    const defaults = { color: "red", bold: true };
    const overrides = { color: "blue" };
    const result = mergeBoxStyles(defaults, overrides);
    expect(result.color).toBe("blue");
    expect(result.bold).toBe(true); // unchanged default
  });

  it("undefined values in overrides are not applied", () => {
    const defaults = { color: "red", bold: true };
    const overrides = { color: undefined, bold: false };
    const result = mergeBoxStyles(defaults, overrides);
    expect(result.color).toBe("red"); // undefined does NOT overwrite
    expect(result.bold).toBe(false); // explicit false does overwrite
  });

  it("adds new keys from overrides", () => {
    const defaults = { color: "red" };
    const overrides = { padding: 5 };
    const result = mergeBoxStyles(defaults, overrides);
    expect(result.color).toBe("red");
    expect(result.padding).toBe(5);
  });

  it("does not mutate the defaults object", () => {
    const defaults = { color: "red" };
    const overrides = { color: "blue" };
    mergeBoxStyles(defaults, overrides);
    expect(defaults.color).toBe("red"); // original unchanged
  });
});

describe("pickStyleProps", () => {
  it("picks only style-related keys", () => {
    const props = {
      color: "red",
      bold: true,
      width: 10,
      padding: 2,
      onClick: () => {},
      label: "test",
    };
    const result = pickStyleProps(props);
    expect(result).toEqual({
      color: "red",
      bold: true,
      width: 10,
      padding: 2,
    });
    expect(result).not.toHaveProperty("onClick");
    expect(result).not.toHaveProperty("label");
  });

  it("skips undefined values", () => {
    const props = { color: undefined, bold: true };
    const result = pickStyleProps(props);
    expect(result).not.toHaveProperty("color");
    expect(result.bold).toBe(true);
  });

  it("returns empty object for no matching keys", () => {
    const props = { onClick: () => {}, label: "test" };
    const result = pickStyleProps(props);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("picks all container-level style keys", () => {
    const allStyles = {
      color: "blue",
      bold: true,
      dim: false,
      width: 80,
      height: 24,
      minWidth: 10,
      maxWidth: 100,
      margin: 1,
      marginX: 2,
      marginY: 3,
      marginTop: 4,
      marginBottom: 5,
      marginLeft: 6,
      marginRight: 7,
      padding: 1,
      paddingX: 2,
      paddingY: 3,
      paddingTop: 4,
      paddingBottom: 5,
      paddingLeft: 6,
      paddingRight: 7,
      borderStyle: "single",
      borderColor: "white",
      backgroundColor: "black",
    };
    const result = pickStyleProps(allStyles);
    expect(Object.keys(result).length).toBe(Object.keys(allStyles).length);
  });
});
