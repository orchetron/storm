import { describe, it, expect } from "vitest";
import {
  computeLayout,
  type LayoutNode,
  type LayoutProps,
} from "../layout/engine.js";

// ── Helpers ────────────────────────────────────────────────────────────

/** Generate a random integer between min and max (inclusive). */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Run a property test N times with random inputs. */
function forAll(name: string, times: number, fn: () => void) {
  it(name, () => {
    for (let i = 0; i < times; i++) fn();
  });
}

/** Create a LayoutNode with sensible defaults. */
function makeNode(
  props: LayoutProps,
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

/** Deep-clone a LayoutNode tree (for determinism checks). */
function cloneNode(node: LayoutNode): LayoutNode {
  return {
    props: { ...node.props },
    children: node.children.map(cloneNode),
    layout: { ...node.layout },
    ...(node.measureText ? { measureText: node.measureText } : {}),
  };
}

/** Generate a random child node with random flex/width/height. */
function randomChild(): LayoutNode {
  const hasExplicitWidth = Math.random() < 0.5;
  const hasExplicitHeight = Math.random() < 0.5;
  const hasFlexGrow = Math.random() < 0.5;
  const props: LayoutProps = {};
  if (hasExplicitWidth) props.width = randInt(1, 40);
  if (hasExplicitHeight) props.height = randInt(1, 20);
  if (hasFlexGrow) props.flexGrow = randInt(1, 5);
  return makeNode(props);
}

// ── Property Tests ─────────────────────────────────────────────────────

describe("layout property-based tests", () => {

  // 1. Children never exceed parent bounds on the cross axis
  //    (In a column layout, children width <= parent width; in row, height <= parent height)
  //    On the main axis, children with explicit sizes can exceed parent bounds (overflow).
  describe("children do not exceed parent cross-axis bounds", () => {
    forAll("child cross-axis dimension fits within parent", 100, () => {
      const parentW = randInt(20, 120);
      const parentH = randInt(10, 60);
      const numChildren = randInt(1, 5);
      // Children using flexGrow only (no explicit sizes that could overflow)
      const children = Array.from({ length: numChildren }, () =>
        makeNode({ flexGrow: randInt(1, 5) }),
      );
      const direction = Math.random() < 0.5 ? "column" as const : "row" as const;
      const root = makeNode(
        { flexDirection: direction, width: parentW, height: parentH },
        children,
      );
      computeLayout(root, 0, 0, parentW, parentH);

      for (const child of children) {
        if (direction === "column") {
          // Cross axis is width — child should not exceed parent width
          expect(child.layout.width).toBeLessThanOrEqual(parentW);
          // Main axis: flex children share parent height
          expect(child.layout.x).toBeGreaterThanOrEqual(root.layout.x);
        } else {
          // Cross axis is height — child should not exceed parent height
          expect(child.layout.height).toBeLessThanOrEqual(parentH);
          expect(child.layout.y).toBeGreaterThanOrEqual(root.layout.y);
        }
      }
    });
  });

  // 2. Flex ratios are proportional
  describe("flex ratios are proportional", () => {
    forAll("children sizes proportional to flexGrow", 100, () => {
      const numChildren = randInt(2, 5);
      const flexValues = Array.from({ length: numChildren }, () => randInt(1, 10));
      const totalFlex = flexValues.reduce((a, b) => a + b, 0);
      const parentSize = randInt(20, 200);
      const direction = Math.random() < 0.5 ? "column" as const : "row" as const;

      const children = flexValues.map(f => makeNode({ flexGrow: f }));
      const root = makeNode(
        { flexDirection: direction, width: parentSize, height: parentSize },
        children,
      );
      computeLayout(root, 0, 0, parentSize, parentSize);

      const axis = direction === "column" ? "height" : "width";
      for (let i = 0; i < numChildren; i++) {
        const expectedSize = Math.floor((flexValues[i]! / totalFlex) * parentSize);
        // Within 1px of expected due to integer rounding
        expect(Math.abs(children[i]!.layout[axis] - expectedSize)).toBeLessThanOrEqual(1);
      }
    });
  });

  // 3. Padding reduces inner dimensions
  describe("padding reduces inner dimensions", () => {
    forAll("innerWidth = width - paddingLeft - paddingRight", 100, () => {
      const w = randInt(20, 120);
      const h = randInt(10, 60);
      const padTop = randInt(0, 5);
      const padBottom = randInt(0, 5);
      const padLeft = randInt(0, 5);
      const padRight = randInt(0, 5);

      const node = makeNode({
        width: w, height: h,
        paddingTop: padTop, paddingBottom: padBottom,
        paddingLeft: padLeft, paddingRight: padRight,
      });
      computeLayout(node, 0, 0, w, h);

      expect(node.layout.innerWidth).toBe(w - padLeft - padRight);
      expect(node.layout.innerHeight).toBe(h - padTop - padBottom);
      expect(node.layout.innerX).toBe(padLeft);
      expect(node.layout.innerY).toBe(padTop);
    });
  });

  // 4. Children with percentage widths sum correctly
  describe("percentage width children fill parent", () => {
    it("50% + 50% fills parent width in row layout", () => {
      const parentW = 80;
      const child1 = makeNode({ width: "50%" });
      const child2 = makeNode({ width: "50%" });
      const root = makeNode({ flexDirection: "row", width: parentW, height: 24 }, [child1, child2]);
      computeLayout(root, 0, 0, parentW, 24);

      const totalChildWidth = child1.layout.width + child2.layout.width;
      expect(totalChildWidth).toBeLessThanOrEqual(parentW);
      expect(totalChildWidth).toBeGreaterThan(0);
    });

    it("33% + 33% + 34% children all have positive widths that sum <= parent", () => {
      const parentW = 90;
      const child1 = makeNode({ width: "33%" });
      const child2 = makeNode({ width: "33%" });
      const child3 = makeNode({ width: "34%" });
      const root = makeNode({ flexDirection: "row", width: parentW, height: 24 }, [child1, child2, child3]);
      computeLayout(root, 0, 0, parentW, 24);

      // Each child should have a positive width
      expect(child1.layout.width).toBeGreaterThan(0);
      expect(child2.layout.width).toBeGreaterThan(0);
      expect(child3.layout.width).toBeGreaterThan(0);
      // Total should not exceed parent
      const totalChildWidth = child1.layout.width + child2.layout.width + child3.layout.width;
      expect(totalChildWidth).toBeLessThanOrEqual(parentW);
    });
  });

  // 5. Layout is deterministic
  describe("layout is deterministic", () => {
    forAll("same input produces same output", 100, () => {
      const w = randInt(20, 120);
      const h = randInt(10, 60);
      const numChildren = randInt(0, 4);
      const childProps: LayoutProps[] = Array.from({ length: numChildren }, () => ({
        flexGrow: randInt(1, 5),
        height: randInt(1, 15),
      }));

      // First run
      const children1 = childProps.map(p => makeNode({ ...p }));
      const root1 = makeNode({ flexDirection: "column", width: w, height: h }, children1);
      computeLayout(root1, 0, 0, w, h);

      // Second run with identical props
      const children2 = childProps.map(p => makeNode({ ...p }));
      const root2 = makeNode({ flexDirection: "column", width: w, height: h }, children2);
      computeLayout(root2, 0, 0, w, h);

      // Root layouts must match
      expect(root1.layout).toEqual(root2.layout);
      // Children layouts must match
      for (let i = 0; i < numChildren; i++) {
        expect(children1[i]!.layout).toEqual(children2[i]!.layout);
      }
    });
  });

  // 6. Gap adds space between children only
  describe("gap adds space between children only", () => {
    forAll("total gap space = (N-1) * gap in column layout", 100, () => {
      const numChildren = randInt(2, 6);
      const gap = randInt(1, 5);
      const childHeight = randInt(1, 10);
      const parentH = numChildren * childHeight + (numChildren - 1) * gap + 10; // extra room

      const children = Array.from({ length: numChildren }, () =>
        makeNode({ height: childHeight }),
      );
      const root = makeNode(
        { flexDirection: "column", gap, width: 80, height: parentH },
        children,
      );
      computeLayout(root, 0, 0, 80, parentH);

      // Check that each child is positioned at the expected Y offset
      for (let i = 0; i < numChildren; i++) {
        const expectedY = i * (childHeight + gap);
        expect(children[i]!.layout.y).toBe(expectedY);
      }

      // The total space consumed = last child bottom - first child top
      const lastChild = children[numChildren - 1]!;
      const totalUsed = lastChild.layout.y + lastChild.layout.height - children[0]!.layout.y;
      const expectedTotal = numChildren * childHeight + (numChildren - 1) * gap;
      expect(totalUsed).toBe(expectedTotal);
    });

    forAll("total gap space = (N-1) * gap in row layout", 100, () => {
      const numChildren = randInt(2, 6);
      const gap = randInt(1, 5);
      const childWidth = randInt(1, 10);
      const parentW = numChildren * childWidth + (numChildren - 1) * gap + 10;

      const children = Array.from({ length: numChildren }, () =>
        makeNode({ width: childWidth, height: 5 }),
      );
      const root = makeNode(
        { flexDirection: "row", gap, width: parentW, height: 24 },
        children,
      );
      computeLayout(root, 0, 0, parentW, 24);

      for (let i = 0; i < numChildren; i++) {
        const expectedX = i * (childWidth + gap);
        expect(children[i]!.layout.x).toBe(expectedX);
      }
    });
  });

  // 7. Min/max width constraints are respected
  describe("min/max width constraints are respected", () => {
    forAll("minWidth is always respected", 100, () => {
      const minW = randInt(10, 40);
      const requestedW = randInt(1, minW - 1); // smaller than min
      const child = makeNode({ width: requestedW, minWidth: minW });
      const root = makeNode({ width: 120, height: 24 }, [child]);
      computeLayout(root, 0, 0, 120, 24);

      expect(child.layout.width).toBeGreaterThanOrEqual(minW);
    });

    forAll("maxWidth is always respected", 100, () => {
      const maxW = randInt(10, 40);
      const requestedW = randInt(maxW + 1, 100); // larger than max
      const child = makeNode({ width: requestedW, maxWidth: maxW });
      const root = makeNode({ width: 120, height: 24 }, [child]);
      computeLayout(root, 0, 0, 120, 24);

      expect(child.layout.width).toBeLessThanOrEqual(maxW);
    });

    forAll("minHeight is always respected", 100, () => {
      const minH = randInt(5, 20);
      const requestedH = randInt(1, minH - 1);
      const child = makeNode({ height: requestedH, minHeight: minH });
      const root = makeNode({ width: 80, height: 60 }, [child]);
      computeLayout(root, 0, 0, 80, 60);

      expect(child.layout.height).toBeGreaterThanOrEqual(minH);
    });

    forAll("maxHeight is always respected", 100, () => {
      const maxH = randInt(5, 20);
      const requestedH = randInt(maxH + 1, 60);
      const child = makeNode({ height: requestedH, maxHeight: maxH });
      const root = makeNode({ width: 80, height: 60 }, [child]);
      computeLayout(root, 0, 0, 80, 60);

      expect(child.layout.height).toBeLessThanOrEqual(maxH);
    });
  });

  // 8. Absolute positioning doesn't affect siblings
  describe("absolute positioning does not affect siblings", () => {
    forAll("absolute child does not push siblings", 100, () => {
      const childH = randInt(1, 10);
      const child1 = makeNode({ height: childH });
      const child2 = makeNode({ height: childH });
      const child3 = makeNode({ height: childH });

      // Layout without absolute child
      const rootWithout = makeNode(
        { flexDirection: "column", width: 80, height: 60 },
        [makeNode({ height: childH }), makeNode({ height: childH })],
      );
      computeLayout(rootWithout, 0, 0, 80, 60);

      const yWithout0 = rootWithout.children[0]!.layout.y;
      const yWithout1 = rootWithout.children[1]!.layout.y;

      // Layout with an absolute child inserted between the two
      const absChild = makeNode({
        position: "absolute",
        width: randInt(5, 30),
        height: randInt(5, 30),
        top: randInt(0, 10),
        left: randInt(0, 10),
      });
      const rootWith = makeNode(
        { flexDirection: "column", width: 80, height: 60 },
        [child1, absChild, child2],
      );
      computeLayout(rootWith, 0, 0, 80, 60);

      // The non-absolute children should have the same positions
      expect(child1.layout.y).toBe(yWithout0);
      expect(child2.layout.y).toBe(yWithout1);
    });
  });

  // 9. Content height is at least inner height
  describe("contentHeight >= innerHeight", () => {
    forAll("contentHeight is at least innerHeight", 100, () => {
      const w = randInt(20, 120);
      const h = randInt(10, 60);
      const numChildren = randInt(0, 3);
      const children = Array.from({ length: numChildren }, () =>
        makeNode({ height: randInt(1, 10) }),
      );
      const node = makeNode(
        { flexDirection: "column", width: w, height: h },
        children,
      );
      computeLayout(node, 0, 0, w, h);

      // contentHeight should be at least innerHeight for nodes without overflow
      // (the engine may clamp content to the container)
      expect(node.layout.contentHeight).toBeGreaterThanOrEqual(0);
      // For scroll containers, contentHeight may exceed height
      // For non-scroll, contentHeight should equal innerHeight at minimum
      expect(node.layout.contentHeight).toBeGreaterThanOrEqual(node.layout.innerHeight);
    });
  });

  // 10. Layout handles zero dimensions gracefully
  describe("layout handles zero dimensions gracefully", () => {
    forAll("zero width does not crash and produces non-negative values", 100, () => {
      const h = randInt(0, 60);
      const numChildren = randInt(0, 3);
      const children = Array.from({ length: numChildren }, () => randomChild());
      const node = makeNode(
        { flexDirection: "column", width: 0, height: h },
        children,
      );

      // Should not throw
      expect(() => computeLayout(node, 0, 0, 0, h)).not.toThrow();

      // All values should be >= 0
      expect(node.layout.width).toBeGreaterThanOrEqual(0);
      expect(node.layout.height).toBeGreaterThanOrEqual(0);
      expect(node.layout.innerWidth).toBeGreaterThanOrEqual(0);
      expect(node.layout.innerHeight).toBeGreaterThanOrEqual(0);
      for (const child of children) {
        expect(child.layout.width).toBeGreaterThanOrEqual(0);
        expect(child.layout.height).toBeGreaterThanOrEqual(0);
      }
    });

    forAll("zero height does not crash and produces non-negative values", 100, () => {
      const w = randInt(0, 120);
      const numChildren = randInt(0, 3);
      const children = Array.from({ length: numChildren }, () => randomChild());
      const node = makeNode(
        { flexDirection: "row", width: w, height: 0 },
        children,
      );

      expect(() => computeLayout(node, 0, 0, w, 0)).not.toThrow();

      expect(node.layout.width).toBeGreaterThanOrEqual(0);
      expect(node.layout.height).toBeGreaterThanOrEqual(0);
      for (const child of children) {
        expect(child.layout.width).toBeGreaterThanOrEqual(0);
        expect(child.layout.height).toBeGreaterThanOrEqual(0);
      }
    });

    it("both dimensions zero does not crash", () => {
      const node = makeNode({ width: 0, height: 0 }, [makeNode({}), makeNode({})]);
      expect(() => computeLayout(node, 0, 0, 0, 0)).not.toThrow();
      expect(node.layout.width).toBe(0);
      expect(node.layout.height).toBe(0);
    });
  });
});
