#!/usr/bin/env node
// create-storm-app — scaffold a new Storm TUI project
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const name = process.argv[2] || "my-storm-app";
const dir = join(process.cwd(), name);

mkdirSync(dir, { recursive: true });
mkdirSync(join(dir, "src"), { recursive: true });

// package.json
writeFileSync(join(dir, "package.json"), JSON.stringify({
  name,
  version: "0.1.0",
  type: "module",
  scripts: {
    dev: "npx tsx --watch src/app.tsx",
    start: "npx tsx src/app.tsx",
    build: "tsc",
    test: "vitest run"
  },
  dependencies: {
    "@orchetron/storm-tui": "^0.1.0",
    "react": "^19.0.0"
  },
  devDependencies: {
    "@types/react": "^19.0.0",
    "typescript": "^5.7.0",
    "tsx": "^4.0.0",
    "vitest": "^2.0.0"
  }
}, null, 2));

// tsconfig.json
writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    module: "Node16",
    moduleResolution: "Node16",
    jsx: "react-jsx",
    strict: true,
    outDir: "dist",
    rootDir: "src",
    esModuleInterop: true,
    skipLibCheck: true
  },
  include: ["src"]
}, null, 2));

// src/app.tsx — starter template
writeFileSync(join(dir, "src/app.tsx"), `import { render, Box, Text, ScrollView, TextInput, useInput, useTui, useTerminal } from "@orchetron/storm-tui";
import { useState } from "react";

function App() {
  const { width, height } = useTerminal();
  const { exit } = useTui();
  const [messages, setMessages] = useState<string[]>(["Welcome to ${name}!"]);
  const [input, setInput] = useState("");

  useInput((e) => {
    if (e.key === "c" && e.ctrl) exit();
  });

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, text]);
    setInput("");
  };

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box height={1} paddingX={1}>
        <Text bold color="#82AAFF">⚡ ${name}</Text>
      </Box>
      <ScrollView flex={1} stickToBottom>
        <Box flexDirection="column" paddingX={1}>
          {messages.map((msg, i) => (
            <Text key={i}>{msg}</Text>
          ))}
        </Box>
      </ScrollView>
      <Box borderStyle="round" borderColor="#82AAFF" paddingX={1}>
        <Text color="#82AAFF">❯ </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type a message..."
          isFocused
        />
      </Box>
    </Box>
  );
}

const app = render(<App />);
await app.waitUntilExit();
`);

console.log(`\n  ⚡ Created ${name}/\n`);
console.log(`  cd ${name}`);
console.log(`  npm install`);
console.log(`  npm run dev\n`);
