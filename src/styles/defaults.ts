/**
 * Component default styles — centralized visual defaults.
 *
 * Every component reads its defaults from here. Users override
 * via style props. Changing a default here changes every instance.
 *
 * This is Storm's centralized default stylesheet.
 */

export const DEFAULTS = {
  card: {
    borderStyle: "round" as const,
    paddingLeft: 2,
    paddingRight: 2,
    paddingTop: 1,
    paddingBottom: 1,
  },
  alert: {
    borderStyle: "round" as const,
    paddingLeft: 1,
    paddingRight: 1,
  },
  modal: {
    borderStyle: "round" as const,
    padding: 1,
    width: 60,
    size: "md" as const,
  },
  button: {
    paddingLeft: 1,
    paddingRight: 1,
  },
  table: {
    borderStyle: "single" as const,
  },
  dataGrid: {
    borderStyle: "single" as const,
  },
  toast: {
    duration: 3000,
  },
  accordion: {},
  collapsible: {},
  tabbedContent: {},
  form: {},
  confirmDialog: {
    borderStyle: "round" as const,
    paddingX: 2,
    paddingY: 1,
  },
  richLog: {},
  listView: {},
  header: {
    borderStyle: "round" as const,
  },
  footer: {
    borderStyle: "single" as const,
  },
  progressBar: {
    width: 30,
    filledChar: "\u2588",  // █
    emptyChar: "\u2591",   // ░
  },
  spinner: {
    interval: 80,
  },
  divider: {
    width: 200,
  },
  separator: {
    width: 200,
  },
  scrollbar: {
    thumbChar: "\u2503",  // ┃
    trackChar: "\u2502",  // │
  },
} as const;

export type ComponentDefaults = typeof DEFAULTS;
