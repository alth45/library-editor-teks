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
        <div data-role="panel-picker" class="re-modal-picker" hidden>
          <div class="re-picker-grid" data-role="pickerGrid"></div>
          <div class="re-picker-info"><span data-role="pickerSize">3 × 3</span></div>
          <label class="re-picker-header">
            Baris header:
            <select data-role="pickerHeader">
              <option value="0">0</option>
              <option value="1" selected>1</option>
              <option value="2">2</option>
            </select>
          </label>
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
    this.panelPickerEl = this.root.querySelector('[data-role="panel-picker"]');
    this.pickerGridEl = this.root.querySelector('[data-role="pickerGrid"]');
    this.pickerSizeEl = this.root.querySelector('[data-role="pickerSize"]');
    this.pickerHeaderEl = this.root.querySelector('[data-role="pickerHeader"]');
    this.labelEl = this.root.querySelector('[data-role="label"]');
    this.inputEl = this.root.querySelector('[data-role="input"]');
    this.pickEl = this.root.querySelector('[data-role="pick"]');
    this.filenameEl = this.root.querySelector('[data-role="filename"]');
    this.okEl = this.root.querySelector('[data-role="ok"]');

    this.resolve = null;
    this.mode = 'url';           // 'url' | 'file' | 'picker'
    this.file = null;            // File terpilih pada mode 'file'
    this.onPickFile = null;      // callback dari host: buka dialog & kembalikan File
    this.pickerRows = 8;         // dimensi grid picker maksimum
    this.pickerCols = 10;
    this.pickR = 3;              // ukuran tersorot saat ini
    this.pickC = 3;

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
    // Interaksi grid picker tabel: hover menyorot rentang, klik memilih.
    this.pickerGridEl.addEventListener('mousemove', (e) => {
      const cell = e.target.closest('[data-r]');
      if (cell) this._highlightPicker(+cell.dataset.r, +cell.dataset.c);
    });
    this.pickerGridEl.addEventListener('mouseleave', () =>
      this._highlightPicker(this.pickR, this.pickC));
    this.pickerGridEl.addEventListener('click', (e) => {
      const cell = e.target.closest('[data-r]');
      if (!cell) return;
      this._highlightPicker(+cell.dataset.r, +cell.dataset.c);
      this._submit();
    });

    container.appendChild(this.root);
  }

  /** Bangun ulang grid DOM picker (rows×cols kotak kecil). */
  _buildPicker(maxRows, maxCols) {
    this.pickerRows = Math.max(1, maxRows | 0);
    this.pickerCols = Math.max(1, maxCols | 0);
    let html = '';
    for (let r = 1; r <= this.pickerRows; r++) {
      for (let c = 1; c <= this.pickerCols; c++) {
        html += `<span class="pk-cell" data-r="${r}" data-c="${c}"></span>`;
      }
    }
    this.pickerGridEl.innerHTML = html;
    this.pickerGridEl.style.setProperty('--pk-cols', this.pickerCols);
    this._highlightPicker(Math.min(3, this.pickerRows), Math.min(3, this.pickerCols));
  }

  _highlightPicker(r, c) {
    this.pickR = r;
    this.pickC = c;
    this.pickerSizeEl.textContent = `${r} × ${c}`;
    this.pickerGridEl.querySelectorAll('.pk-cell').forEach(cell => {
      cell.classList.toggle('on', +cell.dataset.r <= r && +cell.dataset.c <= c);
    });
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
    if (this.mode === 'picker') {
      this.close({
        kind: 'table',
        rows: this.pickR,
        cols: this.pickC,
        headerRows: parseInt(this.pickerHeaderEl.value, 10) || 0
      });
    } else if (this.mode === 'file') {
      this.close(this.file ? { kind: 'file', file: this.file } : null);
    } else {
      const url = this.inputEl.value.trim();
      if (url) this.close({ kind: 'url', url });
      else this.close(null);
    }
  }

  /**
   * Tampilkan modal dan tunggu hasilnya.
   * - Tanpa `tabs`/`tablePicker`: mengembalikan string (nilai input) atau null — perilaku lama.
   * - Dengan `tabs` + `onPickFile`: mengembalikan objek
   *   `{ kind:'url', url }` | `{ kind:'file', file }` atau null.
   * - Dengan `tablePicker`: mengembalikan `{ kind:'table', rows, cols, headerRows }` atau null.
   * @returns {Promise<string|object|null>}
   */
  ask({ title, label, value = '', placeholder = '', tabs = false, onPickFile = null,
        tablePicker = false, pickRows = 8, pickCols = 10, okText = 'Sisipkan' }) {
    return new Promise(resolve => {
      this.titleEl.textContent = title;
      this.labelEl.textContent = label;
      this.inputEl.value = value;
      this.inputEl.placeholder = placeholder;
      this.tabsEl.hidden = !tabs;
      this.okEl.textContent = okText;
      // Panel "Dari Komputer" (input gambar) hanya boleh ada di modal dengan tab.
      this.pickEl.style.display = tabs ? '' : 'none';
      this.onPickFile = onPickFile;
      this.file = null;
      this.filenameEl.textContent = 'Belum ada berkas dipilih';
      this.mode = 'url';
      if (tablePicker) {
        this.mode = 'picker';
        this.panelUrlEl.hidden = true;
        this.panelFileEl.hidden = true;
        this.panelPickerEl.hidden = false;
        this._buildPicker(pickRows, pickCols);
      } else if (tabs) {
        this.panelPickerEl.hidden = true;
        this._setMode('url');
      } else {
        // Mode lama: tanpa tab, hanya panel URL (input teks) yang tampil.
        this.panelPickerEl.hidden = true;
        this.panelUrlEl.hidden = false;
        this.panelFileEl.hidden = true;
      }
      this.root.hidden = false;
      this.resolve = resolve;
      if (this.mode !== 'picker') {
        setTimeout(() => { this.inputEl.focus(); this.inputEl.select(); }, 30);
      }
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
