# Storm Recipes

Complete, copy-pasteable examples. Each builds something real.

> **Note:** These recipes use `useApp()` for brevity. It provides `exit`, `rerender`, and `clear`. If you need the full context (screen, input, focus, flushSync, commitText), use `useTui()` instead -- see [Getting Started](getting-started.md).

---

## 1. Chat App

ScrollView with `stickToBottom` keeps new messages visible. TextInput captures user input. `useInput` handles Ctrl+C exit.

```tsx
import { useState, useRef } from "react";
import {
  render, Box, Text, ScrollView, TextInput, useInput, useApp,
} from "@orchetron/storm-tui";

interface Message {
  id: number;
  sender: string;
  text: string;
}

function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, sender: "system", text: "Welcome to the chat." },
  ]);
  const [input, setInput] = useState("");
  const nextId = useRef(1);
  const { exit } = useApp();

  // Ctrl+C to quit
  useInput((event) => {
    if (event.key === "c" && event.ctrl) exit();
  });

  const handleSubmit = (value: string) => {
    if (!value.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: nextId.current++, sender: "you", text: value },
    ]);
    setInput("");
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* stickToBottom: auto-scrolls when new messages arrive */}
      <ScrollView flex={1} stickToBottom>
        {messages.map((msg) => (
          <Text key={msg.id}>
            <Text bold color="cyan">{msg.sender}</Text>
            <Text> {msg.text}</Text>
          </Text>
        ))}
      </ScrollView>

      <TextInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        placeholder="Type a message..."
        focus
      />
    </Box>
  );
}

const app = render(<ChatApp />);
await app.waitUntilExit();
```

---

## 2. Dashboard with Tabs

Tabs switches between panels. StatusLine anchors to the bottom. `useKeyboardShortcuts` wires number keys to tab navigation.

```tsx
import { useState } from "react";
import {
  render, Box, Text, Tabs, StatusLine, useKeyboardShortcuts, useApp,
  type Tab,
} from "@orchetron/storm-tui";

const tabs: Tab[] = [
  { key: "overview", label: "Overview" },
  { key: "logs", label: "Logs" },
  { key: "settings", label: "Settings" },
];

function Dashboard() {
  const [active, setActive] = useState("overview");
  const { exit } = useApp();

  useKeyboardShortcuts([
    { key: "1", handler: () => setActive("overview") },
    { key: "2", handler: () => setActive("logs") },
    { key: "3", handler: () => setActive("settings") },
    { key: "q", handler: () => exit() },
  ]);

  return (
    <Box flexDirection="column" height="100%">
      <Tabs tabs={tabs} activeKey={active} onChange={setActive} isFocused />

      <Box flex={1} padding={1}>
        {active === "overview" && <Text>System healthy. 4 agents running.</Text>}
        {active === "logs" && <Text dim>[14:02:03] Task completed (1.2s)</Text>}
        {active === "settings" && <Text>Config: default profile</Text>}
      </Box>

      <StatusLine brand="storm" model="phi-4" tokens={2048} />
    </Box>
  );
}

const app = render(<Dashboard />);
await app.waitUntilExit();
```

---

## 3. File Browser

DirectoryTree reads the filesystem and renders a navigable tree. Wrap it in a ScrollView for long directory listings. `onSelect` reports the chosen file.

```tsx
import { useState } from "react";
import {
  render, Box, Text, ScrollView, DirectoryTree, useApp, useInput,
} from "@orchetron/storm-tui";

function FileBrowser() {
  const [selected, setSelected] = useState<string | null>(null);
  const { exit } = useApp();

  useInput((event) => {
    if (event.key === "q" || (event.key === "c" && event.ctrl)) exit();
  });

  return (
    <Box flexDirection="column" height="100%">
      <Text bold color="cyan"> File Browser </Text>

      <ScrollView flex={1}>
        <DirectoryTree
          rootPath="."
          onSelect={setSelected}
          showFiles
          isFocused
        />
      </ScrollView>

      <Box height={1} paddingX={1}>
        <Text dim>
          {selected ? `Selected: ${selected}` : "Navigate with arrows, Enter to expand"}
        </Text>
      </Box>
    </Box>
  );
}

const app = render(<FileBrowser />);
await app.waitUntilExit();
```

---

## 4. Loading States

Spinner for indeterminate waits, ProgressBar for known progress, StreamingText for streamed content.

```tsx
import { useState } from "react";
import {
  render, Box, Text, Spinner, ProgressBar, StreamingText, useInterval,
} from "@orchetron/storm-tui";

function LoadingDemo() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "downloading" | "streaming">("loading");

  useInterval(() => {
    if (phase === "loading") {
      setPhase("downloading");
    } else if (phase === "downloading") {
      setProgress((p) => {
        if (p >= 100) { setPhase("streaming"); return 100; }
        return p + 10;
      });
    }
  }, 500);

  return (
    <Box flexDirection="column" gap={1} padding={1}>
      {/* Phase 1: indeterminate spinner */}
      <Box>
        <Spinner type="dots" label="Connecting..." />
      </Box>

      {/* Phase 2: determinate progress */}
      <Box flexDirection="column">
        <Text>Download:</Text>
        <ProgressBar value={progress} width={40} showPercent />
      </Box>

      {/* Phase 3: streamed text with cursor */}
      {phase === "streaming" && (
        <StreamingText
          text="Analysis complete. Found 14 files with 3 issues."
          streaming
          cursor
        />
      )}
    </Box>
  );
}

const app = render(<LoadingDemo />);
await app.waitUntilExit();
```

---

## 5. Form with Validation

TextInput fields, Checkbox, Select, and Button. Toast shows success/error feedback on submit.

**Important:** Only one interactive component should have focus at a time. Use a `focusedField` state and pass `focus`/`isFocused` to exactly one component. Tab/Shift+Tab cycles between fields.

```tsx
import { useState, useRef } from "react";
import {
  render, Box, Text, TextInput, Checkbox, Select, Button,
  ToastContainer, useApp, useInput, type ToastItem, type SelectOption,
} from "@orchetron/storm-tui";

const roleOptions: SelectOption[] = [
  { label: "Developer", value: "dev" },
  { label: "Designer", value: "design" },
  { label: "Manager", value: "mgr" },
];

const fields = ["name", "role", "agree", "submit"] as const;
type Field = (typeof fields)[number];

function FormDemo() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [agree, setAgree] = useState(false);
  const [focused, setFocused] = useState<Field>("name");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const { exit } = useApp();

  // Tab / Shift+Tab to cycle focus between fields
  useInput((event) => {
    if (event.key === "tab") {
      setFocused((prev) => {
        const idx = fields.indexOf(prev);
        const next = (idx + (event.shift ? -1 : 1) + fields.length) % fields.length;
        return fields[next]!;
      });
    }
    if (event.key === "c" && event.ctrl) exit();
  });

  const addToast = (message: string, type: "success" | "error") => {
    const id = String(toastId.current++);
    setToasts((t) => [...t, { id, message, type, durationMs: 3000 }]);
  };

  const handleSubmit = () => {
    if (!name.trim()) return addToast("Name is required", "error");
    if (!role) return addToast("Select a role", "error");
    if (!agree) return addToast("Must accept terms", "error");
    addToast(`Registered ${name} as ${role}`, "success");
  };

  return (
    <Box flexDirection="column" gap={1} padding={1} height="100%">
      <Text bold>Registration</Text>

      <TextInput value={name} onChange={setName} placeholder="Name" focus={focused === "name"} />
      <Select options={roleOptions} value={role} onChange={setRole} placeholder="Role" isFocused={focused === "role"} />
      <Checkbox checked={agree} onChange={setAgree} label="I accept the terms" isFocused={focused === "agree"} />
      <Button label="Submit" onPress={handleSubmit} isFocused={focused === "submit"} />

      <Text dim>Tab: next field | Shift+Tab: previous field</Text>
      <Box flex={1} />
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))}
      />
    </Box>
  );
}

const app = render(<FormDemo />);
await app.waitUntilExit();
```

---

## 6. AI Agent Interface

MessageBubble for conversation, OperationTree for tool progress, ApprovalPrompt for tool approval, BlinkDot for status, ModelBadge in the header.

```tsx
import { useState } from "react";
import {
  render, Box, Text, ScrollView, useApp, useInput,
  MessageBubble, OperationTree, ApprovalPrompt, BlinkDot, ModelBadge,
  StatusLine,
  type OpNode,
} from "@orchetron/storm-tui";

function AgentUI() {
  const { exit } = useApp();
  const [status, setStatus] = useState<"running" | "completed">("running");
  const [approved, setApproved] = useState(false);

  useInput((event) => {
    if (event.key === "c" && event.ctrl) exit();
  });

  const operations: OpNode[] = [
    {
      id: "1", label: "Read config.json", status: "completed", durationMs: 120,
    },
    {
      id: "2", label: "Analyze dependencies", status: "running",
      children: [
        { id: "2a", label: "Parse package.json", status: "completed", durationMs: 45 },
        { id: "2b", label: "Check versions", status: "running" },
      ],
    },
    { id: "3", label: "Generate report", status: "pending" },
  ];

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box paddingX={1} gap={2}>
        <BlinkDot state={status} />
        <ModelBadge model="qwen-2.5-72b" provider="cloud" />
      </Box>

      {/* Conversation */}
      <ScrollView flex={1} stickToBottom>
        <MessageBubble role="user">
          Audit this project for outdated dependencies.
        </MessageBubble>
        <MessageBubble role="assistant">
          Scanning project files...
        </MessageBubble>

        {/* Tool progress tree */}
        <Box paddingLeft={2}>
          <OperationTree nodes={operations} showDuration />
        </Box>

        {/* Approval gate */}
        {!approved && (
          <ApprovalPrompt
            tool="write_file"
            risk="medium"
            params={{ path: "package.json", action: "update versions" }}
            onSelect={(key) => {
              if (key === "y") setApproved(true);
              if (key === "n") setStatus("completed");
            }}
          />
        )}
      </ScrollView>

      <StatusLine brand="orchetron" model="qwen-2.5-72b" tokens={12400} />
    </Box>
  );
}

const app = render(<AgentUI />);
await app.waitUntilExit();
```

---

## 7. Command Palette

`useCommandPalette` manages open/close, filtering, and keyboard navigation. CommandDropdown renders the filtered list.

```tsx
import { useState } from "react";
import {
  render, Box, Text, TextInput,
  useCommandPalette, CommandDropdown, type CommandDef,
} from "@orchetron/storm-tui";

const commands: CommandDef[] = [
  { name: "new-file", description: "Create a new file" },
  { name: "open-file", description: "Open existing file" },
  { name: "search", description: "Search in project", category: "find" },
  { name: "git-commit", description: "Commit changes", category: "git" },
  { name: "git-push", description: "Push to remote", category: "git" },
];

function PaletteDemo() {
  const [input, setInput] = useState("");

  const palette = useCommandPalette({
    commands,
    trigger: "/",
    onExecute: (cmd) => setInput(`Executed: ${cmd.name}`),
  });

  return (
    <Box flexDirection="column" padding={1} height="100%">
      <Text bold>Type "/" to open command palette</Text>
      <TextInput value={input} onChange={setInput} focus />

      {palette.isOpen && (
        <CommandDropdown
          items={palette.filtered.map((c) => ({
            name: c.name,
            description: c.description,
          }))}
          selectedIndex={palette.activeIndex}
          isFocused
        />
      )}
    </Box>
  );
}

const app = render(<PaletteDemo />);
await app.waitUntilExit();
```

---

## 8. Multi-Panel Layout

Box with `flexDirection="row"` creates columns. Fixed-width sidebars on each side, flex={1} for the main content area. `useTerminal` provides reactive terminal dimensions.

```tsx
import {
  render, Box, Text, useTerminal,
} from "@orchetron/storm-tui";

function MultiPanel() {
  const { width, height } = useTerminal();

  return (
    <Box flexDirection="column" height="100%">
      <Text bold color="cyan"> Multi-Panel ({width}x{height}) </Text>

      <Box flexDirection="row" flex={1}>
        {/* Left sidebar: fixed 20 columns */}
        <Box width={20} borderStyle="single" flexDirection="column" padding={1}>
          <Text bold>Files</Text>
          <Text> src/</Text>
          <Text> docs/</Text>
          <Text> tests/</Text>
        </Box>

        {/* Main content: fills remaining space */}
        <Box flex={1} borderStyle="single" padding={1} flexDirection="column">
          <Text bold>Editor</Text>
          <Text>Select a file to begin editing.</Text>
        </Box>

        {/* Right panel: fixed 25 columns */}
        <Box width={25} borderStyle="single" flexDirection="column" padding={1}>
          <Text bold>Properties</Text>
          <Text dim>No selection</Text>
        </Box>
      </Box>
    </Box>
  );
}

const app = render(<MultiPanel />);
await app.waitUntilExit();
```

---

## 9. Real-Time Metrics

Sparkline shows history, Gauge shows current value, ContextWindow tracks token usage. `useInterval` drives periodic updates.

```tsx
import { useState, useRef } from "react";
import {
  render, Box, Text, Sparkline, Gauge, ContextWindow, useInterval,
} from "@orchetron/storm-tui";

function MetricsDashboard() {
  const [cpuHistory, setCpuHistory] = useState<number[]>([20, 35, 28, 42, 55, 60, 45]);
  const [cpu, setCpu] = useState(45);
  const [tokens, setTokens] = useState(8000);

  useInterval(() => {
    // Simulate fluctuating metrics
    const next = Math.max(0, Math.min(100, cpu + (Math.random() - 0.5) * 20));
    setCpu(Math.round(next));
    setCpuHistory((h) => [...h.slice(-19), next]);
    setTokens((t) => Math.min(128000, t + Math.floor(Math.random() * 500)));
  }, 1000);

  return (
    <Box flexDirection="column" gap={1} padding={1}>
      <Text bold>Real-Time Metrics</Text>

      <Box gap={2}>
        <Box flexDirection="column">
          <Text>CPU History</Text>
          <Sparkline data={cpuHistory} width={20} height={3} />
        </Box>

        <Box flexDirection="column">
          <Text>CPU Now</Text>
          <Gauge
            value={cpu}
            width={20}
            showValue
            thresholds={[
              { value: 0, color: "green" },
              { value: 60, color: "yellow" },
              { value: 80, color: "red" },
            ]}
          />
        </Box>
      </Box>

      <ContextWindow used={tokens} limit={128000} compact={false} />
    </Box>
  );
}

const app = render(<MetricsDashboard />);
await app.waitUntilExit();
```

---

## 10. Scrollable Table with Sort

DataGrid handles rendering, row selection, and sort indicators. `useSortable` manages sort state. `useKeyboardShortcuts` adds quick navigation keys.

```tsx
import { useState, useMemo } from "react";
import {
  render, Box, Text, DataGrid, useSortable, useKeyboardShortcuts, useApp,
  type DataGridColumn,
} from "@orchetron/storm-tui";

const columns: DataGridColumn[] = [
  { key: "name", label: "Name", width: 20 },
  { key: "size", label: "Size", width: 10, align: "right" },
  { key: "modified", label: "Modified", width: 12 },
];

const rawRows = [
  { name: "package.json", size: 1240, modified: "2025-03-01" },
  { name: "tsconfig.json", size: 380, modified: "2025-02-15" },
  { name: "README.md", size: 4200, modified: "2025-03-10" },
  { name: "index.ts", size: 890, modified: "2025-03-12" },
  { name: "utils.ts", size: 2100, modified: "2025-01-28" },
  { name: "types.ts", size: 560, modified: "2025-02-20" },
  { name: "config.yaml", size: 310, modified: "2025-03-05" },
];

function TableDemo() {
  const [selected, setSelected] = useState(0);
  const { exit } = useApp();

  const sort = useSortable({
    columns: ["name", "size", "modified"],
    defaultSort: { key: "name", direction: "asc" },
  });

  useKeyboardShortcuts([
    { key: "q", handler: () => exit() },
  ]);

  // Sort rows based on current sort state
  const rows = useMemo(() => {
    if (!sort.sortKey) return rawRows;
    const key = sort.sortKey as keyof (typeof rawRows)[0];
    const dir = sort.sortDirection === "asc" ? 1 : -1;
    return [...rawRows].sort((a, b) => {
      if (a[key] < b[key]) return -1 * dir;
      if (a[key] > b[key]) return 1 * dir;
      return 0;
    });
  }, [sort.sortKey, sort.sortDirection]);

  return (
    <Box flexDirection="column" padding={1} height="100%">
      <Text bold>Files {sort.sortKey && `(sorted by ${sort.sortKey} ${sort.indicator(sort.sortKey)})`}</Text>

      <DataGrid
        columns={columns}
        rows={rows}
        selectedRow={selected}
        onSelect={setSelected}
        sortColumn={sort.sortKey ?? undefined}
        sortDirection={sort.sortDirection}
        onSort={(col) => sort.toggleSort(col)}
        isFocused
      />

      <Text dim>Up/Down: navigate | Enter on header: sort | q: quit</Text>
    </Box>
  );
}

const app = render(<TableDemo />);
await app.waitUntilExit();
```

---

## 11. npm-Style Progress (Logs Above, Progress Below)

Show scrolling log output above a fixed progress bar -- like `npm install`:

```tsx
import { useState, useRef } from "react";
import { render, Box, Text, ProgressBar, useTui, useInterval } from "@orchetron/storm-tui";

function DownloadProgress() {
  const { commitText } = useTui();
  const [progress, setProgress] = useState(0);

  useInterval(() => {
    setProgress(p => {
      const next = Math.min(p + 5, 100);
      // commitText writes above the live area (like npm logs)
      commitText(`Downloaded package ${Math.floor(next / 5)} of 20`);
      return next;
    });
  }, 200);

  return (
    <Box flexDirection="column">
      <Text bold>Installing dependencies...</Text>
      <ProgressBar value={progress} width={40} showPercent />
    </Box>
  );
}

render(<DownloadProgress />, { alternateScreen: false });
```

Key: `alternateScreen: false` keeps the normal scrollback, and `commitText()` writes persistent lines above the live TUI area.

> **Tip: File Logging**
> To log to a file while the TUI runs, use `fs.appendFileSync("app.log", message + "\n")` directly. Storm's `patchConsole` routes console output to the screen, not files. For structured logging, use any file-based logger (pino, winston with file transport).
