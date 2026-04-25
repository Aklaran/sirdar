import { computeDiff } from './diff-engine.js';
export class DiffState {
    snapshots = new Map();
    /**
     * Called when a file is written/edited for the first time
     * originalContent = content before the tool modified it
     * currentContent = content after the tool modified it
     *
     * If the file is already tracked, behaves like updateFile (keeps original, updates current)
     */
    trackFile(filePath, originalContent, currentContent) {
        if (this.snapshots.has(filePath)) {
            // Already tracked - behave like updateFile
            this.updateFile(filePath, currentContent);
        }
        else {
            // New file - store both original and current
            this.snapshots.set(filePath, {
                originalContent,
                currentContent,
            });
        }
    }
    /**
     * Called on subsequent modifications to an already-tracked file
     * Updates currentContent but keeps original baseline
     */
    updateFile(filePath, currentContent) {
        const snapshot = this.snapshots.get(filePath);
        if (snapshot) {
            snapshot.currentContent = currentContent;
        }
        // If not tracked, do nothing (gracefully handle edge case)
    }
    /**
     * Get the diff for a tracked file
     */
    getFileDiff(filePath) {
        const snapshot = this.snapshots.get(filePath);
        if (!snapshot) {
            return undefined;
        }
        return computeDiff(filePath, snapshot.originalContent, snapshot.currentContent);
    }
    /**
     * Get all tracked file paths that have actual changes
     */
    getChangedFiles() {
        const changedFiles = [];
        for (const [filePath, snapshot] of this.snapshots.entries()) {
            if (snapshot.originalContent !== snapshot.currentContent) {
                changedFiles.push(filePath);
            }
        }
        return changedFiles;
    }
    /**
     * Dismiss a file: reset baseline to current content, remove from changed list
     * Future edits will diff against this new baseline
     */
    dismissFile(filePath) {
        const snapshot = this.snapshots.get(filePath);
        if (snapshot) {
            snapshot.originalContent = snapshot.currentContent;
        }
        // If not tracked, do nothing (gracefully handle edge case)
    }
    /**
     * Check if a file is already being tracked
     */
    isTracked(filePath) {
        return this.snapshots.has(filePath);
    }
    /**
     * Get count of files with pending changes
     */
    get pendingCount() {
        return this.getChangedFiles().length;
    }
    /**
     * Serialize the diff state to JSON
     */
    toJSON() {
        const files = [];
        for (const [path, snapshot] of this.snapshots.entries()) {
            files.push({
                path,
                originalContent: snapshot.originalContent,
                currentContent: snapshot.currentContent,
            });
        }
        return {
            version: 1,
            files,
        };
    }
    /**
     * Restore a DiffState from serialized data
     */
    static fromJSON(data) {
        const state = new DiffState();
        for (const file of data.files) {
            state.snapshots.set(file.path, {
                originalContent: file.originalContent,
                currentContent: file.currentContent,
            });
        }
        return state;
    }
}
//# sourceMappingURL=diff-state.js.map