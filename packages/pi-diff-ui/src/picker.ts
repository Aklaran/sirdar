import type { OverlayTui, OverlayTheme, OverlayKeyUtils, OverlayHandler } from "./overlay.js";

/**
 * A selectable item in the picker list.
 */
export interface PickerItem {
  id: string;
  label: string;
  description?: string;
  meta?: string;  // right-aligned info like "3 files, +45/-12"
}

/**
 * Callbacks for picker user interactions.
 */
export interface PickerCallbacks {
  onSelect: (item: PickerItem) => void;
  onCancel: () => void;
  /** Called when user presses 'd' to dismiss an item. Return true if the item was removed. */
  onDismiss?: (item: PickerItem) => boolean;
}

/**
 * Configuration options for the picker overlay.
 */
export interface PickerOptions {
  title?: string;
}

export function createPickerHandler(
  items: PickerItem[],
  tui: OverlayTui,
  theme: OverlayTheme,
  keyUtils: OverlayKeyUtils,
  callbacks: PickerCallbacks,
  options?: PickerOptions,
): OverlayHandler {
  const { matchesKey, Key, truncateToWidth } = keyUtils;
  let cursorIndex = 0;
  let scrollOffset = 0;

  const title = options?.title ?? "Select";

  return {
    render(width: number): string[] {
      const termHeight = tui.height ?? 40;
      const targetHeight = Math.max(20, Math.floor(termHeight * 0.75));
      const innerWidth = width - 4; // 2 for border chars + 2 for padding
      const content: string[] = [];

      const border = theme.fg("border", "│");
      const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
      const padLine = (line: string) => {
        const truncated = truncateToWidth(line, innerWidth);
        const visible = stripAnsi(truncated).length;
        const rightPad = Math.max(0, innerWidth - visible);
        return `${border} ${truncated}${" ".repeat(rightPad)} ${border}`;
      };
      const emptyLine = () => `${border}${" ".repeat(width - 2)}${border}`;

      // Build content lines
      content.push(theme.fg("toolTitle", theme.bold(title)));
      content.push("");

      if (items.length === 0) {
        content.push(theme.fg("muted", "No items"));
      } else {
        // Calculate available height for items
        const headerLines = 2; // title + empty line
        const borderLines = 2; // top + bottom border
        const availableHeight = targetHeight - headerLines - borderLines;

        // Adjust scroll offset to keep cursor visible
        if (cursorIndex < scrollOffset) {
          scrollOffset = cursorIndex;
        } else if (cursorIndex >= scrollOffset + availableHeight) {
          scrollOffset = cursorIndex - availableHeight + 1;
        }

        // Render visible items
        const visibleStart = scrollOffset;
        const visibleEnd = Math.min(scrollOffset + availableHeight, items.length);

        for (let i = visibleStart; i < visibleEnd; i++) {
          const item = items[i];
          const isSelected = i === cursorIndex;
          const cursor = isSelected ? ">" : " ";
          
          // Build the main item line
          let itemLine: string;
          
          // Add meta info if present
          if (item.meta) {
            // Calculate padding for right alignment
            const cursorAndLabel = `${cursor} ${item.label}`;
            const labelPart = isSelected ? theme.bold(cursorAndLabel) : cursorAndLabel;
            const labelLen = stripAnsi(labelPart).length;
            const metaLen = stripAnsi(item.meta).length;
            const padding = Math.max(1, innerWidth - labelLen - metaLen);
            
            itemLine = labelPart + " ".repeat(padding) + item.meta;
          } else {
            const cursorAndLabel = `${cursor} ${item.label}`;
            itemLine = isSelected ? theme.bold(cursorAndLabel) : cursorAndLabel;
          }

          content.push(itemLine);

          // Add description if present
          if (item.description) {
            const descLine = `  ${theme.fg("dim", item.description)}`;
            content.push(descLine);
          }
        }
      }

      // Assemble bordered output
      const output: string[] = [];

      // Top border
      const titleText = ` ${title} `;
      const topBorderLeft = "╭─";
      const topBorderRight = "─".repeat(Math.max(0, width - topBorderLeft.length - titleText.length - 1)) + "╮";
      output.push(theme.fg("border", topBorderLeft) + theme.fg("toolTitle", theme.bold(titleText)) + theme.fg("border", topBorderRight));

      // Content lines with side borders
      for (const line of content) {
        output.push(padLine(line));
      }

      // Pad to fill fixed height (reserve 1 line for help text, 1 for bottom border)
      while (output.length < targetHeight - 2) {
        output.push(emptyLine());
      }

      // Help line
      if (items.length > 0) {
        const dismissHint = callbacks.onDismiss ? "  d dismiss" : "";
        const helpText = theme.fg("dim", `↑↓ navigate  Enter select${dismissHint}  Esc close`);
        output.push(padLine(helpText));
      } else {
        output.push(emptyLine());
      }

      // Bottom border
      output.push(theme.fg("border", `╰${"─".repeat(width - 2)}╯`));

      return output;
    },

    handleInput(data: string): boolean {
      // Handle empty list
      if (items.length === 0) {
        if (data === "q" || matchesKey(data, Key.escape)) {
          callbacks.onCancel();
          return true;
        }
        return false;
      }

      // Navigation
      if (data === "j" || matchesKey(data, Key.down)) {
        if (cursorIndex < items.length - 1) {
          cursorIndex++;
        }
        tui.requestRender();
        return true;
      }

      if (data === "k" || matchesKey(data, Key.up)) {
        if (cursorIndex > 0) {
          cursorIndex--;
        }
        tui.requestRender();
        return true;
      }

      // Selection
      if (matchesKey(data, Key.enter)) {
        callbacks.onSelect(items[cursorIndex]);
        return true;
      }

      // Dismiss
      if (data === "d" && callbacks.onDismiss) {
        const removed = callbacks.onDismiss(items[cursorIndex]);
        if (removed) {
          items.splice(cursorIndex, 1);
          if (items.length === 0) {
            callbacks.onCancel();
            return true;
          }
          if (cursorIndex >= items.length) {
            cursorIndex = items.length - 1;
          }
          tui.requestRender();
        }
        return true;
      }

      // Cancel
      if (data === "q" || matchesKey(data, Key.escape)) {
        callbacks.onCancel();
        return true;
      }

      return false;
    },

    invalidate() {},
  };
}
