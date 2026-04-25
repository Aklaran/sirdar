import { InlineDiffView } from './inline-view.js';
export class DiffViewController {
    inlineView;
    constructor(diff, highlightFn) {
        this.inlineView = new InlineDiffView(diff, highlightFn);
    }
    setDiff(diff) {
        this.inlineView.setDiff(diff);
    }
    // Scroll methods
    scrollUp(lines) {
        this.inlineView.scrollUp(lines);
    }
    scrollDown(lines) {
        this.inlineView.scrollDown(lines);
    }
    scrollToTop() {
        this.inlineView.scrollToTop();
    }
    scrollToBottom() {
        this.inlineView.scrollToBottom();
    }
    // Render methods
    render(width, visibleHeight) {
        return this.inlineView.render(width, visibleHeight);
    }
    get totalLines() {
        return this.inlineView.totalLines;
    }
    get scrollOffset() {
        return this.inlineView.scrollOffset;
    }
    // Cursor methods
    get cursorLine() {
        return this.inlineView.cursorLine;
    }
    moveCursor(delta) {
        this.inlineView.moveCursor(delta);
    }
    setCursor(line) {
        this.inlineView.setCursor(line);
    }
    getCursorDiffLine() {
        return this.inlineView.getCursorDiffLine();
    }
    isSeparatorLine(index) {
        return this.inlineView.isSeparatorLine(index);
    }
    // Visual mode methods
    get isVisualMode() {
        return this.inlineView.isVisualMode;
    }
    enterVisualMode() {
        this.inlineView.enterVisualMode();
    }
    exitVisualMode() {
        this.inlineView.exitVisualMode();
    }
    getVisualRange() {
        return this.inlineView.getVisualRange();
    }
    getSelectedRawLines() {
        return this.inlineView.getSelectedRawLines();
    }
    getSelectedDiffLines() {
        return this.inlineView.getSelectedDiffLines();
    }
}
//# sourceMappingURL=diff-view-controller.js.map