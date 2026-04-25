import type { OverlayTui, OverlayTheme, OverlayKeyUtils, OverlayHandler } from "./overlay.js";
/**
 * A selectable item in the picker list.
 */
export interface PickerItem {
    id: string;
    label: string;
    description?: string;
    meta?: string;
}
/**
 * Callbacks for picker user interactions.
 */
export interface PickerCallbacks {
    onSelect: (item: PickerItem) => void;
    onCancel: () => void;
    /** Called when user presses 'd' to dismiss an item. Return true if the item was removed. */
    onDismiss?: (item: PickerItem) => boolean;
}
/**
 * Configuration options for the picker overlay.
 */
export interface PickerOptions {
    title?: string;
}
export declare function createPickerHandler(items: PickerItem[], tui: OverlayTui, theme: OverlayTheme, keyUtils: OverlayKeyUtils, callbacks: PickerCallbacks, options?: PickerOptions): OverlayHandler;
//# sourceMappingURL=picker.d.ts.map