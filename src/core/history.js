import { debounce } from '../utils/dom.js';

/**
 * Riwayat undo/redo buatan sendiri.
 * Menyimpan snapshot { html, sel } — posisi kursor ikut dipulihkan.
 */
export class History {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.editor - elemen contenteditable
   * @param {import('./selection.js').SelectionManager} opts.selection
   * @param {number} [opts.limit=120] - maksimum snapshot
   * @param {Function} [opts.onUpdate] - dipanggil saat indeks/history berubah
   */
  constructor({ editor, selection, limit = 120, onUpdate = () => {} }) {
    this.editor = editor;
    this.selection = selection;
    this.limit = limit;
    this.onUpdate = onUpdate;
    this.list = [];
    this.idx = -1;
    this.locked = false;

    this.commitDebounced = debounce(() => this.commit(), 450);
  }

  commit() {
    if (this.locked) return;
    const html = this.editor.innerHTML;
    const current = this.list[this.idx];
    if (current && current.html === html) return;

    this.list = this.list.slice(0, this.idx + 1);
    this.list.push({ html, sel: this.selection.captureOffsets() });
    if (this.list.length > this.limit) this.list.shift();
    this.idx = this.list.length - 1;
    this.onUpdate();
  }

  applySnapshot(snap) {
    this.locked = true;
    this.editor.innerHTML = snap.html;
    if (snap.sel) {
      try { this.selection.restoreOffsets(snap.sel); } catch (e) { /* abaikan */ }
    }
    this.locked = false;
    this.onUpdate();
  }

  canUndo() { return this.idx > 0; }
  canRedo() { return this.idx < this.list.length - 1; }

  undo() {
    if (!this.canUndo()) return false;
    this.idx--;
    this.applySnapshot(this.list[this.idx]);
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    this.idx++;
    this.applySnapshot(this.list[this.idx]);
    return true;
  }
}

export default History;
