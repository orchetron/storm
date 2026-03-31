# Changelog

## 0.1.0 — Initial Release

### Core
- Compositor-based rendering pipeline: React → Layout → Buffer → Diff → Terminal
- Cell-level diff rendering — only changed cells repaint (97% skipped per frame)
- Typed array buffer (`Int32Array` + `Uint8Array`) — near-zero GC pressure
- Pure TypeScript flexbox + CSS Grid layout engine
- Dual-speed rendering — React for structure, `requestRender()` for animation/scroll
- WASM acceleration — optional 33KB Rust module, 3.4x faster diff (TypeScript fallback)
- DECSTBM hardware scroll regions for pure scroll operations
- Synchronized output (DEC Mode 2026) for atomic, tear-free frames
- Defensive React API wrapper for graceful degradation across React versions
- z-index overlay support

### Components (92)
- Core: Box, Text, Spacer, Newline, Static, Overlay
- Layout: ScrollView, Tabs, TabbedContent, Accordion, Modal, Collapsible, Tooltip, ContentSwitcher
- Input: TextInput, ChatInput, Button, Checkbox, Switch, RadioGroup, Select, Form, Calendar, FilePicker, Menu, ConfirmDialog, MaskedInput, SearchInput, SelectInput, SelectionList
- Data: Table, DataGrid, Tree, DirectoryTree, ListView, VirtualList, OrderedList, UnorderedList, DefinitionList, Pretty, Sparkline, RichLog, LineChart, DiffView
- Feedback: Spinner (14 types), ProgressBar, GradientProgress, Gauge, Toast, Timer, Stopwatch, Badge, StatusMessage, Alert, RevealTransition
- Visual: Gradient, GradientBorder, GlowText, Digits, Image, Card, Shadow, Separator, Placeholder, Kbd
- Animation: Transition, AnimatePresence, ErrorBoundary
- All components: React.memo, usePluginProps, ARIA roles

### AI Widgets (19)
- OperationTree, MessageBubble, ApprovalPrompt, StreamingText, SyntaxHighlight, MarkdownText, TokenStream, ContextWindow, CostTracker, ModelBadge, CommandBlock, CommandDropdown, StatusLine, BlinkDot, ShimmerText, AnimatedLogo, PerformanceHUD, WelcomeBanner, ComponentGallery
- Customizable symbols, render props, spinner frames, status icons, tree connectors

### Hooks (74)
- Essential: useTui, useApp, useInput, useTerminal, useCleanup
- Common: useFocus, useKeyboardShortcuts, useAnimation, useTween, useInterval, useTimeout
- Interactive: useScroll, useVirtualList, useCommandPalette, useTransition, useInlinePrompt, useNotification, useMeasure
- 15 headless behavior hooks: useSelectBehavior, useListBehavior, useMenuBehavior, useTreeBehavior, useTabsBehavior, useAccordionBehavior, useFormBehavior, useDialogBehavior, useToastBehavior, useCalendarBehavior, usePaginatorBehavior, useStepperBehavior, useTableBehavior, useVirtualListBehavior, useCollapsibleBehavior

### DevTools
- `enableDevTools(app)` — one line to activate all tools
- Render diff heatmap — visualize cell changes per frame
- Live WCAG accessibility audit — contrast checking on rendered output
- Time-travel debugging — record and scrub through 120 frames
- Component inspector — tree, styles, FPS sparkline, event log

### Theming
- 11 built-in themes: Arctic, Midnight, Ember, Mist, Voltage, Dusk, Horizon, Neon, Calm, High Contrast, Monochrome
- Personality system — colors, borders, animation timing, typography, interaction style
- Live `.storm.css` hot-reload with CSS variables
- CSS-like StyleSheet with selectors, specificity, descendant combinators
- Auto-generated color shades, WCAG contrast validation
- Runtime theme switching, file-based theme loading

### Animations
- Transition component — fade, slide-down, slide-up, slide-right, collapse
- AnimatePresence — mount/unmount animations for keyed children
- useTransition hook — declarative value transitions with easing
- Easing functions: linear, easeIn, easeOut, easeInOut, spring

### i18n
- Locale system with LocaleProvider and useLocale/useDirection hooks
- Translation with parameter interpolation
- Pluralization with 5 built-in rules (English, French, Arabic, Russian, Japanese)
- Number formatting with locale-aware separators

### Plugin System
- Lifecycle hooks: setup, beforeRender, afterRender, cleanup
- Input interception: onKey, onMouse (return null to consume)
- Component prop overrides: onComponentProps, componentDefaults
- Register via render() options or app.pluginManager

### Developer Experience
- Dev-mode warnings: ScrollView height constraint, Box-in-Text nesting, frequent setState
- 452 tests across 12 test files
- 12 documentation guides
- 10 copy-paste recipes
- Common pitfalls guide

### Accessibility
- 54 components with ARIA roles
- WCAG contrast checking utilities
- Screen reader announcements (OSC 99)
- Reduced motion support
- High contrast theme
