import { DiffReviewModal } from "./modal.js";
import { DiffViewController } from "./diff-view-controller.js";
import type { DiffLine } from "./diff-engine.js";

/**
 * Minimal TUI interface needed by the overlay.
 * Matches the subset of Pi's TUI API we actually use.
 */
export interface OverlayTui {
  height?: number;
  requestRender(): void;
}

/**
 * Minimal theme interface needed by the overlay.
 * Matches the subset of Pi's Theme API we actually use.
 */
export interface OverlayTheme {
  fg(role: string, text: string): string;
  bold(text: string): string;
}

/**
 * Key matching utilities. Caller provides these from their framework.
 */
export interface OverlayKeyUtils {
  matchesKey(data: string, key: unknown): boolean;
  Key: {
    escape: unknown;
    up: unknown;
    down: unknown;
    enter: unknown;
    tab: unknown;
    ctrl(key: string): unknown;
  };
  truncateToWidth(text: string, width: number): string;
}

/**
 * Syntax highlighting function.
 * Given code and a file path, returns highlighted code (or the original if no highlighter available).
 */
export type HighlightProvider = (code: string, filePath: string) => string;

/**
 * Callbacks the overlay fires for external state management.
 */
export interface OverlayCallbacks {
  /** Called when a file is dismissed (for updating status widgets, etc.) */
  onDismiss?(): void;
  /** Called when user yanks text to editor */
  onPasteToEditor?(text: string): void;
}

/**
 * The render/handleInput/invalidate object returned by createOverlayHandler.
 * This matches Pi's ctx.ui.custom() callback return type.
 */
export interface OverlayHandler {
  render(width: number): string[];
  handleInput(data: string): void;
  invalidate(): void;
}

/**
 * Options for the overlay display.
 */
export interface OverlayOptions {
  /** Title shown in the top border. Default: "Diff Review" */
  title?: string;
}

/**
 * Creates the render/handleInput handler for the diff review overlay.
 * This is framework-agnostic — the caller wires it into their UI system
 * (e.g., Pi's ctx.ui.custom()).
 *
 * @param modal - The DiffReviewModal managing file list state
 * @param tui - TUI interface for height and render requests
 * @param theme - Theme for coloring
 * @param keyUtils - Key matching utilities
 * @param highlightProvider - Syntax highlighting function
 * @param done - Callback to close the overlay
 * @param callbacks - Optional callbacks for dismiss/yank events
 * @param options - Optional display options
 */
export function createOverlayHandler(
  modal: DiffReviewModal,
  tui: OverlayTui,
  theme: OverlayTheme,
  keyUtils: OverlayKeyUtils,
  highlightProvider: HighlightProvider,
  done: () => void,
  callbacks?: OverlayCallbacks,
  options?: OverlayOptions,
): OverlayHandler {
  const { matchesKey, Key, truncateToWidth } = keyUtils;
  let viewController: DiffViewController | null = null;

  const title = options?.title ?? "Diff Review";

  function buildViewController() {
    const diff = modal.getSelectedDiff();
    if (diff) {
      viewController = new DiffViewController(diff, highlightProvider);
    } else {
      viewController = null;
    }
  }

  buildViewController();

  return {
    render(width: number): string[] {
      const termHeight = tui.height ?? 40;
      const targetHeight = Math.max(20, Math.floor(termHeight * 0.75));
      const innerWidth = width - 4; // 2 for border chars + 2 for padding
      const fileList = modal.getFileList();
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

      // Build content lines (without borders)
      if (fileList.length === 0) {
        content.push(theme.fg("muted", "No files to review"));
        content.push("");
        content.push(theme.fg("dim", "Press Escape to close"));
      } else if (modal.isFilePickerOpen) {
        // File picker mode
        content.push(theme.fg("accent", theme.bold("File Picker")));
        content.push("");

        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          const selected = i === modal.filePickerIndex;
          const prefix = selected ? "▸ " : "  ";
          const name = selected
            ? theme.fg("accent", file.path)
            : theme.fg("text", file.path);
          const stats = theme.fg("muted", ` +${file.additions}/-${file.deletions}`);
          const tag = file.isNewFile ? theme.fg("success", " [new]") : "";
          content.push(`${prefix}${name}${stats}${tag}`);
        }

        content.push("");
        content.push(theme.fg("dim", "↑↓ navigate  Enter select  Esc cancel"));
      } else {
        // Full-screen diff view
        const currentFile = fileList[modal.selectedIndex];
        const fileIndex = modal.selectedIndex + 1;
        const totalFiles = fileList.length;

        // Header bar
        const fileNumStr = `[${fileIndex}/${totalFiles}]`;
        const filePathStr = theme.fg("accent", currentFile.path);
        const statsStr = theme.fg("muted", ` +${currentFile.additions}/-${currentFile.deletions}`);
        const rightIndicator = viewController && viewController.isVisualMode
          ? "VISUAL LINE"
          : "";

        const leftSide = `${fileNumStr} ${filePathStr}${statsStr}`;
        const leftSideStripped = `${fileNumStr} ${currentFile.path} +${currentFile.additions}/-${currentFile.deletions}`;
        const hPadding = Math.max(1, innerWidth - leftSideStripped.length - rightIndicator.length);
        content.push(leftSide + " ".repeat(hPadding) + theme.fg("accent", rightIndicator));
        content.push(theme.fg("border", "─".repeat(innerWidth)));

        // Diff content
        if (viewController) {
          const availableHeight = Math.max(5, targetHeight - 8);
          const diffLines = viewController.render(innerWidth, availableHeight);
          content.push(...diffLines);

          // Scroll indicator
          if (viewController.totalLines > availableHeight) {
            const pct = Math.round(
              ((viewController.scrollOffset + availableHeight) /
                viewController.totalLines) * 100
            );
            content.push(theme.fg("dim", `── ${Math.min(pct, 100)}% ──`));
          }
        }
      }

      // Assemble bordered output, padded to fixed height
      const output: string[] = [];

      // Top border
      const titleText = ` ${title} `;
      const topBorderLeft = "╭─";
      const topBorderRight = "─".repeat(Math.max(0, width - topBorderLeft.length - titleText.length - 1)) + "╮";
      output.push(theme.fg("border", topBorderLeft) + theme.fg("accent", theme.bold(titleText)) + theme.fg("border", topBorderRight));

      // Content lines with side borders
      for (const line of content) {
        output.push(padLine(line));
      }

      // Pad to fill fixed height
      while (output.length < targetHeight - 1) {
        output.push(emptyLine());
      }

      // Help line (overwrite last empty line)
      if (fileList.length > 0 && !modal.isFilePickerOpen) {
        const helpText = theme.fg("dim", "n/p files  d dismiss  Tab list  Ctrl+D/U scroll  y yank  V visual  q/Esc close");
        output[output.length - 1] = padLine(helpText);
      }

      // Bottom border
      output.push(theme.fg("border", `╰${"─".repeat(width - 2)}╯`));

      return output;
    },

    handleInput(data: string) {
      // File picker mode
      if (modal.isFilePickerOpen) {
        if (matchesKey(data, Key.escape)) {
          modal.closeFilePicker();
          tui.requestRender();
          return;
        }

        if (matchesKey(data, Key.up) || data === "k") {
          modal.filePickerPrevious();
          tui.requestRender();
          return;
        }

        if (matchesKey(data, Key.down) || data === "j") {
          modal.filePickerNext();
          tui.requestRender();
          return;
        }

        if (matchesKey(data, Key.enter)) {
          modal.confirmFilePickerSelection();
          buildViewController();
          tui.requestRender();
          return;
        }

        return;
      }

      // Normal diff view mode
      // Ctrl+C or Escape exits visual mode; Escape closes overlay if not in visual mode
      if (matchesKey(data, Key.ctrl("c"))) {
        if (viewController?.isVisualMode) {
          viewController.exitVisualMode();
          tui.requestRender();
        }
        return;
      }

      if (matchesKey(data, Key.escape)) {
        if (viewController?.isVisualMode) {
          viewController.exitVisualMode();
          tui.requestRender();
          return;
        }
        done();
        return;
      }

      if (data === "q") {
        done();
        return;
      }

      if (data === "n") {
        modal.selectNext();
        buildViewController();
        tui.requestRender();
        return;
      }
      if (data === "p") {
        modal.selectPrevious();
        buildViewController();
        tui.requestRender();
        return;
      }

      if (matchesKey(data, Key.up) || data === "k") {
        viewController?.scrollUp(1);
        tui.requestRender();
        return;
      }
      if (matchesKey(data, Key.down) || data === "j") {
        viewController?.scrollDown(1);
        tui.requestRender();
        return;
      }

      if (matchesKey(data, Key.ctrl("u"))) {
        viewController?.scrollUp(10);
        tui.requestRender();
        return;
      }
      if (matchesKey(data, Key.ctrl("d"))) {
        viewController?.scrollDown(10);
        tui.requestRender();
        return;
      }

      if (matchesKey(data, Key.tab)) {
        modal.openFilePicker();
        tui.requestRender();
        return;
      }

      if (data === "V") {
        if (viewController) {
          if (viewController.isVisualMode) {
            viewController.exitVisualMode();
          } else {
            viewController.enterVisualMode();
          }
          tui.requestRender();
        }
        return;
      }

      if (data === "d") {
        modal.dismissSelected();
        callbacks?.onDismiss?.();
        buildViewController();
        tui.requestRender();
        if (modal.getFileList().length === 0) {
          done();
        }
        return;
      }

      if (data === "y") {
        if (viewController) {
          if (viewController.isVisualMode) {
            const diffLines = viewController.getSelectedDiffLines();
            if (diffLines.length > 0) {
              const filePath = modal.getSelectedPath() || "";
              const lineNumbers = diffLines
                .map((dl: DiffLine) => dl.newLineNumber ?? dl.oldLineNumber)
                .filter((n: number | undefined): n is number => n !== undefined);

              if (lineNumbers.length > 0) {
                const minLine = Math.min(...lineNumbers);
                const maxLine = Math.max(...lineNumbers);
                const rangeStr = minLine === maxLine ? `${minLine}` : `${minLine}-${maxLine}`;
                const header = `\`${filePath}:${rangeStr}\``;
                const codeLines = diffLines.map((dl: DiffLine) => dl.content);
                const fencedBlock = `${header}\n\`\`\`\n${codeLines.join('\n')}\n\`\`\``;
                callbacks?.onPasteToEditor?.(fencedBlock);
                viewController.exitVisualMode();
                done();
              }
            }
          } else {
            const diffLine = viewController.getCursorDiffLine();
            if (diffLine) {
              const filePath = modal.getSelectedPath() || "";
              const lineNum = diffLine.newLineNumber ?? diffLine.oldLineNumber;
              if (lineNum !== undefined) {
                callbacks?.onPasteToEditor?.(`${filePath}:${lineNum}`);
                done();
              }
            }
          }
        }
        return;
      }
    },

    invalidate() {},
  };
}
