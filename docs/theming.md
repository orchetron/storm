# Theming & Styling

Storm's styling system has four layers — from low-level colors to high-level interaction identity:

1. **Theme** — color palette with auto-generated shades, 11 presets, WCAG validation
2. **StyleSheet** — CSS-like selectors with specificity cascading
3. **Personality** — holistic interaction identity (colors + borders + animation + typography)
4. **Live Stylesheets** — `.storm.css` files with CSS variables and hot reload

## Default Theme

The default palette uses Electric Arc Blue as the brand color:

```typescript
import { colors } from "@orchetron/storm-tui";

colors.brand.primary   // "#82AAFF" -- Electric Arc Blue
colors.brand.light     // "#A8C8FF" -- Lighter Arc (active states)
colors.brand.glow      // "#5A8AE0" -- Deeper Arc (subtle emphasis)

colors.text.primary    // "#D4D4D4" -- Clean light gray
colors.text.secondary  // "#808080" -- Mid gray
colors.text.dim        // "#505050" -- Quiet
colors.text.disabled   // "#333333" -- Near-invisible

colors.surface.base    // "#0A0A0A" -- Near-black
colors.surface.raised  // "#141414" -- Panels
colors.surface.overlay // "#1C1C1C" -- Modals
colors.surface.highlight // "#242424" -- Selection

colors.success  // "#34D399" -- Emerald
colors.warning  // "#FBBF24" -- Amber
colors.error    // "#F87171" -- Soft red
colors.info     // "#7AA2F7" -- Blue info
```

The full `StormColors` type includes semantic groups for `syntax`, `diff`, `tool` status, `approval` dialogs, `input` borders, `thinking` indicators, `user`/`assistant`/`system` roles, and `divider` color.

## Built-in Presets

Storm ships 11 professionally curated themes: 7 branded palettes with distinct character, plus 4 utility presets.

### Storm-Branded Themes

| Preset | Brand Color | Character |
|--------|-------------|-----------|
| **Arctic** `arcticTheme` | `#5CB8C8` storm frost | Cool Nordic blue-grey, Scandinavian clarity |
| **Midnight** `midnightTheme` | `#6B9EF0` storm midnight | Deep blue night, violet info tones |
| **Ember** `emberTheme` | `#6EB0A0` teal undercurrent | Warm earth, toasted neutrals, amber glow |
| **Mist** `mistTheme` | `#78B0E8` gentle blue | Soft pastels, lavender info, soothing |
| **Voltage** `voltageTheme` | `#A080E8` blue-violet | Vivid electric, maximum visual punch |
| **Dusk** `duskTheme` | `#B898D8` warm iris | Purple twilight, sunset hues, contemplative |
| **Horizon** `horizonTheme` | `#2890C8` ocean blue | Precise blue-gold, clean and engineered |

### Utility Presets

| Preset | Brand Color | Purpose |
|--------|-------------|---------|
| **Neon** `neonTheme` | `#FFB800` pure gold | Hyper-saturated, maximum energy |
| **Calm** `calmTheme` | `#C49848` muted gold | Desaturated warm tones, long sessions |
| **High Contrast** `highContrastTheme` | `#FFFFFF` | WCAG accessibility, color-blind friendly |
| **Monochrome** `monochromeTheme` | `#E0E0E0` | All greys, minimal distraction |

## ThemeProvider

Wrap your app with `ThemeProvider` to apply a theme:

```tsx
import { render, ThemeProvider, midnightTheme } from "@orchetron/storm-tui";

function App() {
  return (
    <ThemeProvider theme={midnightTheme}>
      <MyAppContent />
    </ThemeProvider>
  );
}

render(<App />);
```

Nest multiple providers to scope themes to subtrees.

## useTheme()

Access the active theme in any component:

```tsx
import { useTheme, Text, Box } from "@orchetron/storm-tui";

function StatusBar() {
  const { colors, shades } = useTheme();

  return (
    <Box borderStyle="single" borderColor={colors.divider}>
      <Text color={colors.brand.primary} bold>Status: OK</Text>
      <Text color={shades.success.lighten1}>All systems go</Text>
    </Box>
  );
}
```

`useTheme()` returns a `ThemeWithShades` object with `colors` (the raw palette) and `shades` (auto-generated variants).

## Auto-Generated Shades

For every semantic color, Storm generates six variants by mixing with white (lighten) or black (darken):

```typescript
import { generateShades } from "@orchetron/storm-tui";

const shades = generateShades("#82AAFF");
// shades.base     -- "#82AAFF" (original)
// shades.lighten1 -- +15% toward white
// shades.lighten2 -- +30% toward white
// shades.lighten3 -- +45% toward white
// shades.darken1  -- -15% toward black
// shades.darken2  -- -30% toward black
// shades.darken3  -- -45% toward black
```

Pre-computed shades for `brand`, `success`, `warning`, `error`, and `info`:

```tsx
const { shades } = useTheme();

<Text color={shades.brand.lighten2}>Bright accent</Text>
<Text color={shades.error.darken1}>Subdued error</Text>
```

## Creating Custom Themes

### extendTheme()

Override specific properties while keeping everything else:

```typescript
import { extendTheme, colors } from "@orchetron/storm-tui";

const myTheme = extendTheme(colors, {
  brand: {
    primary: "#FF5F87",   // Rose
    light: "#FF87AF",
    glow: "#D7005F",
  },
  success: "#87D787",
});
```

### createTheme()

Shorthand for extending the default palette:

```typescript
import { createTheme } from "@orchetron/storm-tui";

const myTheme = createTheme({
  brand: { primary: "#FF5F87" },
  surface: { base: "#1A0010" },
});
```

## Runtime Theme Switching

Pass a new `theme` prop to `<ThemeProvider>` from a parent component that owns the state. Downstream `useTheme()` calls will pick up the change automatically:

```tsx
import { useState } from "react";
import { ThemeProvider, useTheme, arcticTheme, voltageTheme, colors } from "@orchetron/storm-tui";

function ThemePicker() {
  const [theme, setTheme] = useState(colors);

  return (
    <ThemeProvider theme={theme}>
      <Box flexDirection="row" gap={1}>
        <Button label="Arctic" onPress={() => setTheme(arcticTheme)} />
        <Button label="Voltage" onPress={() => setTheme(voltageTheme)} />
      </Box>
      <MyContent />
    </ThemeProvider>
  );
}
```

## Loading Themes from Files

```typescript
import { loadTheme, saveTheme, parseTheme, serializeTheme } from "@orchetron/storm-tui";

// Load from JSON file (partial — deep-merged with defaults)
const theme = loadTheme("./my-theme.json");

// Parse from JSON string
const theme2 = parseTheme('{"brand":{"primary":"#FF5F87"}}');

// Save to file
saveTheme(myTheme, "./my-theme.json");
```

## Theme Validation

```typescript
import { validateTheme, validateContrast } from "@orchetron/storm-tui";

// Check structure (valid hex, required fields)
const result = validateTheme(myTheme);
if (!result.valid) {
  for (const error of result.errors) {
    console.error(`${error.path}: ${error.message}`);
  }
}

// Audit WCAG contrast compliance (4.5:1 AA target)
const contrastResult = validateContrast(myTheme);
```

---

# Personality System

A personality goes beyond theming — it defines the complete interaction identity: colors, borders, animation timing, typography, and component defaults in one coherent object.

```typescript
import type { StormPersonality } from "@orchetron/storm-tui";
```

### Structure

```typescript
interface StormPersonality {
  colors: StormColors;                    // Color palette (any theme)

  borders: {
    default: BorderStyle;                 // Normal state
    focused: BorderStyle;                 // Focused elements
    accent: BorderStyle;                  // Accent containers
    panel: BorderStyle;                   // Panel borders
  };

  animation: {
    durationFast: number;                 // Quick transitions (ms)
    durationNormal: number;               // Standard animations (ms)
    durationSlow: number;                 // Slow/emphasis (ms)
    easing: string;                       // Default easing
    reducedMotion: boolean;               // Respect prefers-reduced-motion
    spinnerType: string;                  // Default spinner variant
  };

  typography: {
    headingBold: boolean;                 // Bold headings
    headingColor: string;                 // Heading color
    codeBg: string;                       // Code block background
    linkColor: string;                    // Link color
    linkUnderline: boolean;               // Underline links
  };

  interaction: {
    focusIndicator: "bar" | "border" | "highlight" | "arrow";
    selectionChar: string;                // "◆" — selection indicator
    promptChar: string;                   // "›" — input prompt
    cursorStyle: string;                  // Cursor appearance
    collapseHint: string;                 // Collapse indicator
  };

  components: Record<string, Record<string, unknown>>;  // Per-component defaults
}
```

### Built-in Personality Presets

| Preset | Character |
|--------|-----------|
| **default** | Electric Arc Blue, single borders, diamond spinner, standard timing |
| **minimal** | Same colors, single borders, no animations, dots spinner |
| **hacker** | Green (#00FF00), ASCII borders, fast animations, braille spinner |
| **playful** | Pink (#FF6B9D), round borders, bouncy animations, bounce spinner |

### usePersonality()

Components read the active personality for defaults:

```tsx
import { usePersonality } from "@orchetron/storm-tui";

function MyComponent() {
  const personality = usePersonality();
  const spinnerType = personality.animation.spinnerType;   // "diamond"
  const promptChar = personality.interaction.promptChar;    // "›"
  const selectionChar = personality.interaction.selectionChar; // "◆"

  return <Spinner type={spinnerType} />;
}
```

---

# StyleSheet (CSS-like Selectors)

Storm supports CSS-like stylesheets with selector specificity:

```typescript
import { createStyleSheet } from "@orchetron/storm-tui";

const styles = createStyleSheet({
  "Text.title": { bold: true, color: "#82AAFF" },
  "Button:focus": { inverse: true, borderColor: "#FFB800" },
  "Box.sidebar Text": { dim: true },           // Descendant combinator
  "#submit": { color: "#34D399", bold: true },  // ID selector
});
```

Specificity scoring: ID=100, pseudo-class/class=10, type=1.

---

# Live Stylesheets (.storm.css)

Load stylesheets from files with hot reload — edit the file and see changes instantly:

```tsx
import { useStyleSheet } from "@orchetron/storm-tui";

function App() {
  useStyleSheet({ path: "./app.storm.css", watch: true });
  return <Box className="sidebar">...</Box>;
}
```

### .storm.css Format

```css
/* CSS variables */
:root {
  --primary: #82AAFF;
  --accent: #FFB800;
  --surface: #1E1E2E;
}

Text.title {
  color: var(--primary);
  bold: true;
}

Button:focus {
  borderColor: var(--accent);
  inverse: true;
}

Box.card {
  backgroundColor: var(--surface);
  borderStyle: single;
}

/* Fallback values */
Text.subtitle {
  color: var(--secondary, #888888);
}
```

Supports:
- CSS-like block syntax with selectors
- `:root { --name: value; }` variable declarations
- `var(--name)` and `var(--name, fallback)` references
- Nested `var()` in fallbacks
- Block comments (`/* */`) and line comments (`//`)
- Auto-parsed values: numbers, booleans, percentages, hex colors, quoted strings
- File watching with 100ms debounce (auto-enabled in development)

### Available Style Properties

These are the properties you can use in `.storm.css` rules. Values are auto-parsed from strings: `true`/`false` become booleans, integer/float strings become numbers, percentages are preserved as strings, and everything else stays as a string.

| Property | Type | Applies to |
|---|---|---|
| `color` | hex string or number | Text, inline components |
| `backgroundColor` | hex string or number | Box, containers |
| `bold` | boolean | Text |
| `dim` | boolean | Text |
| `italic` | boolean | Text |
| `underline` | boolean | Text |
| `strikethrough` | boolean | Text |
| `inverse` | boolean | Text, Button |
| `borderStyle` | `single`, `double`, `round`, `bold`, `classic` | Box, containers |
| `borderColor` | hex string or number | Box, containers |
| `padding` | number | Containers |
| `paddingX` / `paddingY` | number | Containers |
| `margin` | number | Layout components |
| `marginX` / `marginY` | number | Layout components |
| `gap` | number | Flex containers |
| `flex` | number | Flex children |
| `flexDirection` | `column`, `row` | Box |
| `alignItems` | `flex-start`, `center`, `flex-end`, `stretch` | Box |
| `justifyContent` | `flex-start`, `center`, `flex-end`, `space-between`, `space-around`, `space-evenly` | Box |

### Selector Types

Selectors follow CSS conventions adapted for Storm components:

| Selector | Example | Specificity | Matches |
|---|---|---|---|
| Type | `Text` | 1 | All Text components |
| Class | `.title` | 10 | Components with `className="title"` |
| Type + class | `Text.title` | 11 | Text components with `className="title"` |
| Pseudo-class | `Button:focus` | 11 | Focused Button components |
| ID | `#submit` | 100 | Component with `id="submit"` |
| Descendant | `Box.sidebar Text` | 12 | Text inside a Box with className "sidebar" |

Higher specificity wins when multiple rules match the same element.

### Complete .storm.css Example

Here is a full example showing a dashboard stylesheet:

```css
/* dashboard.storm.css */

:root {
  /* Theme variables */
  --brand: #82AAFF;
  --brand-light: #A8C8FF;
  --surface: #141414;
  --surface-raised: #1C1C1C;
  --dim: #505050;

  /* Storm theme overrides (picked up by useStyleSheet themeOverrides) */
  --storm-brand-primary: #82AAFF;
  --storm-surface-base: #0A0A0A;
  --storm-success: #34D399;
}

// Global defaults
Box {
  padding: 0;
}

Text {
  color: #D4D4D4;
}

// Title styling
Text.title {
  color: var(--brand);
  bold: true;
}

Text.subtitle {
  color: var(--dim);
  dim: true;
}

// Sidebar layout
Box.sidebar {
  borderStyle: single;
  borderColor: var(--dim);
  backgroundColor: var(--surface);
  padding: 1;
}

Box.sidebar Text {
  dim: true;
}

// Cards
Box.card {
  borderStyle: round;
  borderColor: var(--brand);
  backgroundColor: var(--surface-raised);
  padding: 2;
  margin: 1;
}

// Interactive states
Button:focus {
  inverse: true;
  borderColor: var(--brand-light);
}

#submit {
  color: #34D399;
  bold: true;
}
```

### Theme Overrides via CSS Variables

Variables named `--storm-{group}-{key}` are automatically extracted and can be passed to `ThemeProvider`, bridging the gap between `.storm.css` files and the theme system:

```tsx
import { useStyleSheet, extendTheme, ThemeProvider, colors } from "@orchetron/storm-tui";

function App() {
  const { themeOverrides } = useStyleSheet({ path: "./app.storm.css", watch: true });
  const mergedTheme = extendTheme(colors, themeOverrides);

  return (
    <ThemeProvider theme={mergedTheme}>
      <MyContent />
    </ThemeProvider>
  );
}
```

The naming convention for theme variables:
- Flat fields: `--storm-success`, `--storm-warning`, `--storm-error`, `--storm-info`, `--storm-divider`
- Nested fields: `--storm-brand-primary`, `--storm-text-dim`, `--storm-surface-base`, `--storm-input-border-active` (hyphens after the group name are converted to camelCase)

Valid group names: `brand`, `text`, `surface`, `system`, `user`, `assistant`, `thinking`, `tool`, `approval`, `input`, `diff`, `syntax`.

---

# Spacing Tokens

Consistent padding, margin, and gap values:

```typescript
import { spacing } from "@orchetron/storm-tui";

spacing.none  // 0
spacing.xs    // 1 — Tight: icon-to-label
spacing.sm    // 1 — Standard: within components
spacing.md    // 2 — Comfortable: between components
spacing.lg    // 3 — Spacious: between sections
spacing.xl    // 4 — Major: page-level separation
```

---

# Theme Color Reference

| Group | Keys | Purpose |
|---|---|---|
| `brand` | `primary`, `light`, `glow` | Accent color and variants |
| `text` | `primary`, `secondary`, `dim`, `disabled` | Text hierarchy |
| `surface` | `base`, `raised`, `overlay`, `highlight` | Background levels |
| `success` / `warning` / `error` / `info` | (string) | Semantic status |
| `user` | `symbol` | User identity indicator |
| `assistant` | `symbol` | AI assistant indicator |
| `system` | `text` | System message color |
| `thinking` | `symbol`, `shimmer` | Thinking/loading state |
| `tool` | `pending`, `running`, `completed`, `failed`, `cancelled` | Tool execution status |
| `approval` | `approve`, `deny`, `always`, `header`, `border` | Approval dialog |
| `input` | `border`, `borderActive`, `prompt` | Input field states |
| `diff` | `added`, `removed`, `addedBg`, `removedBg` | Diff highlighting |
| `syntax` | `keyword`, `string`, `number`, `function`, `type`, `comment`, `operator` | Syntax highlighting |
| `divider` | (string) | Divider/separator lines |
