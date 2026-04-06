/** @packageDocumentation */
export {
  type Cell,
  type Style,
  type Rect,
  type BorderStyle,
  type BorderChars,
  EMPTY_CELL,
  DEFAULT_COLOR,
  Attr,
  rgb,
  parseColor,
  cellEquals,
  makeCell,
  styleToAttrs,
  styleToCellProps,
  BORDER_CHARS,
} from "./core/types.js";

export { ScreenBuffer, WIDE_CHAR_PLACEHOLDER } from "./core/buffer.js";
export { DiffRenderer, type DiffResult, isWasmAccelerated } from "./core/diff.js";
export { Screen, type ScreenOptions } from "./core/screen.js";
export { ease, spring, type EasingFunction } from "./core/easing.js";
export {
  detectTerminal,
  terminalInfo,
  type TerminalCapabilities,
} from "./core/terminal-detect.js";
export {
  detectImageCaps,
  bestImageProtocolDetailed,
  type TerminalImageCaps,
  type ImageProtocol,
} from "./core/terminal-caps.js";
export {
  createAdaptiveConfig,
  bestImageProtocol,
  bestKeyboardProtocol,
  bestColorDepth,
  enableKittyKeyboard,
  enableSyncOutput,
  adaptiveChar,
  adaptiveBorder,
  type AdaptiveConfig,
} from "./core/adaptive.js";

export {
  RenderErrorBoundary,
  type RenderError,
  type ErrorBoundaryOptions,
} from "./core/error-boundary.js";
export {
  OutputBuffer,
  type BackpressureOptions,
} from "./core/backpressure.js";
export {
  MAX_LAYOUT_DEPTH,
  MAX_CHILDREN,
  MAX_BUFFER_WIDTH,
  MAX_BUFFER_HEIGHT,
  clampDimension,
  validateLayoutProps,
  isTerminalAlive,
} from "./core/guards.js";
export {
  ESC,
  CSI,
  CURSOR_HIDE,
  CURSOR_SHOW,
  CURSOR_SAVE,
  CURSOR_RESTORE,
  CLEAR_SCREEN,
  CLEAR_LINE,
  ALT_SCREEN_ENTER,
  ALT_SCREEN_EXIT,
  MOUSE_ENABLE,
  MOUSE_DISABLE,
  RESET,
  cursorTo,
  fgColor,
  bgColor,
  fullSgr,
  diffSgr,
  setScrollRegion,
  RESET_SCROLL_REGION,
  setColorDepth,
  getColorDepth,
  rgbTo256,
  rgbTo16,
  type ColorDepth,
} from "./core/ansi.js";
export type {
  KeyEvent,
  KeyName,
  KeyHandler,
  MouseEvent,
  MouseButton,
  MouseAction,
  MouseHandler,
  PasteEvent,
  PasteHandler,
} from "./input/types.js";

export { parseMouseEvent, isIncompleteMouseSequence } from "./input/mouse.js";
export { parseKeys } from "./input/keyboard.js";
export { InputManager } from "./input/manager.js";
export {
  computeLayout,
  measureNaturalHeight,
  measureNaturalWidth,
  type LayoutProps,
  type LayoutResult,
  type LayoutNode,
  type FlexDirection,
  type FlexWrap,
  type Align,
  type AlignSelf,
  type Justify,
  type Overflow,
  type Display,
  type GridAutoFlow,
  type Position,
} from "./layout/engine.js";
export { render, type RenderOptions, type RenderMetrics, type FullRenderMetrics, type TuiApp } from "./reconciler/render.js";
export {
  renderToString,
  type RenderToStringOptions,
  type RenderToStringResult,
} from "./reconciler/render-to-string.js";
export type { BackgroundPreset, BackgroundPattern, BackgroundProp, HostTextNode } from "./reconciler/types.js";
export { Box, type BoxProps } from "./components/core/Box.js";
export { Text, type TextProps } from "./components/core/Text.js";
export { ScrollView, type ScrollViewProps, type ScrollState } from "./components/core/ScrollView.js";
export { TextInput, type TextInputProps } from "./components/core/TextInput.js";
export { Spinner, type SpinnerProps, type SpinnerType } from "./components/core/Spinner.js";
export { Spacer } from "./components/core/Spacer.js";
export { Newline, type NewlineProps } from "./components/core/Newline.js";
export { Link, type LinkProps } from "./components/extras/Link.js";
export { Static, type StaticProps } from "./components/core/Static.js";
export { SelectInput, type SelectInputItem, type SelectInputProps } from "./components/core/SelectInput.js";
export { Overlay, type OverlayProps } from "./components/core/Overlay.js";
export { Divider, type DividerProps } from "./components/core/Divider.js";
export { Table, type TableProps, type TableColumn } from "./components/data/Table.js";
export { ProgressBar, type ProgressBarProps } from "./components/core/ProgressBar.js";
export { Tabs, type TabsProps, type Tab } from "./components/core/Tabs.js";
export { Tree, type TreeProps, type TreeNode } from "./components/data/Tree.js";
export { Toast, ToastContainer, type ToastProps, type ToastContainerProps, type ToastItem } from "./components/extras/Toast.js";
export { Checkbox, type CheckboxProps } from "./components/core/Checkbox.js";
export { RadioGroup, type RadioGroupProps, type RadioOption } from "./components/core/RadioGroup.js";
export { Switch, type SwitchProps, type SwitchSize } from "./components/core/Switch.js";
export { ChatInput, type ChatInputProps } from "./components/extras/ChatInput.js";
export { TextArea, type TextAreaProps, type HighlightSpan } from "./components/core/TextArea.js";
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./components/core/Button.js";
export { ListView, type ListViewProps, type ListViewItem } from "./components/core/ListView.js";
export { Collapsible, type CollapsibleProps } from "./components/extras/Collapsible.js";
export { Sparkline, type SparklineProps } from "./components/data/Sparkline.js";
export { Header, type HeaderProps } from "./components/extras/Header.js";
export { Footer, type FooterProps, type FooterBinding } from "./components/extras/Footer.js";
export { RichLog, type RichLogProps, type LogEntry, type LogLevel } from "./components/data/RichLog.js";
export { Paginator, type PaginatorProps } from "./components/extras/Paginator.js";
export { Timer, type TimerProps } from "./components/extras/Timer.js";
export { FilePicker, type FilePickerProps, type FileNode, type FilePickerChildEntry } from "./components/extras/FilePicker.js";
export { VirtualList, type VirtualListProps } from "./components/core/VirtualList.js";
export { Gauge, type GaugeProps, type GaugeThreshold } from "./components/data/Gauge.js";
export { GradientProgress, type GradientProgressProps } from "./components/effects/GradientProgress.js";
export { RevealTransition, type RevealTransitionProps } from "./components/effects/RevealTransition.js";
export { Image, type ImageProps, isColoredUnderlineSupported } from "./components/effects/Image.js";
export { Shadow, type ShadowProps } from "./components/effects/Shadow.js";
export { Card, type CardProps } from "./components/extras/Card.js";
export { GlowText, type GlowTextProps } from "./components/effects/GlowText.js";
export { GradientBorder, type GradientBorderProps } from "./components/effects/GradientBorder.js";
export { Kbd, type KbdProps } from "./components/extras/Kbd.js";
export { LineChart, type LineChartProps, type LineChartSeries } from "./components/data/LineChart.js";
export { AreaChart, type AreaChartProps } from "./components/data/AreaChart.js";
export { ScatterPlot, type ScatterPlotProps, type ScatterPlotSeries } from "./components/data/ScatterPlot.js";
export { Heatmap, type HeatmapProps } from "./components/data/Heatmap.js";
export { Histogram, type HistogramProps } from "./components/data/Histogram.js";
export { BarChart, type BarChartProps } from "./components/data/BarChart.js";
export type { DataPoint, ChartSeries, BarData, StackedBarData, AxisConfig, ChartBaseProps } from "./components/data/chart-types.js";
export { Heading, type HeadingProps } from "./components/extras/Heading.js";
export { Paragraph, type ParagraphProps } from "./components/extras/Paragraph.js";
export { Diagram, type DiagramProps, type DiagramNode, type DiagramEdge } from "./components/effects/Diagram.js";
export { Canvas, type CanvasProps, type CanvasNode, type CanvasEdge } from "./components/effects/canvas/index.js";
export { SearchInput, type SearchInputProps } from "./components/extras/SearchInput.js";
export { MaskedInput, type MaskedInputProps } from "./components/extras/MaskedInput.js";
export { Form, type FormField, type FormFieldOption, type FormProps } from "./components/extras/Form.js";
export { DataGrid, type DataGridColumn, type DataGridProps } from "./components/data/DataGrid.js";
export { OrderedList, type OrderedListProps, type NumberingStyle } from "./components/extras/OrderedList.js";
export { UnorderedList, type UnorderedListProps, type ItemStatus } from "./components/extras/UnorderedList.js";
export { DefinitionList, type DefinitionListItem, type DefinitionListProps } from "./components/data/DefinitionList.js";
export { Pretty, type PrettyProps } from "./components/data/Pretty.js";
export { Gradient, type GradientProps } from "./components/effects/Gradient.js";
export { Digits, type DigitsProps } from "./components/effects/Digits.js";
export { Placeholder, type PlaceholderProps, type PlaceholderShape } from "./components/extras/Placeholder.js";
export { Accordion, type AccordionProps, type AccordionSection } from "./components/extras/Accordion.js";
export { Alert, type AlertProps, type AlertAction } from "./components/extras/Alert.js";
export { Avatar, type AvatarProps } from "./components/extras/Avatar.js";
export { Badge, type BadgeProps } from "./components/extras/Badge.js";
export { Breadcrumb, type BreadcrumbProps } from "./components/extras/Breadcrumb.js";
export { Calendar, type CalendarProps } from "./components/extras/Calendar.js";
export { ConfirmDialog, type ConfirmDialogProps, type ConfirmDialogAction } from "./components/extras/ConfirmDialog.js";
export { ContentSwitcher, type ContentSwitcherProps } from "./components/extras/ContentSwitcher.js";
export { DirectoryTree, type DirectoryTreeProps, type DirNode, type DirChildEntry } from "./components/extras/DirectoryTree.js";
export { KeyboardHelp, type KeyboardHelpProps } from "./components/extras/KeyboardHelp.js";
export { HelpPanel, type HelpPanelProps, type HelpBinding } from "./components/extras/HelpPanel.js";
export { Menu, type MenuProps, type MenuItem } from "./components/extras/Menu.js";
export { OptionList, type OptionListProps, type OptionListItem } from "./components/extras/OptionList.js";
export { Modal, type ModalProps, type ModalSize } from "./components/core/Modal.js";
export { Select, type SelectProps, type SelectOption } from "./components/core/Select.js";
export { SelectionList, type SelectionListProps, type SelectionListItem } from "./components/extras/SelectionList.js";
export { StatusMessage, type StatusMessageProps } from "./components/extras/StatusMessage.js";
export { Stepper, type StepperProps, type StepDef } from "./components/extras/Stepper.js";
export { Stopwatch, type StopwatchProps } from "./components/extras/Stopwatch.js";
export { TabbedContent, type TabbedContentProps } from "./components/extras/TabbedContent.js";
export { Tag, type TagProps } from "./components/extras/Tag.js";
export { Tooltip, type TooltipProps } from "./components/extras/Tooltip.js";
export { FocusGroup, type FocusGroupProps } from "./components/core/FocusGroup.js";
export { DiffView, type DiffViewProps, type DiffLine } from "./components/extras/DiffView.js";
export { InlineDiff, type InlineDiffProps } from "./components/extras/InlineDiff.js";
export { ErrorBoundary, type ErrorBoundaryProps } from "./components/core/ErrorBoundary.js";
export { Transition, type TransitionProps, type TransitionTimingConfig } from "./components/effects/Transition.js";
export { AnimatePresence, type AnimatePresenceProps } from "./components/effects/AnimatePresence.js";
export { Markdown, type MarkdownProps } from "./components/extras/Markdown.js";
export { MarkdownViewer, type MarkdownViewerProps } from "./components/extras/MarkdownViewer.js";
export { CommandPalette, type CommandPaletteProps, type PaletteCommand } from "./components/extras/CommandPalette.js";
export { DatePicker, type DatePickerProps } from "./components/extras/DatePicker.js";
export { LoadingIndicator, type LoadingIndicatorProps, type LoadingStyle, type LoadingSize } from "./components/extras/LoadingIndicator.js";
export { Welcome, type WelcomeProps, type WelcomeAction, type WelcomeShortcut } from "./components/extras/Welcome.js";
export {
  OperationTree, type OperationTreeProps, type OpNode,
  StreamingText, type StreamingTextProps,
  SyntaxHighlight, type SyntaxHighlightProps, type LanguageDef,
  registerLanguage, getLanguage, getSupportedLanguages,
  ShimmerText, type ShimmerTextProps,
  BlinkDot, type BlinkDotProps, type DotState,
  ApprovalPrompt, type ApprovalPromptProps, type ApprovalOption,
  CommandDropdown, type CommandDropdownProps, type CommandItem,
  StatusLine, type StatusLineProps,
  MessageBubble, type MessageBubbleProps,
  PerformanceHUD, type PerformanceHUDProps,
  TokenStream, type TokenStreamProps,
  ContextWindow, type ContextWindowProps,
  CostTracker, type CostTrackerProps,
  ModelBadge, type ModelBadgeProps,
  CommandBlock, type CommandBlockProps,
} from "./widgets/index.js";
export { useColors } from "./hooks/useColors.js";
export { useCleanup } from "./hooks/useCleanup.js";
export { useAsyncCleanup } from "./hooks/useAsyncCleanup.js";
export { useForceUpdate } from "./hooks/useForceUpdate.js";
export { useInput, type UseInputOptions } from "./hooks/useInput.js";
export { useMouse, type UseMouseOptions } from "./hooks/useMouse.js";
export { useTerminal, type TerminalInfo } from "./hooks/useTerminal.js";
export { useFocus, type UseFocusOptions, type UseFocusResult } from "./hooks/useFocus.js";
export { useScroll, type UseScrollOptions, type UseScrollResult } from "./hooks/useScroll.js";
export { useMeasure } from "./hooks/useMeasure.js";
export { useApp, type UseAppResult } from "./hooks/useApp.js";
export { useStdin, type UseStdinResult } from "./hooks/useStdin.js";
export { useStdout, type UseStdoutResult } from "./hooks/useStdout.js";
export { useStderr, type UseStderrResult } from "./hooks/useStderr.js";
export { useFocusManager, type UseFocusManagerResult } from "./hooks/useFocusManager.js";
export { useAnimation, type UseAnimationOptions, type UseAnimationResult } from "./hooks/useAnimation.js";
export { usePaste } from "./hooks/usePaste.js";
export { useInterval } from "./hooks/useInterval.js";
export { useTimeout } from "./hooks/useTimeout.js";
export { useVirtualList, type VirtualListOptions, type VirtualListResult } from "./hooks/useVirtualList.js";
export { useClipboard, type UseClipboardResult } from "./hooks/useClipboard.js";
export { useAccessibility } from "./hooks/useAccessibility.js";
export { useReducedMotion } from "./hooks/useReducedMotion.js";
export { useAdaptive } from "./hooks/useAdaptive.js";
export { usePluginManager } from "./hooks/usePlugin.js";
export { usePluginProps } from "./hooks/usePluginProps.js";
export { useBuffer, type BufferAccess } from "./hooks/useBuffer.js";
export { useAnnounce, type UseAnnounceResult } from "./hooks/useAnnounce.js";
export { useTransition, type TransitionConfig, type UseTransitionResult } from "./hooks/useTransition.js";
export { useTextCycler, type UseTextCyclerOptions, type UseTextCyclerResult } from "./hooks/useTextCycler.js";
export { useCollapsibleContent, type UseCollapsibleContentOptions, type UseCollapsibleContentResult } from "./hooks/useCollapsibleContent.js";
export { useModeCycler, type UseModeCyclerOptions, type UseModeCyclerResult } from "./hooks/useModeCycler.js";
export { useGhostText, type UseGhostTextOptions, type UseGhostTextResult } from "./hooks/useGhostText.js";
export { useInlinePrompt, type UseInlinePromptOptions, type UseInlinePromptResult } from "./hooks/useInlinePrompt.js";
export { useEasedInterval, type UseEasedIntervalOptions, type UseEasedIntervalResult } from "./hooks/useEasedInterval.js";
export { useTypeahead, type UseTypeaheadOptions, type UseTypeaheadResult } from "./hooks/useTypeahead.js";
export { useSearchFilter, type UseSearchFilterOptions, type UseSearchFilterResult } from "./hooks/useSearchFilter.js";
export { useMultiSelect, type UseMultiSelectOptions, type UseMultiSelectResult } from "./hooks/useMultiSelect.js";
export { useUndoRedo, type UseUndoRedoOptions, type UseUndoRedoResult } from "./hooks/useUndoRedo.js";
export { useCommandPalette, type UseCommandPaletteOptions, type UseCommandPaletteResult, type CommandDef } from "./hooks/useCommandPalette.js";
export { useHotkey, type UseHotkeyOptions, type UseHotkeyResult, type HotkeyDef } from "./hooks/useHotkey.js";
export { useTimer, type UseTimerOptions, type UseTimerResult } from "./hooks/useTimer.js";
export { useConfirmAction, type UseConfirmActionOptions, type UseConfirmActionResult } from "./hooks/useConfirmAction.js";
export { useNotification, type UseNotificationOptions, type UseNotificationResult, type Notification } from "./hooks/useNotification.js";
export { useWizard, type UseWizardOptions, type UseWizardResult, type WizardStep } from "./hooks/useWizard.js";
export { useStreamConsumer, type UseStreamConsumerOptions, type UseStreamConsumerResult } from "./hooks/useStreamConsumer.js";
export { useBatchAction, type UseBatchActionOptions, type UseBatchActionResult } from "./hooks/useBatchAction.js";
export { useKeyChord, type UseKeyChordOptions, type UseKeyChordResult, type KeyChordDef } from "./hooks/useKeyChord.js";
export { useSortable, type UseSortableOptions, type UseSortableResult } from "./hooks/useSortable.js";
export { useHistory, type UseHistoryOptions, type UseHistoryResult } from "./hooks/useHistory.js";
export { useAsyncLoader, type UseAsyncLoaderOptions, type UseAsyncLoaderResult } from "./hooks/useAsyncLoader.js";
export { usePersistentState, memoryStorage, type UsePersistentStateOptions, type UsePersistentStateResult, type StateStorage } from "./hooks/usePersistentState.js";
export { useContextMenu, type UseContextMenuOptions, type UseContextMenuResult, type ContextMenuItem } from "./hooks/useContextMenu.js";
export { useDragReorder, type UseDragReorderOptions, type UseDragReorderResult } from "./hooks/useDragReorder.js";
export { useInfiniteScroll, type UseInfiniteScrollOptions, type UseInfiniteScrollResult } from "./hooks/useInfiniteScroll.js";
export { useCopyPasteBuffer, type UseCopyPasteBufferOptions, type UseCopyPasteBufferResult } from "./hooks/useCopyPasteBuffer.js";
export { useLocale } from "./hooks/useLocale.js";
export { type MeasuredLayout, paintBackgroundToBuffer } from "./reconciler/renderer.js";

export {
  useSelectBehavior, type UseSelectBehaviorOptions, type UseSelectBehaviorResult, type SelectBehaviorOption,
  useListBehavior, type UseListBehaviorOptions, type UseListBehaviorResult, type ListBehaviorItem,
  useMenuBehavior, type UseMenuBehaviorOptions, type UseMenuBehaviorResult, type MenuBehaviorItem, type SubmenuFrame,
  useTreeBehavior, type UseTreeBehaviorOptions, type UseTreeBehaviorResult, type TreeBehaviorNode, type FlatTreeNode,
  useTabsBehavior, type UseTabsBehaviorOptions, type UseTabsBehaviorResult, type TabBehaviorItem,
  useAccordionBehavior, type UseAccordionBehaviorOptions, type UseAccordionBehaviorResult, type AccordionBehaviorSection,
  usePaginatorBehavior, type UsePaginatorBehaviorOptions, type UsePaginatorBehaviorResult,
  useStepperBehavior, type UseStepperBehaviorOptions, type UseStepperBehaviorResult, type StepBehaviorDef, type StepStatus,
  useTableBehavior, type UseTableBehaviorOptions, type UseTableBehaviorResult, type TableBehaviorColumn, type TableBehaviorEditing,
  useVirtualListBehavior, type UseVirtualListBehaviorOptions, type UseVirtualListBehaviorResult,
  useDialogBehavior, type UseDialogBehaviorOptions, type UseDialogBehaviorResult, type DialogSize,
  useToastBehavior, type UseToastBehaviorOptions, type UseToastBehaviorResult, type ToastBehaviorItem,
  useFormBehavior, type UseFormBehaviorOptions, type UseFormBehaviorResult, type FormBehaviorField, type FormBehaviorFieldOption,
  useCalendarBehavior, type UseCalendarBehaviorOptions, type UseCalendarBehaviorResult, type CalendarDayInfo,
  useCollapsibleBehavior, type UseCollapsibleBehaviorOptions, type UseCollapsibleBehaviorResult,
} from "./hooks/headless/index.js";
export {
  detectAccessibility,
  meetsContrast,
  relativeLuminance,
  contrastRatio,
  announce,
  type AccessibilityOptions,
} from "./core/accessibility.js";

export {
  ariaToAnnouncement,
  describeButton,
  describeCheckbox,
  describeTextInput,
  describeProgressBar,
  describeTab,
  describeMenuItem,
  describeTreeItem,
  describeListItem,
  describeDialog,
  describeAlert,
  type AriaRole,
  type AriaLive,
  type AriaProps,
} from "./core/aria.js";
export {
  getBoundingBox,
  getWidth,
  getHeight,
  hitTest,
} from "./core/measurement.js";
export {
  type Locale,
  type NumberFormat,
  type PluralCategory,
  type PluralRule,
  EN,
  PLURAL_EN,
  PLURAL_AR,
  PLURAL_FR,
  PLURAL_RU,
  PLURAL_JA,
  registerLocale,
  getLocale,
  getRegisteredLocales,
  formatNumber,
  t,
  plural,
  LocaleContext,
  LocaleProvider,
} from "./core/i18n.js";
export { useTui, TuiContext, type TuiContextValue } from "./context/TuiContext.js";
export {
  colors, type StormColors, useTheme, ThemeProvider, ThemeContext, type ThemeWithShades, extendTheme, createTheme, type DeepPartial,
  extractThemeOverrides,
  spacing, type SpacingToken,
  arcticTheme, midnightTheme, emberTheme, mistTheme,
  voltageTheme, duskTheme, horizonTheme,
  neonTheme, calmTheme, highContrastTheme, monochromeTheme,
  loadTheme, parseTheme, saveTheme, serializeTheme,
  validateTheme, validateContrast,
  type ThemeValidationResult, type ThemeValidationError, type ThemeValidationWarning,
  generateShades, generateThemeShades, type ColorShades, type ThemeShades,
} from "./theme/index.js";
export {
  type StormPersonality,
  type DeepPartialPersonality,
  defaultPersonality,
  createPersonality,
  mergePersonality,
  PersonalityProvider,
  usePersonality,
  PersonalityContext,
} from "./core/personality.js";

export {
  defaultPreset,
  minimalPreset,
  hackerPreset,
  playfulPreset,
} from "./core/personality-presets.js";
export type { StormTextStyleProps, StormLayoutStyleProps, StormContainerStyleProps } from "./styles/index.js";
export { mergeBoxStyles, pickStyleProps, pickLayoutProps, DEFAULTS, type ComponentDefaults } from "./styles/index.js";
export { createStyleSheet, StyleSheet, type StyleRule } from "./core/stylesheet.js";
export { StyleProvider, StyleContext, useStyles } from "./core/style-provider.js";
export {
  parseStormCSS,
  createStyleSheetLoader,
  type StyleSheetLoaderOptions,
  type ParsedStyleSheet,
  type StyleRule as ParsedStyleRule,
} from "./core/stylesheet-loader.js";
export { useStyleSheet, type UseStyleSheetResult } from "./hooks/useStyleSheet.js";
export { FocusManager, type FocusableEntry, type FocusChangeCallback, type FocusRingStyle, type FocusRingMode } from "./core/focus.js";
export { RenderContext, type DirtyRegion, type RenderMetrics as RenderContextMetrics } from "./core/render-context.js";
export { AnimationScheduler, type AnimationCallback } from "./core/animation-scheduler.js";
export {
  PluginManager,
  PluginBus,
  type StormPlugin,
  type PluginContext,
  type CustomElementHandler,
} from "./core/plugin.js";
export { vimModePlugin } from "./plugins/vim-mode.js";
export { compactModePlugin } from "./plugins/compact-mode.js";
export { autoScrollPlugin } from "./plugins/auto-scroll.js";
export { screenshotPlugin, type ScreenshotPluginOptions } from "./plugins/screenshot.js";
export { statusBarPlugin, type StatusBarPluginOptions, type StatusBarSegment } from "./plugins/status-bar.js";
export {
  MiddlewarePipeline,
  type RenderMiddleware,
  scanlineMiddleware,
  fpsCounterMiddleware,
  debugBorderMiddleware,
  darkenColor,
} from "./core/middleware.js";
export {
  createInspectorMiddleware,
  type InspectorState,
} from "./devtools/inspector.js";
export { serializeTree } from "./devtools/tree-view.js";
export {
  createPerformanceMonitor,
  type PerformanceMetrics,
} from "./devtools/performance-monitor.js";
export {
  createEventLogger,
  type LoggedEvent,
} from "./devtools/event-logger.js";
export {
  createDevToolsOverlay,
  type DevToolsOverlayOptions,
  type DevToolsPanel,
} from "./devtools/devtools-overlay.js";
export {
  createTimeTravel,
  type FrameSnapshot,
  type TimeTravelState,
} from "./devtools/time-travel.js";
export {
  createRenderHeatmap,
  type HeatmapOptions,
} from "./devtools/render-heatmap.js";
export {
  createAccessibilityAudit,
  type AccessibilityViolation,
  type AuditOptions,
  type AuditReport,
} from "./devtools/accessibility-audit.js";
export {
  enableDevTools,
  type EnableDevToolsOptions,
  type DevToolsHandle,
} from "./devtools/enable.js";
export {
  createProfiler,
  type Profiler,
  type ProfilerSnapshot,
  type FrameTiming,
  type ProfilerAlertCallback,
} from "./devtools/profiler.js";
export {
  setActiveProfiler,
  getActiveProfiler,
} from "./devtools/profiler-registry.js";
export {
  enableCrashLog,
  type CrashLogOptions,
  type CrashLogData,
} from "./devtools/crash-log.js";
export { BrailleCanvas, BRAILLE_BASE } from "./utils/braille-canvas.js";
export {
  createAnimation,
  tickAnimation,
  easings,
  type EasingFn,
  type AnimationRef,
} from "./utils/animate.js";
export {
  enableTreeSitter,
  getTreeSitter,
  type TreeSitterToken,
  type TreeSitterTokenizer,
} from "./utils/tree-sitter.js";
export { charWidth, stringWidth, iterGraphemes, type Grapheme } from "./core/unicode.js";
export { WebRenderer, type WebRendererOptions } from "./core/web-renderer.js";
export {
  ResizeObserver,
  notifyResizeObservers,
  type ResizeObserverEntry,
} from "./core/resize-observer.js";
export { StormSSHServer, type StormSSHOptions, type SSHSession, type SSHEvent } from "./ssh/index.js";
export {
  TestInputManager,
  MockInputManager,
  renderForTest,
  expectOutput,
  createSnapshot,
  compareSnapshot,
  clearSnapshots,
  saveSnapshot,
  compareFileSnapshot,
  saveSvgSnapshot,
  compareSvgSnapshot,
  createStormMatchers,
  renderToSvg,
  type RenderResult,
  type OutputAssertions,
  type LineAssertions,
  type SvgOptions,
} from "./testing/index.js";
// Animation & timing hooks
export { useTick, type UseTickOptions } from "./hooks/useTick.js";
export { usePhaseTimer, type PhaseEntry, type UsePhaseTimerOptions, type UsePhaseTimerResult } from "./hooks/usePhaseTimer.js";
export { useProfiler, type UseProfilerResult } from "./hooks/useProfiler.js";
