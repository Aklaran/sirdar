// Core
export { computeDiff } from "./diff-engine.js";
export type { DiffLine, FileDiff } from "./diff-engine.js";

// State
export { DiffState } from "./diff-state.js";
export type { FileSnapshot, SerializedDiffState } from "./diff-state.js";

// Views
export { InlineDiffView } from "./inline-view.js";
export type { HighlightFn } from "./inline-view.js";
export { DiffViewController } from "./diff-view-controller.js";

// Modal
export { DiffReviewModal } from "./modal.js";
export type { ModalFileEntry } from "./modal.js";

// Overlay
export { createOverlayHandler } from "./overlay.js";
export type {
  OverlayTui,
  OverlayTheme,
  OverlayKeyUtils,
  HighlightProvider,
  OverlayCallbacks,
  OverlayHandler,
  OverlayOptions,
} from "./overlay.js";

// Picker
export { createPickerHandler } from "./picker.js";
export type { PickerItem, PickerCallbacks } from "./picker.js";

// Constants
export {
  SIDE_BY_SIDE_MIN_WIDTH,
  MAX_WIDGET_FILES,
  DIFF_CONTEXT_LINES,
  OVERLAY_WIDTH_PCT,
  OVERLAY_HEIGHT_PCT,
  ANSI_HIGHLIGHT_BG,
  ANSI_HIGHLIGHT_BG_OFF,
} from "./constants.js";
