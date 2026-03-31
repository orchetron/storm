# Storm TUI — Showpiece Demo (Light Mode)
# Record: vhs docs/showpiece-light.tape
# Output: docs/showpiece-light.gif

Output docs/showpiece-light.gif

Set Shell "bash"
Set FontSize 15
Set Width 1400
Set Height 800
Set Theme "Catppuccin Latte"
Set Padding 30
Set Margin 20
Set MarginFill "#F0F0F0"
Set BorderRadius 12
Set WindowBar Colorful
Set Framerate 30
Set CursorBlink false
Set TypingSpeed 0

Require node
Require npx

# Navigate to project
Hide
Type "cd /Users/hardy30894/Documents/untitled\\ folder/ORCH/orchetron-fabric/packages/storm-tui"
Enter
Sleep 1s
Type "clear"
Enter
Sleep 500ms
Show

# Launch showpiece
Type "npx tsx examples/showpiece-v2.tsx"
Enter
Sleep 1s

# Toggle to light mode immediately
Type "t"
Sleep 500ms

# Cell matrix splash (0-4s)
Sleep 4s

# Main screen — user message, reasoning, streaming
Sleep 5s

# Operations start appearing
Sleep 4s

# Diff panel slides in
Sleep 3s

# Metrics panel slides in
Sleep 5s

# Hold on full dashboard
Sleep 3s

# End card
Sleep 4s

# Auto-exits
Sleep 2s
