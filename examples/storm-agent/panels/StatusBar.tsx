/**
 * Storm Agent CLI -- StatusBar.
 *
 * No status bar is used. The footer is part of InputBar.
 * This file exists only as an empty export for backward compat.
 */

import React from "react";
import { Box } from "../../../src/index.js";

export interface StatusBarProps {
  agentName: string;
  model: string;
  tokens: number;
  cost: number;
}

export function StatusBar(_props: StatusBarProps): React.ReactElement {
  // No status bar -- the footer is built into InputBar.
  return <Box height={0} />;
}
