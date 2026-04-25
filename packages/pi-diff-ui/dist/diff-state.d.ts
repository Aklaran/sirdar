import { FileDiff } from './diff-engine.js';
export interface FileSnapshot {
    originalContent: string;
    currentContent: string;
}
export interface SerializedDiffState {
    version: 1;
    files: Array<{
        path: string;
        originalContent: string;
        currentContent: string;
    }>;
}
export declare class DiffState {
    private snapshots;
    /**
     * Called when a file is written/edited for the first time
     * originalContent = content before the tool modified it
     * currentContent = content after the tool modified it
     *
     * If the file is already tracked, behaves like updateFile (keeps original, updates current)
     */
    trackFile(filePath: string, originalContent: string, currentContent: string): void;
    /**
     * Called on subsequent modifications to an already-tracked file
     * Updates currentContent but keeps original baseline
     */
    updateFile(filePath: string, currentContent: string): void;
    /**
     * Get the diff for a tracked file
     */
    getFileDiff(filePath: string): FileDiff | undefined;
    /**
     * Get all tracked file paths that have actual changes
     */
    getChangedFiles(): string[];
    /**
     * Dismiss a file: reset baseline to current content, remove from changed list
     * Future edits will diff against this new baseline
     */
    dismissFile(filePath: string): void;
    /**
     * Check if a file is already being tracked
     */
    isTracked(filePath: string): boolean;
    /**
     * Get count of files with pending changes
     */
    get pendingCount(): number;
    /**
     * Serialize the diff state to JSON
     */
    toJSON(): SerializedDiffState;
    /**
     * Restore a DiffState from serialized data
     */
    static fromJSON(data: SerializedDiffState): DiffState;
}
//# sourceMappingURL=diff-state.d.ts.map