/**
 * ShowcaseAI — "AI-Native Widgets" showcase template.
 *
 * Demos: TokenStream, ContextWindow, CostTracker, ModelBadge,
 * CommandBlock, PerformanceHUD, OperationTree, StreamingText,
 * WelcomeBanner.
 */

import React from "react";
import { colors as defaultColors } from "../../theme/colors.js";
import { useColors } from "../../hooks/useColors.js";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { TokenStream } from "../../widgets/TokenStream.js";
import { ContextWindow } from "../../widgets/ContextWindow.js";
import { CostTracker } from "../../widgets/CostTracker.js";
import { ModelBadge } from "../../widgets/ModelBadge.js";
import { CommandBlock } from "../../widgets/CommandBlock.js";
import { PerformanceHUD } from "../../widgets/PerformanceHUD.js";
import { OperationTree } from "../../widgets/OperationTree.js";
import { StreamingText } from "../../widgets/StreamingText.js";
import { WelcomeBanner } from "../../widgets/WelcomeBanner.js";
import { ScrollView } from "../../components/ScrollView.js";
import { useTerminal } from "../../hooks/useTerminal.js";
import type { OpNode } from "../../widgets/OperationTree.js";

export interface ShowcaseAIProps {
  title?: string;
}

// heading and gap are plain helper functions used by ShowcaseAI below

const OP_NODES: OpNode[] = [
  { id: "op1", label: "Analyzing request", status: "completed", durationMs: 120 },
  {
    id: "op2", label: "Running tool: search", status: "running",
    children: [
      { id: "op2a", label: "Querying index", status: "completed", durationMs: 45 },
    ],
  },
  { id: "op3", label: "Composing response", status: "pending" },
];

const CONTEXT_BREAKDOWN = [
  { label: "System", tokens: 2000, color: defaultColors.brand.primary },
  { label: "User", tokens: 8000, color: defaultColors.success },
  { label: "Assistant", tokens: 5000, color: defaultColors.info },
];

export function ShowcaseAI(props: ShowcaseAIProps): React.ReactElement {
  const colors = useColors();
  const { title = "AI-Native Widgets" } = props;
  const { exit } = useTui();
  const { width } = useTerminal();

  useInput((event) => {
    if (event.key === "q" || event.char === "q") exit();
  });

  const heading = (label: string) => React.createElement("tui-text", { bold: true, color: colors.brand.primary }, `\n  ${label}`);
  const gap = () => React.createElement("tui-text", null, "");

  const header = React.createElement("tui-text", {
    bold: true, color: colors.brand.light,
  }, `  === ${title} ===`);

  // 1. TokenStream
  const tokenStream = React.createElement(TokenStream, {
    tokens: 1500, tokensPerSecond: 45, model: "qwen-2.5-72b", streaming: true,
  });

  // 2. ContextWindow
  const contextWindow = React.createElement(ContextWindow, {
    used: 15000, limit: 200000, breakdown: CONTEXT_BREAKDOWN,
  });

  // 3. CostTracker
  const costTracker = React.createElement(CostTracker, {
    inputTokens: 12000, outputTokens: 3000,
  });

  // 4. ModelBadge
  const modelBadge = React.createElement(ModelBadge, {
    model: "qwen-2.5-72b", provider: "community",
    capabilities: ["vision", "tools"],
  });

  // 5. CommandBlock
  const commandBlock = React.createElement(CommandBlock, {
    command: "npm test", exitCode: 0, duration: 2340,
    output: React.createElement("tui-text", { color: defaultColors.success }, "All tests passed"),
  });

  // 6. PerformanceHUD
  const perfHud = React.createElement(PerformanceHUD, {
    visible: true, fps: 60, renderTimeMs: 2.1,
  });

  // 7. OperationTree
  const opTree = React.createElement(OperationTree, {
    nodes: OP_NODES, showDuration: true,
  });

  // 8. StreamingText
  const streamingText = React.createElement(StreamingText, {
    text: "The answer to your question is being composed right now...",
    cursor: true, streaming: false,
  });

  // 9. WelcomeBanner
  const welcomeBanner = React.createElement(WelcomeBanner, {
    title: "STORM", subtitle: "Terminal UI Framework",
  });

  const footer = React.createElement("tui-text", { dim: true }, "  [q] Quit");

  return React.createElement(ScrollView, { flex: 1 },
    React.createElement("tui-box", {
      flexDirection: "column", width: width - 2,
    },
      header, gap(),
      heading("TokenStream"), React.createElement("tui-box", { marginLeft: 2 }, tokenStream), gap(),
      heading("ContextWindow"), React.createElement("tui-box", { marginLeft: 2 }, contextWindow), gap(),
      heading("CostTracker"), React.createElement("tui-box", { marginLeft: 2 }, costTracker), gap(),
      heading("ModelBadge"), React.createElement("tui-box", { marginLeft: 2 }, modelBadge), gap(),
      heading("CommandBlock"), React.createElement("tui-box", { marginLeft: 2 }, commandBlock), gap(),
      heading("PerformanceHUD"), React.createElement("tui-box", { marginLeft: 2 }, perfHud), gap(),
      heading("OperationTree"), React.createElement("tui-box", { marginLeft: 2 }, opTree), gap(),
      heading("StreamingText"), React.createElement("tui-box", { marginLeft: 2 }, streamingText), gap(),
      heading("WelcomeBanner"), React.createElement("tui-box", { marginLeft: 2 }, welcomeBanner), gap(),
      footer,
    ),
  );
}
