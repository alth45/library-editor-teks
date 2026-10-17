/**
 * RichEdit — entry point library.
 * Ekspor kelas utama plus modul internal untuk pemakaian tingkat lanjut.
 */
import './styles/theme.css'; // diekstrak Vite menjadi dist/richedit.css saat build

export { RichEdit, default as Editor } from './editor/rich-edit.js';

// Inti
export { ICONS } from './core/icons.js';
export { DEFAULT_TOOLBAR } from './core/default-toolbar.js';
export { SelectionManager } from './core/selection.js';
export { History } from './core/history.js';
export { Commands } from './core/commands.js';
export { Autosave } from './core/autosave.js';
export { sanitizeHTML, ALLOWED_TAGS, ALLOWED_ATTRS, ALLOWED_STYLES } from './core/sanitize.js';

// UI
export { Toolbar } from './ui/toolbar.js';
export { Modal } from './ui/modal.js';
export { Statusbar } from './ui/statusbar.js';

// Utilitas
export { escapeHtml, escapeAttr, debounce } from './utils/dom.js';
