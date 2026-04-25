import { DiffReviewModal } from "./modal.js";
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
export declare function createOverlayHandler(modal: DiffReviewModal, tui: OverlayTui, theme: OverlayTheme, keyUtils: OverlayKeyUtils, highlightProvider: HighlightProvider, done: () => void, callbacks?: OverlayCallbacks, options?: OverlayOptions): OverlayHandler;
//# sourceMappingURL=overlay.d.ts.map