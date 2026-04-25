import { DiffState } from './diff-state.js';
import { FileDiff } from './diff-engine.js';
export interface ModalFileEntry {
    path: string;
    additions: number;
    deletions: number;
    isNewFile: boolean;
}
export declare class DiffReviewModal {
    private diffState;
    private _selectedIndex;
    private _fileList;
    private _filePickerOpen;
    private _filePickerIndex;
    constructor(diffState: DiffState);
    /**
     * Get the list of files with changes for display
     */
    getFileList(): ModalFileEntry[];
    /**
     * Get currently selected index
     */
    get selectedIndex(): number;
    /**
     * Get currently selected file path
     */
    get selectedFile(): string | undefined;
    /**
     * Select next file (wraps around)
     */
    selectNext(): void;
    /**
     * Select previous file (wraps around)
     */
    selectPrevious(): void;
    /**
     * Select file at specific index (clamped to valid range)
     */
    selectIndex(index: number): void;
    /**
     * Get diff for currently selected file
     */
    getSelectedDiff(): FileDiff | undefined;
    /**
     * Dismiss the currently selected file
     * Returns false if nothing selected
     */
    dismissSelected(): boolean;
    /**
     * Get the path of the currently selected file
     */
    getSelectedPath(): string | undefined;
    /**
     * Refresh file list from DiffState (call after state changes)
     */
    refresh(): void;
    /**
     * Check if file picker is open
     */
    get isFilePickerOpen(): boolean;
    /**
     * Get current file picker index
     */
    get filePickerIndex(): number;
    /**
     * Open the file picker
     */
    openFilePicker(): void;
    /**
     * Close the file picker
     */
    closeFilePicker(): void;
    /**
     * Navigate to next file in picker
     */
    filePickerNext(): void;
    /**
     * Navigate to previous file in picker
     */
    filePickerPrevious(): void;
    /**
     * Confirm file picker selection (jump to selected file and close picker)
     */
    confirmFilePickerSelection(): void;
}
//# sourceMappingURL=modal.d.ts.map