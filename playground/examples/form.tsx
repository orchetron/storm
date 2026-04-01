import React, { useState } from "react";
import {
  render,
  Box,
  Text,
  TextInput,
  Checkbox,
  useInput,
  useTui,
  useTerminal,
} from "../src/index.js";

function FormDemo() {
  const { exit } = useTui();
  const { width } = useTerminal();
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useInput((e) => {
    if (e.key === "c" && e.ctrl) exit();
  });

  if (submitted) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="#9ECE6A">
          Submitted!
        </Text>
        <Text>Name: {name}</Text>
        <Text>Agreed: {agreed ? "Yes" : "No"}</Text>
        <Text dim>Ctrl+C to exit</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1} width={Math.min(60, width)}>
      <Text bold color="#82AAFF">
        Storm Form Demo
      </Text>
      <Box height={1} />
      <Text>Name:</Text>
      <TextInput
        value={name}
        onChange={setName}
        onSubmit={() => setSubmitted(true)}
        placeholder="Enter your name..."
      />
      <Box height={1} />
      <Checkbox checked={agreed} onChange={setAgreed} label="I agree to the terms" />
      <Box height={1} />
      <Text dim>Press Enter to submit, Ctrl+C to exit</Text>
    </Box>
  );
}

render(<FormDemo />).waitUntilExit();
