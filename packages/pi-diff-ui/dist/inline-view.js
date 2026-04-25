export class InlineDiffView {
    diff;
    highlightFn;
    renderedLines = [];
    _scrollOffset = 0;
    _cursorLine = 0;
    _lineToHunkIndex = [];
    _visualMode = false;
    _visualAnchor = 0;
    constructor(diff, highlightFn) {
        this.diff = diff;
        this.highlightFn = highlightFn;
        this.buildRenderedLines();
    }
    get cursorLine() {
        return this._cursorLine;
    }
    get isVisualMode() {
        return this._visualMode;
    }
    get visualAnchor() {
        return this._visualAnchor;
    }
    enterVisualMode() {
        this._visualMode = true;
        this._visualAnchor = this._cursorLine;
    }
    exitVisualMode() {
        this._visualMode = false;
    }
    getVisualRange() {
        const min = Math.min(this._visualAnchor, this._cursorLine);
        const max = Math.max(this._visualAnchor, this._cursorLine);
        return [min, max];
    }
    getSelectedRawLines() {
        const [min, max] = this.getVisualRange();
        const selectedLines = [];
        for (let i = min; i <= max; i++) {
            if (i >= 0 && i < this.renderedLines.length) {
                selectedLines.push(this.renderedLines[i].rawContent);
            }
        }
        return selectedLines;
    }
    getSelectedDiffLines() {
        const [min, max] = this.getVisualRange();
        const selectedDiffLines = [];
        for (let i = min; i <= max; i++) {
            if (i >= 0 && i < this._lineToHunkIndex.length) {
                const hunkIndex = this._lineToHunkIndex[i];
                if (hunkIndex !== -1 && hunkIndex !== undefined) {
                    selectedDiffLines.push(this.diff.hunks[hunkIndex]);
                }
            }
        }
        return selectedDiffLines;
    }
    setDiff(diff) {
        this.diff = diff;
        this._scrollOffset = 0;
        this._cursorLine = 0;
        this._visualMode = false;
        this.buildRenderedLines();
    }
    moveCursor(delta) {
        const newCursor = this._cursorLine + delta;
        this.setCursor(newCursor);
    }
    setCursor(line) {
        const maxLine = Math.max(0, this.renderedLines.length - 1);
        this._cursorLine = Math.max(0, Math.min(line, maxLine));
        // Auto-scroll happens in render() since we need visibleHeight
    }
    getCursorDiffLine() {
        if (this.renderedLines.length === 0) {
            return undefined;
        }
        const hunkIndex = this._lineToHunkIndex[this._cursorLine];
        if (hunkIndex === -1 || hunkIndex === undefined) {
            return undefined;
        }
        return this.diff.hunks[hunkIndex];
    }
    isSeparatorLine(index) {
        if (index < 0 || index >= this._lineToHunkIndex.length) {
            return false;
        }
        return this._lineToHunkIndex[index] === -1;
    }
    scrollUp(lines = 1) {
        this.moveCursor(-lines);
    }
    scrollDown(lines = 1) {
        this.moveCursor(lines);
    }
    scrollToTop() {
        this._cursorLine = 0;
        this._scrollOffset = 0;
    }
    scrollToBottom() {
        this._cursorLine = Math.max(0, this.renderedLines.length - 1);
        this._scrollOffset = Math.max(0, this.renderedLines.length);
    }
    get totalLines() {
        return this.renderedLines.length;
    }
    get scrollOffset() {
        return this._scrollOffset;
    }
    render(width, visibleHeight) {
        // Scroll margin: cursor moves freely within the viewport. When it gets
        // within SCROLL_MARGIN lines of the edge, the viewport scrolls to maintain
        // the buffer. At file boundaries the cursor can reach the very edge.
        const SCROLL_MARGIN = 5;
        const margin = Math.min(SCROLL_MARGIN, Math.floor((visibleHeight - 1) / 2));
        // Only scroll if cursor is outside the viewport entirely, or has entered
        // the margin zone from the appropriate direction
        const topBound = this._scrollOffset + margin;
        const bottomBound = this._scrollOffset + visibleHeight - 1 - margin;
        if (this._cursorLine > bottomBound) {
            // Cursor below safe zone — scroll down to restore margin
            this._scrollOffset = this._cursorLine - visibleHeight + 1 + margin;
        }
        else if (this._cursorLine < topBound) {
            // Cursor above safe zone — scroll up to restore margin
            this._scrollOffset = this._cursorLine - margin;
        }
        // Clamp scroll offset to valid range
        const maxOffset = Math.max(0, this.renderedLines.length - visibleHeight);
        this._scrollOffset = Math.max(0, Math.min(this._scrollOffset, maxOffset));
        const offset = this._scrollOffset;
        const endIndex = Math.min(offset + visibleHeight, this.renderedLines.length);
        const visibleLines = this.renderedLines.slice(offset, endIndex);
        return visibleLines.map((line, index) => {
            const lineIndex = offset + index;
            let content = line.content;
            // Check if line is within visual range
            let inVisualRange = false;
            if (this._visualMode) {
                const [min, max] = this.getVisualRange();
                inVisualRange = lineIndex >= min && lineIndex <= max;
            }
            // Highlight cursor line or visual selection with subtle dark gray background
            if (inVisualRange || lineIndex === this._cursorLine) {
                // Cursor highlight: strip any existing background colors and apply a uniform one
                // Use 256-color 240 (#585858) — bright enough to stand out over green/red diff backgrounds
                content = content.replace(/\x1b\[48;5;\d+m/g, '');
                content = content.replace(/\x1b\[49m/g, '');
                content = content.replace(/\x1b\[0m/g, '\x1b[22m\x1b[39m');
                content = `\x1b[48;5;240m${content}\x1b[0m`;
            }
            return this.truncateToWidth(content, width);
        });
    }
    buildRenderedLines() {
        this.renderedLines = [];
        this._lineToHunkIndex = [];
        if (this.diff.hunks.length === 0) {
            return;
        }
        // Calculate max line number for alignment
        const maxLineNumber = this.getMaxLineNumber();
        const lineNumberWidth = maxLineNumber.toString().length;
        let previousLineNumber;
        for (let i = 0; i < this.diff.hunks.length; i++) {
            const hunk = this.diff.hunks[i];
            const currentLineNumber = hunk.newLineNumber ?? hunk.oldLineNumber;
            // Check if we need a separator (gap in line numbers)
            if (previousLineNumber !== undefined && currentLineNumber !== undefined) {
                // There's a gap if the current line is not consecutive
                if (currentLineNumber > previousLineNumber + 1) {
                    this.renderedLines.push(this.createSeparatorLine());
                    this._lineToHunkIndex.push(-1); // -1 indicates separator
                }
            }
            this.renderedLines.push(this.renderHunk(hunk, lineNumberWidth));
            this._lineToHunkIndex.push(i); // Map to hunk index
            // Update previous line number for gap detection
            if (currentLineNumber !== undefined) {
                previousLineNumber = currentLineNumber;
            }
        }
    }
    getMaxLineNumber() {
        let max = 0;
        for (const hunk of this.diff.hunks) {
            const lineNum = hunk.newLineNumber ?? hunk.oldLineNumber ?? 0;
            max = Math.max(max, lineNum);
        }
        return max;
    }
    renderHunk(hunk, lineNumberWidth) {
        const lineNumber = hunk.newLineNumber ?? hunk.oldLineNumber ?? 0;
        const lineNumStr = lineNumber.toString().padStart(lineNumberWidth, ' ');
        let prefix;
        let gutterColor;
        let content = hunk.content;
        let bgStart = '';
        let bgEnd = '';
        // Apply syntax highlighting to all line types
        if (this.highlightFn) {
            content = this.highlightFn(hunk.content, this.diff.filePath);
        }
        switch (hunk.type) {
            case 'added':
                prefix = '+';
                gutterColor = '\x1b[32m'; // Green prefix
                // Subtle green background (256-color: 22 = dark green)
                bgStart = '\x1b[48;5;22m';
                bgEnd = '\x1b[49m';
                break;
            case 'removed':
                prefix = '-';
                gutterColor = '\x1b[31m'; // Red prefix
                // Subtle red background (256-color: 52 = dark red)
                bgStart = '\x1b[48;5;52m';
                bgEnd = '\x1b[49m';
                break;
            case 'context':
                prefix = ' ';
                gutterColor = '\x1b[2m'; // Dim
                break;
        }
        // Format: [bg][gutter color][line number prefix][reset gutter] [highlighted content][reset]
        const gutter = `${gutterColor}${lineNumStr} ${prefix} \x1b[0m`;
        const fullContent = `${bgStart}${gutter}${bgStart}${content}${bgEnd}\x1b[0m`;
        const rawContent = `${lineNumStr} ${prefix} ${hunk.content}`;
        return {
            content: fullContent,
            rawContent,
        };
    }
    createSeparatorLine() {
        const content = '\x1b[2m···\x1b[0m';
        const rawContent = '···';
        return { content, rawContent };
    }
    truncateToWidth(line, width) {
        // Simple ANSI-aware truncation
        // Count visible characters while preserving ANSI codes
        let visibleLength = 0;
        let result = '';
        let inEscape = false;
        let escapeSequence = '';
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '\x1b') {
                inEscape = true;
                escapeSequence = char;
                continue;
            }
            if (inEscape) {
                escapeSequence += char;
                if (char === 'm') {
                    // End of escape sequence
                    result += escapeSequence;
                    inEscape = false;
                    escapeSequence = '';
                }
                continue;
            }
            // Regular character
            if (visibleLength >= width) {
                break;
            }
            result += char;
            visibleLength++;
        }
        // Make sure we close any open escape sequences
        if (result.includes('\x1b[') && !result.endsWith('\x1b[0m')) {
            result += '\x1b[0m';
        }
        return result;
    }
}
//# sourceMappingURL=inline-view.js.map