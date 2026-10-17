import { ICONS } from '../core/icons.js';

const STATE_CMDS = [
  'bold', 'italic', 'underline', 'strikeThrough',
  'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull',
  'insertUnorderedList', 'insertOrderedList'
];

/**
 * Toolbar RichEdit — dibangun dari konfigurasi (lihat core/default-toolbar.js).
 * Bertanggung jawab atas pembuatan elemen, sinkronisasi state, dan
 * meneruskan event ke callback yang diberikan.
 */
export class Toolbar {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.container - elemen penampung toolbar
   * @param {Array} opts.config - konfigurasi grup/item toolbar
   * @param {Function} opts.onAction - (act) => void untuk tombol
   * @param {Function} opts.onChange - (id, value, item) => void untuk select/color
   */
  constructor({ container, config, onAction, onChange }) {
    this.container = container;
    this.config = config;
    this.onAction = onAction;
    this.onChange = onChange;
    this.build();
    this.bindEvents();
  }

  build() {
    this.config.forEach(group => {
      const g = document.createElement('div');
      g.className = 'group';

      group.items.forEach(item => {
        if (item.t === 'btn') g.appendChild(this._button(item));
        else if (item.t === 'select') g.appendChild(this._select(item));
        else if (item.t === 'color') g.appendChild(this._color(item));
      });

      this.container.appendChild(g);
    });
  }

  _button(item) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tb-btn';
    b.dataset.act = item.act;
    b.title = item.title;
    b.innerHTML = ICONS[item.icon] || item.act;
    return b;
  }

  _select(item) {
    const s = document.createElement('select');
    s.className = 'tb-select';
    s.id = item.id;
    s.title = item.title;
    item.options.forEach(([value, label]) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      s.appendChild(o);
    });
    return s;
  }

  _color(item) {
    const label = document.createElement('label');
    label.className = 'tb-color';
    label.title = item.title;
    const span = document.createElement('span');
    span.className = 'swatch';
    span.textContent = item.icon;
    span.style.setProperty('--c', item.value);
    if (item.hl) span.style.background = item.value;
    const input = document.createElement('input');
    input.type = 'color';
    input.id = item.id;
    input.value = item.value;
    label.appendChild(span);
    label.appendChild(input);
    return label;
  }

  bindEvents() {
    // Cegah kehilangan seleksi saat tombol diklik
    this.container.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) e.preventDefault();
    });

    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn || btn.disabled) return;
      this.onAction(btn.dataset.act);
    });

    this.container.addEventListener('change', (e) => {
      this.onChange(e.target.id, e.target.value, e.target);
    });
  }

  setDisabled(disabled) {
    this.container.classList.toggle('disabled', disabled);
  }

  /** Sinkronkan state tombol/select dengan posisi kursor saat ini. */
  sync(selection) {
    // Status tombol inline
    STATE_CMDS.forEach(cmd => {
      const btn = this.container.querySelector(`[data-act="${cmd}"]`);
      if (!btn) return;
      let on = false;
      try { on = document.queryCommandState(cmd); } catch (e) { /* noop */ }
      btn.classList.toggle('active', on);
    });

    // Format blok
    const tag = selection.currentBlockTag();
    const blockSel = document.getElementById('blockSelect');
    if (blockSel) {
      const found = [...blockSel.options].some(o => o.value === tag);
      blockSel.value = found ? tag : 'p';
    }

    // Font & ukuran
    const fontSel = document.getElementById('fontSelect');
    const sizeSel = document.getElementById('sizeSelect');
    try {
      const font = document.queryCommandValue('fontName');
      if (fontSel && font) {
        const match = [...fontSel.options].find(
          o => o.value && o.value.split(',')[0].replace(/"/g, '') === font.replace(/"/g, ''));
        if (match) fontSel.value = match.value;
      }
    } catch (e) { /* noop */ }

    if (sizeSel) {
      const px = selection.currentFontSize();
      const match = [...sizeSel.options].find(o => o.value && parseFloat(o.value) === px);
      sizeSel.value = match ? match.value : '';
    }
  }

  updateHistoryButtons(history) {
    const u = this.container.querySelector('[data-act="undo"]');
    const r = this.container.querySelector('[data-act="redo"]');
    if (u) u.disabled = !history.canUndo();
    if (r) r.disabled = !history.canRedo();
  }

  setActive(act, active) {
    const btn = this.container.querySelector(`[data-act="${act}"]`);
    if (btn) btn.classList.toggle('active', active);
  }
}

export default Toolbar;
