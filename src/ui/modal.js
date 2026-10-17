/**
 * Modal input generik berbasis Promise.
 * Elemen DOM dibuat sendiri sehingga tidak bergantung pada HTML host —
 * cukup container (default: document.body).
 */
export class Modal {
  constructor(container = document.body) {
    this.root = document.createElement('div');
    this.root.className = 're-modal';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="re-modal-backdrop" data-close></div>
      <div class="re-modal-box">
        <h3 data-role="title">Judul</h3>
        <div class="re-modal-tabs" data-role="tabs" hidden>
          <button type="button" class="active" data-tab="url">Dari URL</button>
          <button type="button" data-tab="file">Dari Komputer</button>
        </div>
        <div data-role="panel-url">
          <label data-role="label">Label</label>
          <input type="text" data-role="input" />
        </div>
        <div data-role="panel-file" class="re-modal-file" hidden>
          <button type="button" class="re-modal-pick" data-role="pick">Pilih Gambar…</button>
          <span data-role="filename">Belum ada berkas dipilih</span>
        </div>
        <div class="re-modal-actions">
          <button type="button" data-close>Batal</button>
          <button type="button" class="primary" data-role="ok">Sisipkan</button>
        </div>
      </div>`;

    this.titleEl = this.root.querySelector('[data-role="title"]');
    this.tabsEl = this.root.querySelector('[data-role="tabs"]');
    this.tabBtns = [...this.tabsEl.querySelectorAll('[data-tab]')];
    this.panelUrlEl = this.root.querySelector('[data-role="panel-url"]');
    this.panelFileEl = this.root.querySelector('[data-role="panel-file"]');
    this.labelEl = this.root.querySelector('[data-role="label"]');
    this.inputEl = this.root.querySelector('[data-role="input"]');
    this.pickEl = this.root.querySelector('[data-role="pick"]');
    this.filenameEl = this.root.querySelector('[data-role="filename"]');
    this.okEl = this.root.querySelector('[data-role="ok"]');

    this.resolve = null;
    this.mode = 'url';           // 'url' | 'file'
    this.file = null;            // File terpilih pada mode 'file'
    this.onPickFile = null;      // callback dari host: buka dialog & kembalikan File

    this.okEl.addEventListener('click', () => this._submit());
    this.root.querySelectorAll('[data-close]').forEach(el =>
      el.addEventListener('click', () => this.close(null)));
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._submit(); }
      if (e.key === 'Escape') { e.preventDefault(); this.close(null); }
    });
    this.tabBtns.forEach(btn =>
      btn.addEventListener('click', () => this._setMode(btn.dataset.tab)));
    this.pickEl.addEventListener('click', async () => {
      if (!this.onPickFile) return;
      const file = await this.onPickFile();
      if (file) {
        this.file = file;
        this.filenameEl.textContent = `${file.name} (${Math.ceil(file.size / 1024)} KB)`;
      }
    });

    container.appendChild(this.root);
  }

  _setMode(mode) {
    this.mode = mode;
    this.tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === mode));
    this.panelUrlEl.hidden = mode !== 'url';
    this.panelFileEl.hidden = mode !== 'file';
    if (mode === 'url') {
      setTimeout(() => { this.inputEl.focus(); this.inputEl.select(); }, 30);
    } else {
      setTimeout(() => this.pickEl.focus(), 30);
    }
  }

  _submit() {
    if (this.mode === 'file') {
      this.close(this.file ? { kind: 'file', file: this.file } : null);
    } else {
      const url = this.inputEl.value.trim();
      if (url) this.close({ kind: 'url', url });
      else this.close(null);
    }
  }

  /**
   * Tampilkan modal dan tunggu hasilnya.
   * - Tanpa `tabs`: mengembalikan string (nilai input) atau null — perilaku lama.
   * - Dengan `tabs` + `onPickFile`: mengembalikan objek
   *   `{ kind:'url', url }` | `{ kind:'file', file }` atau null.
   * @returns {Promise<string|object|null>}
   */
  ask({ title, label, value = '', placeholder = '', tabs = false, onPickFile = null }) {
    return new Promise(resolve => {
      this.titleEl.textContent = title;
      this.labelEl.textContent = label;
      this.inputEl.value = value;
      this.inputEl.placeholder = placeholder;
      this.tabsEl.hidden = !tabs;
      this.onPickFile = onPickFile;
      this.file = null;
      this.filenameEl.textContent = 'Belum ada berkas dipilih';
      this.mode = 'url';
      if (tabs) {
        this._setMode('url');
      } else {
        // Mode lama: tanpa tab, hanya panel URL (input teks) yang tampil.
        this.panelUrlEl.hidden = false;
        this.panelFileEl.hidden = true;
      }
      this.root.hidden = false;
      this.resolve = resolve;
      setTimeout(() => { this.inputEl.focus(); this.inputEl.select(); }, 30);
    });
  }

  close(result) {
    this.root.hidden = true;
    if (this.resolve) {
      this.resolve(result);
      this.resolve = null;
    }
  }

  destroy() {
    this.close(null);
    this.root.remove();
  }
}

export default Modal;
