import { DEFAULT_TOOLBAR } from '../core/default-toolbar.js';
import SelectionManager from '../core/selection.js';
import History from '../core/history.js';
import Commands from '../core/commands.js';
import Autosave from '../core/autosave.js';
import { sanitizeHTML } from '../core/sanitize.js';
import Toolbar from '../ui/toolbar.js';
import Modal from '../ui/modal.js';
import Statusbar from '../ui/statusbar.js';

const DEFAULT_HTML = `
<h1>Selamat datang di RichEdit ✎</h1>
<p>Ini adalah <b>rich text editor</b> yang dibangun <i>100% dengan JavaScript murni</i> —
tanpa library seperti Quill, TinyMCE, atau CKEditor.</p>
<p>Blok teks ini lalu tekan <b>Ctrl+B</b>, <b>Ctrl+I</b>, atau <b>Ctrl+U</b>.</p>
<blockquote>Semua tombol toolbar ditulis manual. Setiap perintah mengeksekusi API DOM,
lalu state-nya disinkronkan kembali dengan posisi kursor.</blockquote>
<h2>Fitur</h2>
<ul>
  <li>Format teks: tebal, miring, garis bawah, coret</li>
  <li>Heading, kutipan, blok kode, garis pemisah</li>
  <li>Warna teks &amp; warna sorotan</li>
  <li>Daftar berbutir dan bernomor, indentasi</li>
  <li>Tautan, gambar dari URL, unggah gambar</li>
  <li>Undo/redo dengan riwayat buatan sendiri</li>
  <li>Mode sumber HTML, autosave, tema gelap</li>
</ul>
<p>Selamat mencoba! 🎉</p>
`;

/**
 * RichEdit — editor rich text murni JavaScript.
 *
 * @example
 * const editor = new RichEdit({ element: '#app .surface' });
 * editor.on('change', ({ html }) => console.log(html));
 */
export class RichEdit {
  /**
   * @param {object} options
   * @param {string|HTMLElement} [options.element=document.body] - penampung editor
   * @param {Array} [options.toolbar=DEFAULT_TOOLBAR] - konfigurasi toolbar
   * @param {boolean} [options.autosave=true]
   * @param {string} [options.storageKey='richedit:content:v1']
   * @param {Storage|null} [options.storage=localStorage]
   * @param {number} [options.historyLimit=120]
   * @param {string} [options.initialHtml=DEFAULT_HTML] - konten awal (bila tidak ada tersimpan)
   * @param {boolean} [options.loadSaved=true] - muat konten tersimpan saat init
   * @param {boolean} [options.sanitizePaste=true]
   */
  constructor(options = {}) {
    this.options = Object.assign({
      element: document.body,
      toolbar: DEFAULT_TOOLBAR,
      autosave: true,
      storageKey: 'richedit:content:v1',
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      historyLimit: 120,
      initialHtml: DEFAULT_HTML,
      loadSaved: true,
      sanitizePaste: true
    }, options);

    this._listeners = {};
    this.sourceMode = false;

    this._buildDom();
    this._initModules();
    this._bindEvents();
    this._configureExecCommand();
    this._loadContent();

    this.history.commit();
    this.statusbar.update();
    this.toolbar.sync(this.selection);
    this.toolbar.updateHistoryButtons(this.history);

    setTimeout(() => this.editor.focus(), 100);
  }

  /* ============================= DOM ============================= */

  _buildDom() {
    const host = typeof this.options.element === 'string'
      ? document.querySelector(this.options.element)
      : this.options.element;
    if (!host) throw new Error('RichEdit: elemen target tidak ditemukan');
    this.host = host;

    host.classList.add('re-surface');

    this.editor = document.createElement('div');
    this.editor.className = 're-editor';
    this.editor.contentEditable = 'true';
    this.editor.spellcheck = true;

    this.sourceEl = document.createElement('textarea');
    this.sourceEl.className = 're-source';
    this.sourceEl.spellcheck = false;
    this.sourceEl.hidden = true;

    this.toolbarEl = document.createElement('div');
    this.toolbarEl.className = 're-toolbar';

    // Toolbar diletakkan sebelum surface bila host belum punya
    host.parentNode.insertBefore(this.toolbarEl, host);

    host.appendChild(this.editor);
    host.appendChild(this.sourceEl);

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'image/*';
    this.fileInput.hidden = true;
    host.appendChild(this.fileInput);
  }

  /* =========================== Modules =========================== */

  _initModules() {
    this.selection = new SelectionManager(this.editor);

    this.history = new History({
      editor: this.editor,
      selection: this.selection,
      limit: this.options.historyLimit,
      onUpdate: () => {
        this.toolbar.updateHistoryButtons(this.history);
        this.toolbar.sync(this.selection);
        this.statusbar.update();
      }
    });

    this.modal = new Modal(document.body);

    this.commands = new Commands({
      editor: this.editor,
      selection: this.selection,
      history: this.history,
      hooks: {
        syncToolbar: () => this.toolbar.sync(this.selection),
        updateStats: () => this.statusbar.update(),
        askModal: (opts) => this.modal.ask(opts),
        openFileDialog: () => this.fileInput.click(),
        toggleSource: () => this.toggleSource()
      }
    });

    this.toolbar = new Toolbar({
      container: this.toolbarEl,
      config: this.options.toolbar,
      onAction: (act) => this.commands.run(act),
      onChange: (id, value, el) => this._onToolbarChange(id, value, el)
    });

    this.autosaveInstance = this.options.autosave
      ? new Autosave({
          getContent: () => this.getHTML(),
          key: this.options.storageKey,
          storage: this.options.storage,
          onSaved: () => this._emit('saved', { html: this.getHTML() })
        })
      : null;

    // Statusbar opsional: pakai elemen host berikutnya jika ada,
    // atau fallback ke objek tanpa-elemen (update no-op).
    this.statusbar = new Statusbar({
      container: this.options.statusbar || null,
      getText: () => this.editor.innerText || ''
    });

    this.selection.onSync = () => {
      this.toolbar.sync(this.selection);
    };
  }

  /* ============================ Events ============================ */

  _bindEvents() {
    this.editor.addEventListener('input', () => {
      this.commands.fixFontSizeTags();
      this.statusbar.update();
      this.history.commitDebounced();
      if (this.autosaveInstance) this.autosaveInstance.saveDebounced();
      this._emit('change', { html: this.getHTML() });
    });

    this.editor.addEventListener('keydown', (e) => this._onKeydown(e));

    this.editor.addEventListener('paste', (e) => {
      e.preventDefault();
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');

      if (html && !e.shiftKey) {
        const clean = this.options.sanitizePaste ? sanitizeHTML(html) : html;
        document.execCommand('insertHTML', false, clean);
      } else {
        document.execCommand('insertText', false, text);
      }
      this.history.commit();
      this.statusbar.update();
    });

    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files && this.fileInput.files[0];
      if (file) this.commands.insertImageFile(file);
      this.fileInput.value = '';
    });
  }

  _onKeydown(e) {
    const mod = e.ctrlKey || e.metaKey;

    // Shortcut manual (supaya toolbar tetap sinkron)
    if (mod) {
      const map = { b: 'bold', i: 'italic', u: 'underline' };
      const key = e.key.toLowerCase();
      if (map[key]) {
        e.preventDefault();
        this.commands.exec(map[key]);
        return;
      }
      if (key === 'k') { e.preventDefault(); this.commands.insertLink(); return; }
      if (key === 'z') {
        e.preventDefault();
        e.shiftKey ? this.commands.run('redo') : this.commands.run('undo');
        return;
      }
      if (key === 'y') { e.preventDefault(); this.commands.run('redo'); return; }
    }

    // Tab = 4 spasi
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '    ');
      this.history.commit();
    }
  }

  _onToolbarChange(id, value, el) {
    if (id === 'blockSelect') {
      this.selection.restore();
      document.execCommand('formatBlock', false, value);
      this.history.commit();
      this.toolbar.sync(this.selection);
    }

    if (id === 'fontSelect' && value) {
      this.selection.restore();
      document.execCommand('fontName', false, value);
      this.history.commit();
      this.toolbar.sync(this.selection);
    }

    if (id === 'sizeSelect' && value) {
      this.commands.setFontSize(value);
      this.toolbar.sync(this.selection);
    }

    if (id === 'colorText') {
      this.commands.setTextColor(value);
      el.previousElementSibling.style.setProperty('--c', value);
    }

    if (id === 'colorHighlight') {
      this.commands.setHighlight(value);
      el.previousElementSibling.style.background = value;
    }
  }

  _configureExecCommand() {
    try {
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch (e) { /* noop */ }
  }

  _loadContent() {
    let saved = null;
    if (this.options.loadSaved && this.autosaveInstance) {
      saved = this.autosaveInstance.load();
    }
    this.editor.innerHTML = saved !== null ? saved : this.options.initialHtml;
  }

  /* ========================= Mode Sumber ========================= */

  toggleSource() {
    this.sourceMode = !this.sourceMode;

    if (this.sourceMode) {
      this.sourceEl.value = this.editor.innerHTML;
      this.editor.hidden = true;
      this.sourceEl.hidden = false;
      this.sourceEl.focus();
      this.toolbar.setDisabled(true);
    } else {
      this.editor.innerHTML = this.sourceEl.value;
      this.sourceEl.hidden = true;
      this.editor.hidden = false;
      this.toolbar.setDisabled(false);
      this.editor.focus();
      this.history.commit();
      this.statusbar.update();
    }
    this.toolbar.setActive('source', this.sourceMode);
    this._emit('sourceToggle', { active: this.sourceMode });
  }

  /* ========================== Public API ========================== */

  getHTML() { return this.editor.innerHTML; }

  setHTML(html) {
    this.editor.innerHTML = this.options.sanitizePaste ? sanitizeHTML(html) : html;
    this.history.commit();
    this.statusbar.update();
  }

  getText() { return this.editor.innerText || ''; }

  undo() { this.commands.run('undo'); }
  redo() { this.commands.run('redo'); }

  exec(command, value = null) { this.commands.exec(command, value); }

  save() { if (this.autosaveInstance) this.autosaveInstance.saveNow(); }

  on(event, fn) {
    (this._listeners[event] = this._listeners[event] || []).push(fn);
    return this;
  }

  off(event, fn) {
    const list = this._listeners[event] || [];
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
    return this;
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }

  destroy() {
    this.selection.destroy();
    this.modal.destroy();
    this.editor.remove();
    this.sourceEl.remove();
    this.toolbarEl.remove();
    this.fileInput.remove();
    this._listeners = {};
  }
}

export default RichEdit;
