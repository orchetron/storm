# Components

Storm ships 97 built-in components organized by category.

## Quick Decision Guide

| I want to... | Use |
|---|---|
| Show a list of items | `<ListView>` (simple) or `<VirtualList>` (1000+ items) |
| Show a scrollable area | `<ScrollView height={N}>` or `<ScrollView flex={1}>` |
| Get text input | `<TextInput>` (single line) or `<ChatInput>` (multi-line) |
| Show a dropdown | `<Select>` |
| Show a data table | `<Table>` (simple) or `<DataGrid>` (sortable, selectable, editable) |
| Show a progress bar | `<ProgressBar>` (block fill) or `<GradientProgress>` (gradient) |
| Show a modal/dialog | `<Modal.Root>` (custom) or `<ConfirmDialog>` (yes/no) |
| Show tabs | `<TabbedContent>` (tabs + content) or `<Tabs>` (tab bar only) |
| Show a tree | `<Tree>` (data) or `<DirectoryTree>` (filesystem) |
| Show a chart | `<LineChart>` (lines) / `<BarChart>` (bars) / `<Sparkline>` (inline) |
| Show AI agent output | `<MessageBubble>` + `<StreamingText>` + `<OperationTree>` |
| Show a code block | `<SyntaxHighlight language="typescript">` |
| Show a diff | `<DiffView diff={unifiedDiff}>` |

## Categories

| Category | Components | Description |
|---|---|---|
| [Core](core.md) | Box, Text, ScrollView, Overlay, Spacer | Fundamental building blocks |
| [Input](input.md) | TextInput, TextArea, ChatInput, Button, Checkbox, Switch, RadioGroup, Select, OptionList, SearchInput, Form, MaskedInput, FilePicker, SelectInput, SelectionList, DatePicker | User input and forms |
| [Data](data.md) | Table, DataGrid, Tree, DirectoryTree, ListView, VirtualList, DiffView, InlineDiff, Calendar, Pretty | Data display |
| [Layout](layout.md) | Modal, Tabs, TabbedContent, Accordion, Collapsible, ContentSwitcher, ConfirmDialog, Header, Footer, FocusGroup, ErrorBoundary, Static, AnimatePresence, Transition, Welcome | Structure and containers |
| [Feedback](feedback.md) | Spinner, ProgressBar, LoadingIndicator, Badge, Toast, ToastContainer, Alert, StatusMessage, Tooltip | User feedback |
| [Visualization](visualization.md) | LineChart, AreaChart, BarChart, ScatterPlot, Heatmap, Histogram, Sparkline, Gauge, Diagram, Canvas, GradientProgress | Charts and graphs |
| [Navigation](navigation.md) | Breadcrumb, Menu, Stepper, Paginator, KeyboardHelp, HelpPanel, CommandPalette | Navigation patterns |
| [Content](content.md) | Card, Heading, Paragraph, Markdown, MarkdownViewer, Image, Gradient, GradientBorder, GlowText, Shadow, RichLog, Placeholder, UnorderedList, OrderedList, DefinitionList, Divider, Timer, Stopwatch, RevealTransition, Avatar, Digits, Kbd, Link, Newline, Tag | Content display |
| [Nesting Guide](nesting.md) | - | Which components work inside which |

For AI/agent widgets (OperationTree, MessageBubble, StreamingText...), see [Widgets](../widgets.md).
