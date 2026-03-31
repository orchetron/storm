// ── Core primitives ──────────────────────────────────────────────
export { Box, type BoxProps } from "./Box.js";
export { Text, type TextProps } from "./Text.js";
export { Newline, type NewlineProps } from "./Newline.js";
export { Spacer } from "./Spacer.js";
export { Static, type StaticProps } from "./Static.js";
export { Overlay, type OverlayProps } from "./Overlay.js";

// ── Layout & containers ─────────────────────────────────────────
export { ScrollView, type ScrollViewProps } from "./ScrollView.js";
export {
  Collapsible, type CollapsibleProps,
  type CollapsibleContextValue, CollapsibleContext, useCollapsibleContext,
  type CollapsibleRootProps, type CollapsibleCompoundHeaderProps, type CollapsibleCompoundContentProps,
} from "./Collapsible.js";
export { ContentSwitcher, type ContentSwitcherProps } from "./ContentSwitcher.js";
export {
  TabbedContent, type TabbedContentProps,
  type TabbedContentContextValue, TabbedContentContext, useTabbedContentContext,
  type TabbedContentRootProps, type TabbedContentTabProps, type TabbedContentPanelProps,
} from "./TabbedContent.js";
export {
  Accordion, type AccordionProps, type AccordionSection,
  type AccordionContextValue, AccordionContext, useAccordionContext,
  type AccordionSectionContextValue, AccordionSectionContext, useAccordionSectionContext,
  type AccordionRootProps, type AccordionCompoundSectionProps,
  type AccordionCompoundHeaderProps, type AccordionCompoundContentProps,
} from "./Accordion.js";
export {
  Modal, type ModalProps,
  type ModalContextValue, ModalContext, useModalContext,
  type ModalRootProps, type ModalTitleProps, type ModalBodyProps, type ModalFooterProps,
} from "./Modal.js";
export { Tooltip, type TooltipProps } from "./Tooltip.js";

// ── Typography ─────────────────────────────────────────────────
export { Heading, type HeadingProps } from "./Heading.js";
export { Paragraph, type ParagraphProps } from "./Paragraph.js";

// ── Text & display ──────────────────────────────────────────────
export { Link, type LinkProps } from "./Link.js";
export { Divider, type DividerProps } from "./Divider.js";
export { Badge, type BadgeProps } from "./Badge.js";
export { StatusMessage, type StatusMessageProps } from "./StatusMessage.js";
export {
  Alert, type AlertProps,
  type AlertContextValue, AlertContext, useAlertContext,
  type AlertRootProps, type AlertIconProps,
  type AlertCompoundTitleProps, type AlertCompoundBodyProps, type AlertCompoundActionProps,
} from "./Alert.js";
export { Gradient, type GradientProps, interpolateColor } from "./Gradient.js";
export { Digits, type DigitsProps } from "./Digits.js";
export { Avatar, type AvatarProps } from "./Avatar.js";
export { Placeholder, type PlaceholderProps } from "./Placeholder.js";
export {
  Pretty, type PrettyProps,
  type PrettyContextValue, PrettyContext, usePrettyContext,
  type PrettyRootProps, type PrettyCompoundNodeProps,
} from "./Pretty.js";
export {
  Breadcrumb, type BreadcrumbProps,
  type BreadcrumbContextValue, BreadcrumbContext, useBreadcrumbContext,
  type BreadcrumbRootProps, type BreadcrumbCompoundItemProps, type BreadcrumbSeparatorProps,
} from "./Breadcrumb.js";
export { Tag, type TagProps } from "./Tag.js";

// ── Data display ────────────────────────────────────────────────
export {
  Table, type TableProps, type TableColumn,
  type TableContextValue, TableContext, useTableContext,
  type TableRootProps, type TableCompoundHeaderProps, type TableCompoundBodyProps,
  type TableCompoundRowProps, type TableCompoundCellProps,
} from "./Table.js";
export {
  DataGrid, type DataGridProps, type DataGridColumn,
  type DataGridContextValue, DataGridContext, useDataGridContext,
  type DataGridRootProps, type DataGridCompoundColumnProps, type DataGridCompoundRowProps,
} from "./DataGrid.js";
export { Tree, type TreeProps, type TreeNode } from "./Tree.js";
export {
  DirectoryTree, type DirectoryTreeProps, type DirNode, type DirChildEntry,
  type DirectoryTreeContextValue, DirectoryTreeContext, useDirectoryTreeContext,
  type DirectoryTreeRootProps, type DirectoryTreeCompoundNodeProps,
} from "./DirectoryTree.js";
export { OrderedList, type OrderedListProps, type ListItem } from "./OrderedList.js";
export { UnorderedList, type UnorderedListProps } from "./UnorderedList.js";
export { DefinitionList, type DefinitionListProps, type DefinitionListItem } from "./DefinitionList.js";
export {
  ListView, type ListViewProps, type ListViewItem,
  type ListViewContextValue, ListViewContext, useListViewContext,
  type ListViewRootProps, type ListViewCompoundItemProps,
} from "./ListView.js";
export {
  RichLog, type RichLogProps, type LogEntry, type LogLevel,
  type RichLogContextValue, RichLogContext, useRichLogContext,
  type RichLogRootProps, type RichLogCompoundEntryProps,
} from "./RichLog.js";
export { Sparkline, type SparklineProps } from "./Sparkline.js";
export { LineChart, type LineChartProps, type LineChartSeries } from "./LineChart.js";
export { Heatmap, type HeatmapProps } from "./Heatmap.js";
export { Histogram, type HistogramProps } from "./Histogram.js";
export { AreaChart, type AreaChartProps } from "./AreaChart.js";
export { BarChart, type BarChartProps } from "./BarChart.js";
export { ScatterPlot, type ScatterPlotProps, type ScatterPlotSeries } from "./ScatterPlot.js";
export { Diagram, type DiagramProps, type DiagramNode, type DiagramEdge } from "./Diagram.js";

// ── Input ───────────────────────────────────────────────────────
export { TextInput, type TextInputProps } from "./TextInput.js";
export { ChatInput, type ChatInputProps } from "./ChatInput.js";
export { MaskedInput, type MaskedInputProps } from "./MaskedInput.js";
export { SearchInput, type SearchInputProps } from "./SearchInput.js";
export { SelectInput, type SelectInputItem, type SelectInputProps } from "./SelectInput.js";
export {
  Select, type SelectProps, type SelectOption,
  type SelectContextValue, SelectContext, useSelectContext,
  type SelectRootProps, type SelectTriggerProps, type SelectContentProps, type SelectCompoundOptionProps,
} from "./Select.js";
export { SelectionList, type SelectionListProps, type SelectionListItem } from "./SelectionList.js";
export { Checkbox, type CheckboxProps } from "./Checkbox.js";
export {
  RadioGroup, type RadioGroupProps, type RadioOption,
  type RadioGroupContextValue, RadioGroupContext, useRadioGroupContext,
  type RadioGroupRootProps, type RadioGroupCompoundOptionProps,
} from "./RadioGroup.js";
export { Switch, type SwitchProps, type SwitchSize } from "./Switch.js";
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button.js";
export {
  Form, type FormProps, type FormField,
  type FormContextValue, FormContext, useFormContext,
  type FormRootProps, type FormCompoundFieldProps, type FormCompoundSubmitProps,
} from "./Form.js";
export {
  FilePicker, type FilePickerProps, type FileNode, type FilePickerChildEntry,
  type FilePickerContextValue, FilePickerContext, useFilePickerContext,
  type FilePickerRootProps, type FilePickerCompoundEntryProps,
} from "./FilePicker.js";
export {
  Calendar, type CalendarProps,
  type CalendarContextValue, CalendarContext, useCalendarContext,
  type CalendarRootProps, type CalendarCompoundGridProps, type CalendarCompoundDayProps,
} from "./Calendar.js";
export {
  ConfirmDialog, type ConfirmDialogProps, type ConfirmDialogAction,
  type ConfirmDialogContextValue, ConfirmDialogContext, useConfirmDialogContext,
  type ConfirmDialogRootProps, type ConfirmDialogCompoundMessageProps, type ConfirmDialogCompoundActionsProps,
} from "./ConfirmDialog.js";
export {
  Menu, type MenuProps, type MenuItem,
  type MenuContextValue, MenuContext, useMenuContext,
  type MenuRootProps, type MenuCompoundItemProps, type MenuSeparatorProps, type MenuSubmenuProps,
} from "./Menu.js";

// ── Feedback & status ───────────────────────────────────────────
export { Spinner, type SpinnerProps } from "./Spinner.js";
export { ProgressBar, type ProgressBarProps } from "./ProgressBar.js";
export { Gauge, type GaugeProps, type GaugeThreshold } from "./Gauge.js";
export {
  Toast, type ToastProps,
  type ToastQueueContextValue, ToastQueueContext, useToastQueueContext,
  type ToastProviderProps, type ToastCompoundItemProps,
} from "./Toast.js";
export { Stopwatch, type StopwatchProps } from "./Stopwatch.js";
export { Timer, type TimerProps } from "./Timer.js";
export { GradientProgress, type GradientProgressProps } from "./GradientProgress.js";
export { RevealTransition, type RevealTransitionProps } from "./RevealTransition.js";

// ── Navigation ──────────────────────────────────────────────────
export {
  Tabs, type TabsProps, type Tab,
  type TabsContextValue, TabsContext, useTabsContext,
  type TabsRootProps, type TabsTriggerProps, type TabsPanelProps,
} from "./Tabs.js";
export { Paginator, type PaginatorProps } from "./Paginator.js";
export {
  Stepper, type StepperProps, type StepDef,
  type StepperContextValue, StepperContext, useStepperContext,
  type StepperRootProps, type StepperStepProps,
} from "./Stepper.js";
export { KeyboardHelp, type KeyboardHelpProps } from "./KeyboardHelp.js";
export { Header, type HeaderProps } from "./Header.js";
export { Footer, type FooterProps } from "./Footer.js";

// ── Media ──────────────────────────────────────────────────────
export { Image, type ImageProps, isColoredUnderlineSupported } from "./Image.js";

// ── Virtualization ───────────────────────���─────────────────────
export {
  VirtualList, type VirtualListProps,
  type VirtualListContextValue, VirtualListContext, useVirtualListContext,
  type VirtualListRootProps, type VirtualListCompoundItemProps,
} from "./VirtualList.js";

// ── Visual effects ────────────────────────────────────────────
export { Shadow, type ShadowProps } from "./Shadow.js";
export {
  Card, type CardProps,
  type CardContextValue, CardContext, useCardContext,
  type CardRootProps, type CardCompoundHeaderProps, type CardCompoundBodyProps, type CardCompoundFooterProps,
} from "./Card.js";
export { GlowText, type GlowTextProps } from "./GlowText.js";
export { GradientBorder, type GradientBorderProps } from "./GradientBorder.js";
export { Kbd, type KbdProps } from "./Kbd.js";
export { Separator, type SeparatorProps } from "./Separator.js";

// ── Focus management ───────────────────────────────────────────
export { FocusGroup, type FocusGroupProps } from "./FocusGroup.js";

// ── Diff ────────────────────────────────────────────────────────
export {
  DiffView, type DiffViewProps, type DiffLine,
  type DiffViewContextValue, DiffViewContext, useDiffViewContext,
  type DiffViewRootProps, type DiffViewCompoundLineProps, type DiffViewCompoundHunkProps,
} from "./DiffView.js";
export { InlineDiff, type InlineDiffProps } from "./InlineDiff.js";

// ── Storm signature ────────────────────────────────────────────
export { LightningPulse, type LightningPulseProps } from "./LightningPulse.js";

// ── Error Boundary ────────────────────────────────────────────
export { ErrorBoundary, type ErrorBoundaryProps } from "./ErrorBoundary.js";

// ── Animation ─────────────────────────────────────────────────
export { Transition, type TransitionProps, type TransitionTimingConfig } from "./Transition.js";
export { AnimatePresence, type AnimatePresenceProps } from "./AnimatePresence.js";
