# Core Components

Fundamental building blocks for layout and text rendering.

## Core

### Box

Flexbox container -- the primary layout primitive. Arranges children vertically (default) or horizontally with full flexbox semantics, CSS Grid support, borders, padding, margin, and background color.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Child elements |
| `flexDirection` | `"column" \| "row" \| "column-reverse" \| "row-reverse"` | `"column"` | Primary axis direction |
| `flex` | `number` | -- | Shorthand for flex-grow |
| `flexGrow` | `number` | -- | How much to grow relative to siblings |
| `flexShrink` | `number` | -- | How much to shrink relative to siblings |
| `flexBasis` | `number` | -- | Initial size before grow/shrink |
| `flexWrap` | `"nowrap" \| "wrap" \| "wrap-reverse"` | `"nowrap"` | Whether children wrap |
| `gap` | `number` | -- | Space between children (both axes) |
| `columnGap` | `number` | -- | Horizontal gap between children |
| `rowGap` | `number` | -- | Vertical gap between children |
| `alignItems` | `"flex-start" \| "center" \| "flex-end" \| "stretch"` | `"stretch"` | Cross-axis alignment |
| `alignSelf` | `"auto" \| "flex-start" \| "center" \| "flex-end" \| "stretch"` | `"auto"` | Override parent alignItems |
| `justifyContent` | `"flex-start" \| "center" \| "flex-end" \| "space-between" \| "space-around" \| "space-evenly"` | `"flex-start"` | Main-axis alignment |
| `width` | `number \| \`${number}%\`` | -- | Explicit width |
| `height` | `number \| \`${number}%\`` | -- | Explicit height |
| `minWidth` | `number` | -- | Minimum width |
| `maxWidth` | `number` | -- | Maximum width |
| `minHeight` | `number` | -- | Minimum height |
| `maxHeight` | `number` | -- | Maximum height |
| `overflow` | `"visible" \| "hidden" \| "scroll"` | `"visible"` | Content overflow behavior |
| `overflowX` | `"visible" \| "hidden" \| "scroll"` | -- | Horizontal overflow |
| `overflowY` | `"visible" \| "hidden" \| "scroll"` | -- | Vertical overflow |
| `display` | `"flex" \| "grid" \| "none"` | `"flex"` | Display mode |
| `position` | `"relative" \| "absolute"` | `"relative"` | Positioning mode |
| `top` | `number` | -- | Offset from top (absolute positioning) |
| `left` | `number` | -- | Offset from left (absolute positioning) |
| `right` | `number` | -- | Offset from right (absolute positioning) |
| `bottom` | `number` | -- | Offset from bottom (absolute positioning) |
| `padding` | `number` | -- | Padding on all sides |
| `paddingX` | `number` | -- | Horizontal padding |
| `paddingY` | `number` | -- | Vertical padding |
| `paddingTop` | `number` | -- | Top padding |
| `paddingBottom` | `number` | -- | Bottom padding |
| `paddingLeft` | `number` | -- | Left padding |
| `paddingRight` | `number` | -- | Right padding |
| `margin` | `number` | -- | Margin on all sides |
| `marginX` | `number` | -- | Horizontal margin |
| `marginY` | `number` | -- | Vertical margin |
| `marginTop` | `number` | -- | Top margin |
| `marginBottom` | `number` | -- | Bottom margin |
| `marginLeft` | `number` | -- | Left margin |
| `marginRight` | `number` | -- | Right margin |
| `borderStyle` | `"single" \| "double" \| "round" \| "bold" \| "classic"` | -- | Border style |
| `borderColor` | `string \| number` | -- | Border color |
| `borderTop` | `boolean` | `true` | Show top border |
| `borderBottom` | `boolean` | `true` | Show bottom border |
| `borderLeft` | `boolean` | `true` | Show left border |
| `borderRight` | `boolean` | `true` | Show right border |
| `borderDimColor` | `boolean` | -- | Dim all borders |
| `backgroundColor` | `string \| number` | -- | Background color |
| `opaque` | `boolean` | -- | Fill background even in empty cells |
| `sticky` | `boolean` | -- | Stick to top of ScrollView |
| `stickyChildren` | `boolean` | -- | Enable sticky for children |
| `userSelect` | `boolean` | -- | Allow text selection |
| `aria-label` | `string` | -- | Accessibility label |
| `aria-hidden` | `boolean` | -- | Hide from accessibility tree |
| `background` | `BackgroundProp` | -- | Background pattern painted into the buffer before children. Accepts preset ("dots", "grid", "crosshatch") or full BackgroundPattern object for gradients, watermarks, animation. |

**Basic: Two-column layout**

```tsx
import { Box, Text } from "@orchetron/storm";

<Box flexDirection="row" gap={2} padding={1} borderStyle="round" borderColor="#82AAFF">
  <Box width={20}>
    <Text bold>Sidebar</Text>
  </Box>
  <Box flex={1}>
    <Text>Main content</Text>
  </Box>
</Box>
```

**Background patterns**

```tsx
<Box background="dots">
  <Text>Content on dot pattern</Text>
</Box>

<Box background={{ type: "gradient", gradient: ["#1a1b26", "#82AAFF"] }}>
  <Text>Gradient background</Text>
</Box>
```

**Advanced: Grid layout with nested containers**

```tsx
<Box display="flex" flexDirection="column" height="100%">
  <Box borderStyle="double" borderColor="#82AAFF" padding={1}>
    <Text bold color="#82AAFF">Header</Text>
  </Box>
  <Box flexDirection="row" flex={1} gap={1}>
    <Box width={30} borderStyle="single" borderColor="#505050" paddingX={1}>
      <Text bold>Navigation</Text>
    </Box>
    <Box flex={1} padding={1}>
      <Text>Content area with flex grow</Text>
    </Box>
    <Box width={25} borderStyle="single" borderColor="#505050" paddingX={1}>
      <Text bold>Details</Text>
    </Box>
  </Box>
  <Box borderStyle="single" borderColor="#505050" paddingX={1}>
    <Text dim>Status bar</Text>
  </Box>
</Box>
```

---

### Text

Styled text with color, weight, and formatting. Supports inline nesting for mixed styles within a line. Text wraps by default.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Text content or nested Text elements |
| `color` | `string \| number` | -- | Foreground color (hex, named, or 256-color index) |
| `bgColor` | `string \| number` | -- | Background color |
| `backgroundColor` | `string \| number` | -- | Alias for `bgColor` |
| `bold` | `boolean` | `false` | Bold weight |
| `dim` | `boolean` | `false` | Dim/faint rendering |
| `dimColor` | `boolean` | `false` | Alias for `dim` |
| `italic` | `boolean` | `false` | Italic style |
| `underline` | `boolean` | `false` | Underline decoration |
| `strikethrough` | `boolean` | `false` | Strikethrough decoration |
| `inverse` | `boolean` | `false` | Swap foreground and background |
| `wrap` | `"wrap" \| "truncate" \| "truncate-start" \| "truncate-end" \| "truncate-middle"` | `"wrap"` | Text overflow behavior |
| `align` | `"left" \| "center" \| "right"` | `"left"` | Text alignment (adds a wrapper Box) |
| `aria-label` | `string` | -- | Accessibility label |
| `aria-hidden` | `boolean` | -- | Hide from accessibility tree |

**Basic: Styled inline text**

```tsx
import { Text } from "@orchetron/storm";

<Text color="#82AAFF" bold>
  Hello <Text underline>world</Text>
</Text>
```

**Advanced: Mixed formatting with truncation**

```tsx
<Text>
  <Text color="#34D399" bold>SUCCESS</Text>
  <Text dim> | </Text>
  <Text color="#D4D4D4">Operation completed in </Text>
  <Text color="#FBBF24" bold>42ms</Text>
</Text>

<Text wrap="truncate-middle" color="#808080">
  /very/long/path/to/some/deeply/nested/file/in/project/src/components/Widget.tsx
</Text>
```

---

### ScrollView

Scrollable container with hit-tested mouse scroll, keyboard navigation, optional scrollbar, stick-to-bottom, and automatic windowing for large child counts.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Scrollable content |
| `stickToBottom` | `boolean` | `false` | Auto-scroll when new content is added at bottom |
| `scrollSpeed` | `number` | `3` | Lines per mouse scroll tick |
| `scrollStateRef` | `MutableRefObject<ScrollState>` | -- | Ref to access scroll state imperatively |
| `onScroll` | `(scrollTop: number) => void` | -- | Called on scroll position change |
| `scrollbarThumbColor` | `string \| number` | -- | Scrollbar thumb color |
| `scrollbarTrackColor` | `string \| number` | -- | Scrollbar track color |
| `scrollbarChar` | `string` | -- | Custom scrollbar thumb character |
| `scrollbarTrackChar` | `string` | -- | Custom scrollbar track character |
| `maxRenderChildren` | `number` | `500` | Max children before windowing activates |
| `itemHeight` | `number` | `1` | Estimated child height for windowing calculations |
| `sticky` | `boolean` | -- | Enable sticky positioning |
| `stickyChildren` | `boolean` | -- | Enable sticky for children |
| _Plus all Box layout props_ | | | `width`, `height`, `flex`, `padding*`, `margin*`, `borderStyle`, etc. |

**Basic: Chat log with stick-to-bottom**

```tsx
import { ScrollView, Text } from "@orchetron/storm";

<ScrollView flex={1} stickToBottom scrollbarThumbColor="#82AAFF">
  {messages.map((msg) => (
    <Text key={msg.id}>{msg.text}</Text>
  ))}
</ScrollView>
```

**Advanced: Controlled scroll with imperative access**

```tsx
import { ScrollView, Box, Text, Button } from "@orchetron/storm";
import { useRef } from "react";
import type { ScrollState } from "@orchetron/storm";

function LogViewer({ entries }: { entries: string[] }) {
  const scrollState = useRef<ScrollState | null>(null);

  return (
    <Box flexDirection="column" height={20}>
      <ScrollView
        flex={1}
        scrollStateRef={scrollState}
        stickToBottom={false}
        scrollbarThumbColor="#82AAFF"
        scrollbarTrackColor="#1E1E1E"
        borderStyle="single"
        borderColor="#505050"
        onScroll={(top) => console.log("scroll:", top)}
        maxRenderChildren={200}
        itemHeight={1}
      >
        {entries.map((entry, i) => (
          <Text key={i} color={entry.startsWith("ERROR") ? "#F87171" : "#D4D4D4"}>
            {entry}
          </Text>
        ))}
      </ScrollView>
      <Button label="Jump to bottom" onPress={() => scrollState.current?.scrollToBottom()} />
    </Box>
  );
}
```

See [Common Pitfalls](../pitfalls.md#2-scrollview-needs-a-height-constraint) for height constraint requirements.

---

### Overlay

Positioned overlay rendered on top of all other content. Overlays are painted in a second pass, overwriting cells from the normal element tree.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Overlay content |
| `visible` | `boolean` | `true` | Whether overlay is shown |
| `position` | `"center" \| "bottom" \| "top" \| "center-left" \| "center-right"` | `"center"` | Screen position |
| `width` | `number \| \`${number}%\`` | -- | Overlay width |
| `height` | `number` | -- | Overlay height |
| `minWidth` | `number` | -- | Minimum width |
| `maxWidth` | `number` | -- | Maximum width |
| `minHeight` | `number` | -- | Minimum height |
| `maxHeight` | `number` | -- | Maximum height |
| `borderStyle` | `"single" \| "double" \| "round" \| "bold" \| "classic"` | -- | Border style |
| `borderColor` | `string \| number` | -- | Border color |
| `padding` | `number` | -- | Padding on all sides |
| `paddingX` | `number` | -- | Horizontal padding |
| `paddingY` | `number` | -- | Vertical padding |

**Basic: Centered notification**

```tsx
import { Overlay, Text } from "@orchetron/storm";

<Overlay visible={showNotification} position="center" borderStyle="round" borderColor="#82AAFF" padding={2}>
  <Text bold>Operation complete!</Text>
</Overlay>
```

**Advanced: Bottom-positioned status overlay**

```tsx
<Overlay visible={true} position="bottom" width={60} borderStyle="single" borderColor="#FBBF24" paddingX={2}>
  <Text color="#FBBF24" bold>WARNING</Text>
  <Text> Connection unstable. Retrying in {countdown}s...</Text>
</Overlay>
```

---

### Spacer

Flexible space that expands to fill available room. Equivalent to a Box with `flex={1}`. Takes no props and no children.

| Prop | Type | Default | Description |
|---|---|---|---|
| _(none)_ | | | Spacer takes no props |

**Basic: Push items apart**

```tsx
import { Box, Text, Spacer } from "@orchetron/storm";

<Box flexDirection="row">
  <Text bold>Left</Text>
  <Spacer />
  <Text dim>Right</Text>
</Box>
```

**Advanced: Header with centered title**

```tsx
<Box flexDirection="row" paddingX={1}>
  <Text color="#82AAFF">storm v2.1</Text>
  <Spacer />
  <Text bold>Dashboard</Text>
  <Spacer />
  <Text dim>Ctrl+Q quit</Text>
</Box>
```

---

---
[Back to Components](README.md)
