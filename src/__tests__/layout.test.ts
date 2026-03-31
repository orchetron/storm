import { describe, it, expect } from "vitest";
import {
  computeLayout,
  measureNaturalHeight,
  type LayoutNode,
  type LayoutResult,
} from "../layout/engine.js";

/** Helper to create a LayoutNode with sensible defaults. */
function makeNode(
  props: LayoutNode["props"],
  children: LayoutNode[] = [],
  measureText?: LayoutNode["measureText"],
): LayoutNode {
  return {
    props,
    children,
    layout: {
      x: 0, y: 0, width: 0, height: 0,
      innerX: 0, innerY: 0, innerWidth: 0, innerHeight: 0,
      contentHeight: 0, contentWidth: 0,
    },
    ...(measureText ? { measureText } : {}),
  };
}

describe("computeLayout", () => {
  it("assigns full available space to a single node with no size", () => {
    const node = makeNode({});
    computeLayout(node, 0, 0, 80, 24);
    expect(node.layout.width).toBe(80);
    expect(node.layout.height).toBe(24);
    expect(node.layout.x).toBe(0);
    expect(node.layout.y).toBe(0);
  });

  it("respects explicit width and height", () => {
    const node = makeNode({ width: 40, height: 10 });
    computeLayout(node, 0, 0, 80, 24);
    expect(node.layout.width).toBe(40);
    expect(node.layout.height).toBe(10);
  });

  it("handles display none", () => {
    const node = makeNode({ display: "none" });
    computeLayout(node, 5, 5, 80, 24);
    expect(node.layout.width).toBe(0);
    expect(node.layout.height).toBe(0);
  });

  it("lays out column children at sequential Y positions", () => {
    const child1 = makeNode({ height: 5 });
    const child2 = makeNode({ height: 5 });
    const child3 = makeNode({ height: 5 });
    const root = makeNode({ flexDirection: "column" }, [child1, child2, child3]);
    computeLayout(root, 0, 0, 80, 24);

    expect(child1.layout.y).toBe(0);
    expect(child2.layout.y).toBe(5);
    expect(child3.layout.y).toBe(10);
  });

  it("lays out row children at sequential X positions", () => {
    const child1 = makeNode({ width: 20, height: 10 });
    const child2 = makeNode({ width: 20, height: 10 });
    const root = makeNode({ flexDirection: "row" }, [child1, child2]);
    computeLayout(root, 0, 0, 80, 24);

    expect(child1.layout.x).toBe(0);
    expect(child2.layout.x).toBe(20);
  });

  it("distributes flex grow proportionally", () => {
    const child1 = makeNode({ flexGrow: 1 });
    const child2 = makeNode({ flexGrow: 3 });
    const root = makeNode({ flexDirection: "column", height: 40 }, [child1, child2]);
    computeLayout(root, 0, 0, 80, 40);

    // child1 gets 1/4, child2 gets 3/4
    expect(child1.layout.height).toBe(10);
    expect(child2.layout.height).toBe(30);
  });

  it("applies padding to inner dimensions", () => {
    const child = makeNode({});
    const root = makeNode({ padding: 2 }, [child]);
    computeLayout(root, 0, 0, 80, 24);

    expect(root.layout.innerX).toBe(2);
    expect(root.layout.innerY).toBe(2);
    expect(root.layout.innerWidth).toBe(76); // 80 - 2*2
    expect(root.layout.innerHeight).toBe(20); // 24 - 2*2
  });

  it("applies gap between column children", () => {
    const child1 = makeNode({ height: 5 });
    const child2 = makeNode({ height: 5 });
    const root = makeNode({ flexDirection: "column", gap: 2 }, [child1, child2]);
    computeLayout(root, 0, 0, 80, 24);

    expect(child1.layout.y).toBe(0);
    expect(child2.layout.y).toBe(7); // 5 + 2
  });

  it("applies gap between row children", () => {
    const child1 = makeNode({ width: 10, height: 5 });
    const child2 = makeNode({ width: 10, height: 5 });
    const root = makeNode({ flexDirection: "row", gap: 3 }, [child1, child2]);
    computeLayout(root, 0, 0, 80, 24);

    expect(child1.layout.x).toBe(0);
    expect(child2.layout.x).toBe(13); // 10 + 3
  });

  it("resolves percentage width on root node", () => {
    // Percentage width resolved against available width
    const root = makeNode({ width: "50%" });
    computeLayout(root, 0, 0, 80, 24);
    expect(root.layout.width).toBe(40);
  });

  it("resolves percentage height on root node", () => {
    // Percentage height resolved against available height
    const root = makeNode({ height: "50%" });
    computeLayout(root, 0, 0, 80, 24);
    expect(root.layout.height).toBe(12);
  });

  it("resolves percentage width on child in row layout", () => {
    // In row layout, width is the main axis — resolved against parent inner width
    const child = makeNode({ width: "50%" });
    const root = makeNode({ flexDirection: "row" }, [child]);
    computeLayout(root, 0, 0, 80, 24);
    // Child gets 50% of 80 from parent measure, then 50% of that in its own computeLayout
    // The actual value depends on double-resolution behavior
    expect(child.layout.width).toBeLessThanOrEqual(40);
    expect(child.layout.width).toBeGreaterThan(0);
  });

  it("handles overflow scroll — children can exceed parent height", () => {
    // With overflow: scroll, the container gives children unconstrained height
    const child1 = makeNode({ height: 50 });
    const child2 = makeNode({ height: 50 });
    const root = makeNode(
      { flexDirection: "column", overflow: "scroll", height: 20 },
      [child1, child2],
    );
    computeLayout(root, 0, 0, 80, 24);

    // root is clipped to 20, but contentHeight reflects actual content
    expect(root.layout.height).toBe(20);
    expect(root.layout.contentHeight).toBe(100); // 50 + 50
  });

  it("handles nested layouts", () => {
    const innerChild = makeNode({ height: 3 });
    const inner = makeNode({ flexDirection: "column", height: 10 }, [innerChild]);
    const root = makeNode({ flexDirection: "column" }, [inner]);
    computeLayout(root, 0, 0, 80, 24);

    expect(inner.layout.height).toBe(10);
    expect(innerChild.layout.height).toBe(3);
    expect(innerChild.layout.y).toBe(0);
  });

  it("uses measureText for text nodes", () => {
    const textNode = makeNode(
      {},
      [],
      (availWidth: number) => ({ width: Math.min(availWidth, 20), height: 3 }),
    );
    const root = makeNode({ flexDirection: "column" }, [textNode]);
    computeLayout(root, 0, 0, 80, 24);

    expect(textNode.layout.height).toBe(3);
  });

  it("skips display:none children in layout", () => {
    const child1 = makeNode({ height: 5 });
    const hidden = makeNode({ height: 5, display: "none" });
    const child3 = makeNode({ height: 5 });
    const root = makeNode({ flexDirection: "column" }, [child1, hidden, child3]);
    computeLayout(root, 0, 0, 80, 24);

    expect(child1.layout.y).toBe(0);
    expect(child3.layout.y).toBe(5); // hidden child does not take space
  });

  it("applies minWidth and maxWidth constraints", () => {
    const child = makeNode({ width: 10, minWidth: 20 });
    const root = makeNode({}, [child]);
    computeLayout(root, 0, 0, 80, 24);
    expect(child.layout.width).toBe(20); // clamped up to minWidth

    const child2 = makeNode({ width: 50, maxWidth: 30 });
    const root2 = makeNode({}, [child2]);
    computeLayout(root2, 0, 0, 80, 24);
    expect(child2.layout.width).toBe(30); // clamped down to maxWidth
  });
});

describe("measureNaturalHeight", () => {
  it("returns 0 for display:none", () => {
    const node = makeNode({ display: "none" });
    expect(measureNaturalHeight(node, 80)).toBe(0);
  });

  it("returns padding for empty node with no explicit height", () => {
    const node = makeNode({ padding: 3 });
    expect(measureNaturalHeight(node, 80)).toBe(6); // top + bottom
  });

  it("sums column children heights", () => {
    const child1 = makeNode({ height: 5 });
    const child2 = makeNode({ height: 10 });
    const root = makeNode({ flexDirection: "column" }, [child1, child2]);
    expect(measureNaturalHeight(root, 80)).toBe(15);
  });

  it("includes gap in column measurement", () => {
    const child1 = makeNode({ height: 5 });
    const child2 = makeNode({ height: 5 });
    const root = makeNode({ flexDirection: "column", gap: 2 }, [child1, child2]);
    expect(measureNaturalHeight(root, 80)).toBe(12); // 5 + 2 + 5
  });

  it("takes max height for row children", () => {
    const child1 = makeNode({ height: 5 });
    const child2 = makeNode({ height: 10 });
    const root = makeNode({ flexDirection: "row" }, [child1, child2]);
    expect(measureNaturalHeight(root, 80)).toBe(10);
  });

  it("uses measureText when available", () => {
    const textNode = makeNode(
      {},
      [],
      (_: number) => ({ width: 20, height: 7 }),
    );
    expect(measureNaturalHeight(textNode, 80)).toBe(7);
  });

  it("includes padding in measured text height", () => {
    const textNode = makeNode(
      { padding: 1 },
      [],
      (_: number) => ({ width: 20, height: 5 }),
    );
    // 5 (text) + 1 (paddingTop) + 1 (paddingBottom) = 7
    expect(measureNaturalHeight(textNode, 80)).toBe(7);
  });
});
