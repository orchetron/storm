/**
 * Storm Ops — Diff Panel.
 *
 * Displays the latest file diff from agent edits using DiffView.
 */

import React from "react";
import {
  Box,
  Text,
  DiffView,
  ScrollView,
} from "../../../src/index.js";

const S = {
  arc: "#82AAFF",
  panelBorder: "#565F89",
};

export interface DiffPanelProps {
  diff: string;
  flex?: number;
}

export function DiffPanel({ diff, flex }: DiffPanelProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      flex={flex}
      borderStyle="round"
      borderColor={S.panelBorder}
      overflow="hidden"
    >
      <Box height={1} paddingX={1}>
        <Text color={S.arc} bold>{"Live Changes"}</Text>
      </Box>
      <Box flex={1} overflow="hidden">
        <ScrollView flex={1}>
          <Box paddingX={1}>
            <DiffView diff={diff} showLineNumbers={true} contextLines={3} />
          </Box>
        </ScrollView>
      </Box>
    </Box>
  );
}
