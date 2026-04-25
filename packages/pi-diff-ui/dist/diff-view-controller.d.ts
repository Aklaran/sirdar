import type { FileDiff, DiffLine } from './diff-engine.js';
import { type HighlightFn } from './inline-view.js';
export declare class DiffViewController {
    private inlineView;
    constructor(diff: FileDiff, highlightFn?: HighlightFn);
    setDiff(diff: FileDiff): void;
    scrollUp(lines?: number): void;
    scrollDown(lines?: number): void;
    scrollToTop(): void;
    scrollToBottom(): void;
    render(width: number, visibleHeight: number): string[];
    get totalLines(): number;
    get scrollOffset(): number;
    get cursorLine(): number;
    moveCursor(delta: number): void;
    setCursor(line: number): void;
    getCursorDiffLine(): DiffLine | undefined;
    isSeparatorLine(index: number): boolean;
    get isVisualMode(): boolean;
    enterVisualMode(): void;
    exitVisualMode(): void;
    getVisualRange(): [number, number];
    getSelectedRawLines(): string[];
    getSelectedDiffLines(): DiffLine[];
}
//# sourceMappingURL=diff-view-controller.d.ts.map