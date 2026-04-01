# Storm TUI — Demo Recording
# Record: vhs docs/demo.tape
# Requires: vhs

Output docs/storm-agent-demo.gif

Set Shell "bash"
Set FontSize 13
Set Width 1400
Set Height 900
Set Theme "Catppuccin Mocha"
Set Padding 20

Require node
Require npx

# Hidden: navigate and clear
Hide
Type "cd storm-tui"
Enter
Sleep 1s
Type "clear"
Enter
Sleep 500ms
Show

# Launch the demo
Type "npx tsx examples/demo.tsx"
Enter
Sleep 4s

# Wait for banner animation
Sleep 3s

# ── Turn 1: Code fix with ephemeral reasoning + syntax highlighting ──
Type "fix the race condition in the event loop"
Sleep 500ms
Enter
Sleep 8s
Sleep 2s

# ── Turn 2: Complex system architecture canvas ──────────────────────
Type "show me the full system architecture"
Sleep 500ms
Enter
Sleep 10s

# Scroll to see the full architecture
PageUp@200ms 3
Sleep 2s
PageDown@200ms 3
Sleep 3s

# ── Turn 3: Memory leak fix with code patch ─────────────────────────
Type "find memory leaks in the codebase"
Sleep 500ms
Enter
Sleep 8s
Sleep 2s

# ── Turn 4: LineChart with multi-series latency data ────────────────
Type "show me the latency data from the last 24 hours"
Sleep 500ms
Enter
Sleep 10s
Sleep 2s

# ── Turn 5: Security audit with code diff ───────────────────────────
Type "audit the auth module for security"
Sleep 500ms
Enter
Sleep 8s
Sleep 2s

# ── Turn 6: Error rate heatmap ──────────────────────────────────────
Type "show error rates across services"
Sleep 500ms
Enter
Sleep 10s

# Final scroll through everything
PageUp@200ms 8
Sleep 2s
PageDown@200ms 8
Sleep 3s

# Final pause
Sleep 2s

# Quit
Ctrl+C
Sleep 1s
