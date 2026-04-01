import React, { useRef } from "react";
import {
  render,
  Box,
  Text,
  Sparkline,
  Gauge,
  Badge,
  Separator,
  Spinner,
  useInput,
  useTerminal,
  useTui,
  useTick,
} from "../src/index.js";

function Dashboard() {
  const { width, height } = useTerminal();
  const { exit } = useTui();
  useInput((e) => {
    if (e.key === "c" && e.ctrl) exit();
  });

  const cpuRef = useRef(
    Array.from({ length: 30 }, () => 20 + Math.random() * 40),
  );
  const memRef = useRef(55);

  useTick(500, () => {
    const arr = cpuRef.current;
    arr.push(
      Math.max(
        5,
        Math.min(95, arr[arr.length - 1] + (Math.random() - 0.5) * 15),
      ),
    );
    if (arr.length > 30) arr.shift();
    memRef.current = Math.max(
      30,
      Math.min(85, memRef.current + (Math.random() - 0.45) * 3),
    );
  });

  const cpu = Math.round(cpuRef.current[cpuRef.current.length - 1]);
  const mem = Math.round(memRef.current);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box height={1} paddingX={1}>
        <Spinner type="dots" color="#82AAFF" />
        <Text bold color="#82AAFF">
          {" Storm Dashboard"}
        </Text>
        <Box flex={1} />
        <Badge
          label={`CPU ${cpu}%`}
          variant={cpu > 70 ? "error" : "success"}
        />
        <Text> </Text>
        <Badge
          label={`MEM ${mem}%`}
          variant={mem > 70 ? "warning" : "success"}
        />
      </Box>
      <Separator style="line" color="#565F89" />
      <Box flex={1} flexDirection="row" paddingX={1}>
        <Box flex={1} flexDirection="column">
          <Text bold color="#82AAFF">
            CPU Usage
          </Text>
          <Sparkline
            data={cpuRef.current}
            width={Math.max(10, Math.floor(width / 2) - 4)}
            height={3}
            color="#82AAFF"
          />
        </Box>
        <Box flex={1} flexDirection="column">
          <Text bold color="#82AAFF">
            Memory
          </Text>
          <Gauge
            value={mem}
            width={Math.max(10, Math.floor(width / 2) - 4)}
            color={mem > 70 ? "#E0AF68" : "#9ECE6A"}
            label={`${mem}%`}
          />
        </Box>
      </Box>
    </Box>
  );
}

render(<Dashboard />).waitUntilExit();
