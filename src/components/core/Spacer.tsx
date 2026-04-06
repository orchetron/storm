import React from "react";

export const Spacer = React.memo(function Spacer(): React.ReactElement {
  return React.createElement("tui-box", { flex: 1 });
});
