import type { LayoutProps } from "./layout/engine.js";
import type { BorderStyle, Style } from "./core/types.js";
import type { AriaRole } from "./core/aria.js";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "tui-box": LayoutProps & {
        borderStyle?: BorderStyle;
        borderColor?: string | number;
        backgroundColor?: string | number;
        borderTop?: boolean;
        borderBottom?: boolean;
        borderLeft?: boolean;
        borderRight?: boolean;
        borderDimColor?: boolean;
        opaque?: boolean;
        sticky?: boolean;
        stickyChildren?: boolean;
        zIndex?: number;
        role?: AriaRole;
        "aria-label"?: string;
        "aria-hidden"?: boolean;
        userSelect?: boolean;
        children?: React.ReactNode;
        key?: React.Key;
      };
      "tui-text": Style & {
        dimColor?: boolean;
        wrap?: "wrap" | "truncate" | "truncate-end" | "truncate-middle" | "truncate-start";
        role?: AriaRole;
        "aria-label"?: string;
        "aria-hidden"?: boolean;
        backgroundColor?: string | number;
        _textNodeRef?: React.RefObject<any>;
        _linkUrl?: string;
        children?: React.ReactNode;
        key?: React.Key;
      };
      "tui-scroll-view": LayoutProps & {
        scrollTop?: number;
        scrollLeft?: number;
        borderStyle?: BorderStyle;
        borderColor?: string | number;
        overflow?: string;
        stickToBottom?: boolean;
        _scrollState?: any;
        _hostPropsRef?: React.RefObject<any>;
        _focusId?: string;
        scrollbarThumbColor?: string | number;
        scrollbarTrackColor?: string | number;
        scrollbarChar?: string;
        scrollbarTrackChar?: string;
        children?: React.ReactNode;
        key?: React.Key;
      };
      "tui-text-input": {
        value?: string;
        cursorOffset?: number;
        focus?: boolean;
        placeholder?: string;
        color?: string | number;
        placeholderColor?: string | number;
        _hostPropsRef?: React.RefObject<any>;
        _focusId?: string;
        _measureId?: string;
        width?: number | string;
        height?: number;
        flex?: number;
        flexGrow?: number;
        role?: AriaRole;
        children?: React.ReactNode;
        key?: React.Key;
      };
      "tui-overlay": {
        visible?: boolean;
        position?: "center" | "bottom" | "top";
        width?: number | string;
        height?: number;
        borderStyle?: BorderStyle;
        borderColor?: string | number;
        padding?: number;
        paddingX?: number;
        paddingY?: number;
        zIndex?: number;
        role?: AriaRole;
        children?: React.ReactNode;
        key?: React.Key;
      };
    }
  }
}

export {};
