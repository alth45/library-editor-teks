import { escapeHtml, escapeAttr } from '../utils/dom.js';

/**
 * Registry perintah editor. Membungkus `document.execCommand()`
 * (API bawaan browser) menjadi operasi-operasi tingkat tinggi:
 * bold, link, gambar, ukuran font, warna, dsb.
 */
export class Commands {
  /**
   * @param {object} deps
   * @param {HTMLElement} deps.editor
   * @param {import('./selection.js').SelectionManager} deps.selection
   * @param {import('./history.js').History} deps.history
   * @param {object} [deps.hooks] - callback UI (syncToolbar, updateStats, askModal, ...)
   */
  constructor({ editor, selection, history, hooks = {} }) {
    this.editor = editor;
    this.selection = selection;
    this.history = history;
    this.hooks = hooks;
    this.lastFontSize = '16px';
  }

  /** Jalankan execCommand dengan seleksi yang sudah dipulihkan. */
  exec(command, value = null) {
    this.selection.restore();
    document.execCommand(command, false, value);
    this.history.commit();
    if (this.hooks.syncToolbar) this.hooks.syncToolbar();
    if (this.hooks.updateStats) this.hooks.updateStats();
  }

  /** Handler utama untuk tombol toolbar. */
  run(action) {
    switch (action) {
      case 'undo':
        if (this.history.undo()) {
          if (this.hooks.syncToolbar) this.hooks.syncToolbar();
          if (this.hooks.updateStats) this.hooks.updateStats();
        }
        break;
      case 'redo':
        if (this.history.redo()) {
          if (this.hooks.syncToolbar) this.hooks.syncToolbar();
          if (this.hooks.updateStats) this.hooks.updateStats();
        }
        break;

      case 'link': this.insertLink(); break;
      case 'image': this.insertImage(); break;
      case 'upload': this.pickImageFile(); break;

      case 'hr': {
        this.selection.restore();
        document.execCommand('insertHorizontalRule');
        this.history.commit();
        break;
      }

      case 'quote': {
        this.selection.restore();
        const isQuote = this.selection.currentBlockTag() === 'blockquote';
        document.execCommand('formatBlock', false, isQuote ? 'p' : 'blockquote');
        this.history.commit();
        if (this.hooks.syncToolbar) this.hooks.syncToolbar();
        break;
      }

      case 'code': {
        this.selection.restore();
        const isPre = this.selection.currentBlockTag() === 'pre';
        document.execCommand('formatBlock', false, isPre ? 'p' : 'pre');
        this.history.commit();
        if (this.hooks.syncToolbar) this.hooks.syncToolbar();
        break;
      }

      case 'clear': {
        this.selection.restore();
        document.execCommand('removeFormat');
        document.execCommand('formatBlock', false, 'p');
        document.execCommand('unlink');
        this.history.commit();
        if (this.hooks.syncToolbar) this.hooks.syncToolbar();
        break;
      }

      case 'source':
        if (this.hooks.toggleSource) this.hooks.toggleSource();
        break;

      default:
        this.exec(action);
    }
  }

  /* --------------------------- Ukuran font --------------------------- */

  setFontSize(px) {
    this.selection.restore();
    this.lastFontSize = px;

    // Trik klasik: execCommand hanya mendukung size 1..7, jadi kita pakai
    // size 7 lalu ganti <font size="7"> menjadi <span style="font-size:..">
    document.execCommand('styleWithCSS', false, false);
    document.execCommand('fontSize', false, '7');
    document.execCommand('styleWithCSS', false, true);

    this.fixFontSizeTags();
    this.history.commit();
  }

  fixFontSizeTags() {
    this.editor.querySelectorAll('font[size="7"]').forEach(node => {
      const span = document.createElement('span');
      span.style.fontSize = this.lastFontSize;
      while (node.firstChild) span.appendChild(node.firstChild);
      node.replaceWith(span);
    });
  }

  /* ----------------------------- Warna ------------------------------ */

  setTextColor(color) {
    this.selection.restore();
    document.execCommand('foreColor', false, color);
    this.history.commit();
  }

  setHighlight(color) {
    this.selection.restore();
    const ok = document.execCommand('hiliteColor', false, color);
    if (!ok) document.execCommand('backColor', false, color);
    this.history.commit();
  }

  /* ----------------------------- Tautan ----------------------------- */

  async insertLink() {
    const url = await this.hooks.askModal({
      title: 'Sisipkan Tautan',
      label: 'URL tujuan',
      value: 'https://',
      placeholder: 'https://contoh.com'
    });
    if (!url) return;

    this.selection.restore();
    const sel = window.getSelection();
    const collapsed = sel.isCollapsed;

    if (collapsed) {
      document.execCommand('insertHTML', false,
        `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`);
    } else {
      document.execCommand('createLink', false, url);
      this.editor.querySelectorAll('a').forEach(a => {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      });
    }
    this.history.commit();
  }

  /* ----------------------------- Gambar ----------------------------- */

  /**
   * Popup "Sisipkan Gambar" dengan dua pilihan:
   * 1. Dari URL    — input alamat gambar.
   * 2. Dari Komputer — pilih berkas gambar lokal (disimpan sebagai base64).
   */
  async insertImage() {
    const result = await this.hooks.askModal({
      title: 'Sisipkan Gambar',
      label: 'URL gambar',
      value: 'https://',
      placeholder: 'https://contoh.com/gambar.jpg',
      tabs: true,
      onPickFile: () => this._openFileDialogAsync()
    });
    if (!result) return;

    if (typeof result === 'string') { // hook askModal versi lama (mengembalikan string)
      this._insertImageAtUrl(result);
    } else if (result.kind === 'file' && result.file) {
      this.insertImageFile(result.file);
    } else if (result.kind === 'url' && result.url) {
      this._insertImageAtUrl(result.url);
    }
  }

  _insertImageAtUrl(url) {
    this.selection.restore();
    document.execCommand('insertHTML', false,
      `<img src="${escapeAttr(url)}" alt="" style="max-width:100%">`);
    this.history.commit();
  }

  /** Buka dialog berkas dan tunggu hasilnya (Promise<File|null>). */
  _openFileDialogAsync() {
    if (!this.hooks.openFileDialog) return Promise.resolve(null);
    if (this.hooks.openFileDialogAsync) return this.hooks.openFileDialogAsync();
    // Fallback: hook lama (fire-and-forget) — RichEdit tetap menyisipkan via change event.
    this.hooks.openFileDialog();
    return Promise.resolve(null);
  }

  pickImageFile() {
    if (this.hooks.openFileDialog) this.hooks.openFileDialog();
  }

  /** Sisipkan file gambar (base64) — dipanggil oleh RichEdit setelah input file. */
  insertImageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.selection.restore();
      document.execCommand('insertHTML', false,
        `<img src="${reader.result}" alt="" style="max-width:100%">`);
      this.history.commit();
    };
    reader.readAsDataURL(file);
  }
}

export default Commands;
