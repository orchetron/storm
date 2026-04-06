# Feedback Components

User feedback indicators, notifications, and status displays.


## Feedback

### Spinner

Animated loading indicator with 6 built-in styles. Uses imperative mutation and `requestRender()` for zero GC pressure animation.

| Prop | Type | Default | Description |
|---|---|---|---|
| `type` | `"dots" \| "line" \| "arc" \| "bounce" \| "braille" \| "storm"` | `"dots"` | Animation style |
| `interval` | `number` | `80` | Frame interval in milliseconds |
| `label` | `string` | -- | Text shown after spinner |
| `labelColor` | `string \| number` | -- | Label color |
| `color` | `string \| number` | `colors.brand.primary` | Spinner color |
| `bold` | `boolean` | -- | Bold spinner |
| `dim` | `boolean` | -- | Dim spinner |

**Basic: Loading spinner**

```tsx
import { Spinner } from "@orchetron/storm";

<Spinner type="dots" label="Loading..." color="#82AAFF" />
```

**Advanced: Multiple spinner styles**

```tsx
<Box flexDirection="column" gap={1}>
  <Spinner type="storm" label="Analyzing codebase..." color="#82AAFF" />
  <Spinner type="braille" label="Building index..." color="#34D399" />
  <Spinner type="dots" label="Connecting..." labelColor="#808080" />
</Box>
```

---

### ProgressBar

Horizontal progress bar with block fill characters, track color, optional percentage display, and label.

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `number` | -- | Progress percentage 0-100 (required) |
| `width` | `number` | Default from theme | Bar width in columns |
| `color` | `string \| number` | `colors.brand.primary` | Filled bar color |
| `trackColor` | `string \| number` | `colors.text.dim` | Empty track color |
| `showPercent` | `boolean` | `false` | Show percentage after bar |
| `label` | `string` | -- | Label shown before bar |
| _Plus layout props_ | | | `height`, `margin*`, `minWidth`, `maxWidth` |

**Basic: Simple progress**

```tsx
import { ProgressBar } from "@orchetron/storm";

<ProgressBar value={65} width={30} showPercent />
```

**Advanced: Multiple progress bars with labels**

```tsx
<Box flexDirection="column" gap={1}>
  <ProgressBar value={100} width={25} color="#34D399" label="Download " showPercent />
  <ProgressBar value={72} width={25} color="#82AAFF" label="Install  " showPercent />
  <ProgressBar value={15} width={25} color="#FBBF24" label="Configure" showPercent />
</Box>
```

---

### Badge

Colored status label rendered as `[label]`. Color is determined by variant or explicit color prop.

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | -- | Badge text (required) |
| `variant` | `"default" \| "success" \| "warning" \| "error" \| "info"` | `"default"` | Color variant |
| `color` | `string \| number` | Per-variant | Override color |
| `bold` | `boolean` | Auto (true for non-default) | Bold text |
| `dim` | `boolean` | -- | Dim text |

**Basic: Status badges**

```tsx
import { Badge } from "@orchetron/storm";

<Badge label="OK" variant="success" />
<Badge label="FAIL" variant="error" />
<Badge label="v2.1" />
```

**Advanced: Status row**

```tsx
<Box flexDirection="row" gap={2}>
  <Badge label="HEALTHY" variant="success" />
  <Badge label="3 warnings" variant="warning" />
  <Badge label="prod" color="#82AAFF" bold />
  <Badge label="us-east-1" dim />
</Box>
```

---

### Toast

Temporary notification message with type-based icon and color. Supports auto-hide after a duration.

| Prop | Type | Default | Description |
|---|---|---|---|
| `message` | `string` | -- | Notification text (required) |
| `type` | `"info" \| "success" \| "warning" \| "error"` | `"info"` | Notification type (determines icon and color) |
| `visible` | `boolean` | `true` | Whether toast is shown |
| `durationMs` | `number` | `3000` | Auto-hide after this many ms (0 = stay forever) |
| `onDismiss` | `() => void` | -- | Called when auto-hide timer fires |
| `animated` | `boolean` | `false` | Enable slide-in entrance and dim-out exit animation |
| `renderContent` | `(message, type, icon) => ReactNode` | -- | Custom toast content renderer |
| _Plus container props_ | | | `borderStyle`, `borderColor`, `padding*`, `width`, `margin*` |

**Basic: Success toast**

```tsx
import { Toast } from "@orchetron/storm";

<Toast message="File saved successfully" type="success" />
```

**Advanced: Auto-hiding notification**

```tsx
<Box flexDirection="column">
  <Toast message="Connection lost. Retrying..." type="warning" durationMs={5000} />
  <Toast message="Build completed in 3.2s" type="success" visible={showBuildToast} durationMs={3000} />
</Box>
```

Compound API: `Toast.Provider`, `Toast.Item`.

---

### ToastContainer

Manages a vertical stack of toasts with auto-dismiss. Displays up to `maxVisible` toasts, newest at the bottom.

| Prop | Type | Default | Description |
|---|---|---|---|
| `toasts` | `ToastItem[]` | -- | Stack of toast items to display (required) |
| `position` | `"top" \| "bottom"` | `"bottom"` | Position of the toast stack |
| `maxVisible` | `number` | `3` | Maximum number of visible toasts |
| `onDismiss` | `(id: string) => void` | -- | Called when an individual toast auto-dismisses |
| _Plus container props_ | | | `borderStyle`, `borderColor`, `padding*`, `width`, `margin*` |

**ToastItem type:**

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique toast identifier |
| `message` | `string` | Toast message text |
| `type` | `"info" \| "success" \| "warning" \| "error"` | Notification type |
| `durationMs` | `number` | Auto-hide duration in ms |

```tsx
<ToastContainer
  toasts={toasts}
  position="bottom"
  maxVisible={3}
  onDismiss={(id) => removeToast(id)}
/>
```

---

### Alert

Bordered attention box with type-based border coloring and optional title. Suitable for persistent messages.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Alert content (required) |
| `type` | `"success" \| "warning" \| "error" \| "info"` | `"info"` | Alert type (determines border color) |
| `title` | `string` | -- | Bold title above content |
| _Plus container props_ | | | `borderStyle`, `borderColor`, `padding*`, `width`, `margin*`, `backgroundColor` |

**Basic: Info alert**

```tsx
import { Alert, Text } from "@orchetron/storm";

<Alert type="info" title="Note">
  <Text>Configuration will take effect after restart.</Text>
</Alert>
```

**Advanced: Error alert with details**

```tsx
<Alert type="error" title="Build Failed" borderStyle="round" padding={1}>
  <Text>TypeScript compilation failed with 3 errors:</Text>
  <Text color="#F87171">  src/index.ts:42 - TS2345: Argument type mismatch</Text>
  <Text color="#F87171">  src/utils.ts:18 - TS2304: Cannot find name 'foo'</Text>
  <Text color="#F87171">  src/utils.ts:25 - TS7006: Parameter implicitly has 'any' type</Text>
</Alert>
```

---

### StatusMessage

Inline status message with type-appropriate icon and optional collapsible detail section.

| Prop | Type | Default | Description |
|---|---|---|---|
| `message` | `string` | -- | Message text |
| `type` | `"success" \| "warning" \| "error" \| "info"` | `"info"` | Status type (sets icon and color) |
| `title` | `string` | -- | Optional bold title before message |
| `detail` | `string` | -- | Collapsible detail text (toggle with Enter) |
| `isFocused` | `boolean` | `false` | Enable detail toggle |
| `renderIcon` | `(type, icon) => ReactNode` | -- | Custom icon renderer |

```tsx
<StatusMessage type="success" title="Build" message="Completed in 2.3s" />
<StatusMessage type="error" message="Connection refused" detail="ECONNREFUSED 127.0.0.1:5432" isFocused />
```

---

### Tooltip

Overlay tooltip with configurable position, auto-flip, delay, and arrow indicator.

| Prop | Type | Default | Description |
|---|---|---|---|
| `content` | `string` | -- | Tooltip text |
| `children` | `ReactNode` | -- | Target element |
| `visible` | `boolean` | `false` | Whether tooltip is shown |
| `position` | `"top" \| "bottom" \| "right" \| "left"` | `"top"` | Tooltip position |
| `color` | `string \| number` | `colors.text.secondary` | Tooltip text color |
| `maxWidth` | `number` | -- | Max tooltip width (truncates with ellipsis) |
| `delay` | `number` | `0` | Show delay in ms |
| `arrow` | `boolean` | `false` | Show arrow pointing to target |
| `targetRow` | `number` | -- | Row position for auto-flip |
| `targetCol` | `number` | -- | Column position for auto-flip |
| `renderContent` | `(content: string) => ReactNode` | -- | Custom content renderer |

```tsx
<Tooltip content="Press Enter to submit" visible={isFocused} position="bottom" arrow>
  <Button label="Submit" />
</Tooltip>
```

---

### LoadingIndicator

Full-width loading bar with optional label and indeterminate animation mode.

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | -- | Text shown beside the indicator |
| `progress` | `number` | -- | 0-100 for determinate; omit for indeterminate |
| `color` | `string \| number` | `colors.brand.primary` | Indicator color |

```tsx
<LoadingIndicator label="Fetching data..." />
```

---
[Back to Components](README.md)
