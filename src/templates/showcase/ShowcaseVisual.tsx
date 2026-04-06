import React from "react";
import { useColors } from "../../hooks/useColors.js";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { Gradient } from "../../components/effects/Gradient.js";
import { GradientBorder } from "../../components/effects/GradientBorder.js";
import { GlowText } from "../../components/effects/GlowText.js";
import { Digits } from "../../components/effects/Digits.js";
import { Placeholder } from "../../components/extras/Placeholder.js";
import { RevealTransition } from "../../components/effects/RevealTransition.js";
import { GradientProgress } from "../../components/effects/GradientProgress.js";
import { Divider as Separator } from "../../components/core/Divider.js";
import { Image } from "../../components/effects/Image.js";
import { ScrollView } from "../../components/core/ScrollView.js";
import { useTerminal } from "../../hooks/useTerminal.js";

export interface ShowcaseVisualProps {
  title?: string;
}

function heading(label: string): React.ReactElement {
  const colors = useColors();
  return React.createElement("tui-text", { bold: true, color: colors.brand.primary }, `\n  ${label}`);
}

function gap(): React.ReactElement {
  const colors = useColors();
  return React.createElement("tui-text", null, "");
}

export function ShowcaseVisual(props: ShowcaseVisualProps): React.ReactElement {
  const colors = useColors();
  const { title = "Visual Effects" } = props;
  const { exit } = useTui();
  const { width } = useTerminal();

  useInput((event) => {
    if (event.key === "q" || event.char === "q") exit();
  });

  const header = React.createElement("tui-text", {
    bold: true, color: colors.brand.light,
  }, `  === ${title} ===`);

  // 1. Gradient
  const gradient = React.createElement(Gradient, {
    colors: [colors.brand.primary, colors.success],
    children: "Storm TUI Framework",
  });

  // 2. GradientBorder
  const gradientBorder = React.createElement(GradientBorder, {
    width: 30,
    children: React.createElement("tui-text", null, "Hello"),
  });

  // 3. GlowText
  const glowText = React.createElement(GlowText, {
    intensity: "medium",
    children: "Electric",
  });

  // 4. Digits
  const digits = React.createElement(Digits, { value: "12:34" });

  // 5. Placeholder
  const placeholder = React.createElement(Placeholder, {
    width: 20, height: 3, label: "Coming Soon",
  });

  // 6. RevealTransition
  const reveal = React.createElement(RevealTransition, {
    visible: true, type: "fade",
    children: React.createElement("tui-box", {
      borderStyle: "single", borderColor: colors.text.dim, paddingX: 1,
    }, React.createElement("tui-text", null, "Revealed content")),
  });

  // 7. GradientProgress
  const gradientProgress = React.createElement(GradientProgress, {
    value: 72, showPercentage: true,
  });

  // 8. Separator — all 4 styles
  const sepLine = React.createElement(Separator, { style: "line", label: "line" });
  const sepDashed = React.createElement(Separator, { style: "dashed", label: "dashed" });
  const sepDotted = React.createElement(Separator, { style: "dotted", label: "dotted" });
  const sepStorm = React.createElement(Separator, { style: "storm", label: "storm" });

  // 9. Image — block fallback
  const image = React.createElement(Image, {
    src: "", protocol: "block", alt: "Photo", width: 10, height: 3,
  });

  const footer = React.createElement("tui-text", { dim: true }, "  [q] Quit");

  return React.createElement(ScrollView, { flex: 1 },
    React.createElement("tui-box", {
      flexDirection: "column", width: width - 2,
    },
      header, gap(),
      heading("Gradient"), React.createElement("tui-box", { marginLeft: 2 }, gradient), gap(),
      heading("GradientBorder"), React.createElement("tui-box", { marginLeft: 2 }, gradientBorder), gap(),
      heading("GlowText"), React.createElement("tui-box", { marginLeft: 2 }, glowText), gap(),
      heading("Digits"), React.createElement("tui-box", { marginLeft: 2 }, digits), gap(),
      heading("Placeholder"), React.createElement("tui-box", { marginLeft: 2 }, placeholder), gap(),
      heading("RevealTransition"), React.createElement("tui-box", { marginLeft: 2 }, reveal), gap(),
      heading("GradientProgress"), React.createElement("tui-box", { marginLeft: 2 }, gradientProgress), gap(),
      heading("Separator — all 4 styles"),
      sepLine, sepDashed, sepDotted, sepStorm, gap(),
      heading("Image (block fallback)"), React.createElement("tui-box", { marginLeft: 2 }, image), gap(),
      footer,
    ),
  );
}
