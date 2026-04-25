/** Re-export core types for convenience */
export type { DiffLine, FileDiff } from './diff-engine.js';
export type { FileSnapshot } from './diff-state.js';
export type { ModalFileEntry } from './modal.js';
export type { HighlightFn } from './inline-view.js';

/** Mode the diff review modal is currently in */
export type ModalMode = 'diff' | 'filePicker' | 'visual';

/** Direction for cursor movement */
export type CursorDirection = 'up' | 'down';
