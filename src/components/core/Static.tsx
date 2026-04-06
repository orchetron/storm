import React, { useRef } from "react";

export interface StaticProps<T> {
  items: T[];
  children: (item: T, index: number) => React.ReactNode;
}

// Use unknown-typed props for the memo boundary so we avoid generic inference issues.
interface MemoItemProps {
  item: unknown;
  index: number;
  renderFn: (item: unknown, index: number) => React.ReactNode;
}

// A memoized wrapper that only re-renders if item or index changes.
const MemoItem = React.memo(function MemoItem(props: MemoItemProps): React.ReactElement {
  return React.createElement(React.Fragment, null, props.renderFn(props.item, props.index));
});

function StaticInner<T>(props: StaticProps<T>): React.ReactElement {
  const { items, children: renderFn } = props;

  // Keep a stable reference to the render function to avoid unnecessary re-renders
  const renderFnRef = useRef(renderFn);
  renderFnRef.current = renderFn;

  const stableRenderFn = useRef(
    (item: unknown, index: number) => renderFnRef.current(item as T, index),
  );

  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    // Index keys are safe here: Static items are append-only (memoized,
    // never reordered or removed), so index === stable identity.
    ...items.map((item, index) =>
      React.createElement(MemoItem, {
        key: index,
        item: item as unknown,
        index,
        renderFn: stableRenderFn.current,
      }),
    ),
  );
}

export const Static = React.memo(StaticInner) as typeof StaticInner;
