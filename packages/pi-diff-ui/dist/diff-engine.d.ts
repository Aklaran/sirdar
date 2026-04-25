export interface DiffLine {
    type: 'added' | 'removed' | 'context';
    content: string;
    oldLineNumber?: number;
    newLineNumber?: number;
}
export interface FileDiff {
    filePath: string;
    isNewFile: boolean;
    hunks: DiffLine[];
    additions: number;
    deletions: number;
}
export declare function computeDiff(filePath: string, original: string, current: string): FileDiff;
//# sourceMappingURL=diff-engine.d.ts.map