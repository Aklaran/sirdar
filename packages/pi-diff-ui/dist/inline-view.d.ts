import type { FileDiff, DiffLine } from './diff-engine.js';
export type HighlightFn = (code: string, filePath: string) => string;
export declare class InlineDiffView {
    private diff;
    private highlightFn?;
    private renderedLines;
    private _scrollOffset;
    private _cursorLine;
    private _lineToHunkIndex;
    private _visualMode;
    private _visualAnchor;
    constructor(diff: FileDiff, highlightFn?: HighlightFn);
    get cursorLine(): number;
    get isVisualMode(): boolean;
    get visualAnchor(): number;
    enterVisualMode(): void;
    exitVisualMode(): void;
    getVisualRange(): [number, number];
    getSelectedRawLines(): string[];
    getSelectedDiffLines(): DiffLine[];
    setDiff(diff: FileDiff): void;
    moveCursor(delta: number): void;
    setCursor(line: number): void;
    getCursorDiffLine(): DiffLine | undefined;
    isSeparatorLine(index: number): boolean;
    scrollUp(lines?: number): void;
    scrollDown(lines?: number): void;
    scrollToTop(): void;
    scrollToBottom(): void;
    get totalLines(): number;
    get scrollOffset(): number;
    render(width: number, visibleHeight: number): string[];
    private buildRenderedLines;
    private getMaxLineNumber;
    private renderHunk;
    private createSeparatorLine;
    private truncateToWidth;
}
//# sourceMappingURL=inline-view.d.ts.map