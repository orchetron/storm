/**
 * Storm Ops — Event Log.
 *
 * Scrolling event log with timestamps and level-based coloring.
 */

import React from "react";
import {
  Box,
  Text,
  RichLog,
  type LogEntry,
} from "../../../src/index.js";

const S = {
  arc: "#82AAFF",
  panelBorder: "#565F89",
};

export interface EventLogProps {
  events: LogEntry[];
  flex?: number;
}

export function EventLog({ events, flex }: EventLogProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      flex={flex}
      borderStyle="round"
      borderColor={S.panelBorder}
      overflow="hidden"
    >
      <Box height={1} paddingX={1}>
        <Text color={S.arc} bold>{"Event Log"}</Text>
      </Box>
      <Box flex={1} overflow="hidden" paddingX={1}>
        <RichLog entries={events} maxVisible={8} showTimestamp={true} autoScroll={true} />
      </Box>
    </Box>
  );
}
