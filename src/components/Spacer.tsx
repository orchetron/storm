/**
 * Spacer — flex spacer component.
 *
 * Renders a `tui-box` with `flex={1}` to push siblings apart.
 * Takes no children.
 */

import React from "react";

export const Spacer = React.memo(function Spacer(): React.ReactElement {
  return React.createElement("tui-box", { flex: 1 });
});
