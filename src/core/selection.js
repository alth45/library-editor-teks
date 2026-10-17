/**
 * Manajemen seleksi kursor di dalam editor contenteditable.
 * Menjaga range terakhir agar tetap bisa digunakan setelah fokus
 * berpindah ke toolbar/modal, serta mengonversi posisi kursor ke
 * offset karakter (untuk pemulihan seleksi pada undo/redo).
 */
export class SelectionManager {
  /** @param {HTMLElement} root - elemen editor (contenteditable) */
  constructor(root) {
    this.root = root;
    this.savedRange = null;
    this._onChange = () => this._handleSelectionChange();
    document.addEventListener('selectionchange', this._onChange);
  }

  _handleSelectionChange() {
    const sel = window.getSelection();
    if (sel.rangeCount) {
      const r = sel.getRangeAt(0);
      if (this.root.contains(r.commonAncestorContainer)) {
        this.savedRange = r.cloneRange();
        if (this.onSync) this.onSync();
      }
    }
  }

  /** Kembalikan fokus ke editor + pulihkan seleksi terakhir. */
  restore() {
    this.root.focus();
    if (this.savedRange && this.root.contains(this.savedRange.commonAncestorContainer)) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(this.savedRange);
    }
  }

  /** Ambil posisi kursor sebagai offset karakter (untuk riwayat undo). */
  captureOffsets() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    if (!this.root.contains(r.commonAncestorContainer)) return null;
    if (r.startContainer.nodeType !== 3) return null;
    const start = this._caretOffset(r.startContainer, r.startOffset);
    const end = this._caretOffset(r.endContainer, r.endOffset);
    if (start === null || end === null) return null;
    return { start, end };
  }

  _caretOffset(node, offset) {
    let total = 0;
    const walker = document.createTreeWalker(this.root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n === node) return total + Math.min(offset, n.nodeValue.length);
      total += n.nodeValue.length;
    }
    return null;
  }

  /** Pulihkan seleksi dari pasangan offset {start, end}. */
  restoreOffsets({ start, end }) {
    const walker = document.createTreeWalker(this.root, NodeFilter.SHOW_TEXT);
    let pos = 0, n, sN = null, sO = 0, eN = null, eO = 0;
    while ((n = walker.nextNode())) {
      const len = n.nodeValue.length;
      if (!sN && start <= pos + len) { sN = n; sO = start - pos; }
      if (!eN && end <= pos + len) { eN = n; eO = end - pos; }
      pos += len;
    }
    if (!sN || !eN) return;
    const r = document.createRange();
    r.setStart(sN, Math.max(0, Math.min(sO, sN.nodeValue.length)));
    r.setEnd(eN, Math.max(0, Math.min(eO, eN.nodeValue.length)));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }

  /** Tag blok tempat kursor berada saat ini. */
  currentBlockTag() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return 'p';
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === 3) node = node.parentNode;
    while (node && node !== this.root) {
      if (/^(P|H[1-6]|BLOCKQUOTE|PRE)$/.test(node.tagName)) {
        return node.tagName.toLowerCase();
      }
      node = node.parentNode;
    }
    return 'p';
  }

  /** Ukuran font (px) elemen di posisi kursor. */
  currentFontSize() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return 0;
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === 3) node = node.parentNode;
    if (!node || !this.root.contains(node)) return 0;
    return Math.round(parseFloat(getComputedStyle(node).fontSize) || 0);
  }

  destroy() {
    document.removeEventListener('selectionchange', this._onChange);
  }
}

export default SelectionManager;
