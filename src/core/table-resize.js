/**
 * TableResize — fitur geser batas kolom tabel secara dinamis di dalam editor.
 *
 * Masalah yang diatasi: setelah tabel disisipkan ke editor, kursor tidak ikut
 * berpindah dan tabel tidak bisa "digeser-geser" (kolomnya kaku). Modul ini:
 *   1. Menempatkan kursor di sel pertama segera setelah tabel disisipkan
 *      (lihat TableManager.insertTableWithHeaderRows).
 *   2. Menampilkan garis pemisah (handle) vertikal pada setiap batas kolom
 *      saat kursor berada di dalam tabel — handle dapat ditarik bebas untuk
 *      mengubah lebar kolom, atau diklik dua kali untuk auto-fit konten.
 *
 * Mekanisme:
 *   - Overlay absolut di body (meniru pola image-resize.js) diposisikan ulang
 *     mengikuti rect tabel + posisi scroll, dan dirender ulang tiap seleksi
 *     berubah / struktur tabel diedit (MutationObserver).
 *   - Lebar kolom dikunci lewat <colgroup><col style="width:Npx"> sehingga
 *     hasil tarikan benar-benar stabil dan ikut tersimpan dalam HTML.
 */

const CELL_SELECTOR = 'td, th';
const MIN_COL_W = 30;    // px — batas minimum lebar kolom saat drag
const HANDLE_W = 7;      // px — lebar area tangkap handle

export class TableResize {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.editor      - elemen contenteditable
   * @param {Function}    [opts.onCommit]  - dipanggil setelah drag selesai
   *                                         (untuk history.commit / event change)
   */
  constructor({ editor, onCommit }) {
    this.editor = editor;
    this.onCommit = typeof onCommit === 'function' ? onCommit : () => {};

    this.activeTable = null;
    this.dragging = false;

    this._buildOverlay();
    this._bind();
  }

  /* --------------------------- Overlay UI --------------------------- */

  _buildOverlay() {
    const ov = document.createElement('div');
    ov.className = 're-table-resize';
    ov.contentEditable = 'false';
    ov.hidden = true;

    this._frameEl = document.createElement('div');
    this._frameEl.className = 're-table-frame';
    ov.appendChild(this._frameEl);

    this._handlesWrap = document.createElement('div');
    this._handlesWrap.className = 're-table-handles';
    ov.appendChild(this._handlesWrap);

    this._sizeBadge = document.createElement('span');
    this._sizeBadge.className = 're-table-size';
    this._sizeBadge.hidden = true;
    ov.appendChild(this._sizeBadge);

    document.body.appendChild(ov);
    this.overlay = ov;
  }

  /* ----------------------------- Events ----------------------------- */

  _bind() {
    // Klik langsung pada garis batas juga boleh memulai drag.
    this._onEditorDown = (e) => {
      const t = e.target;
      if (t && t.classList && t.classList.contains('re-col-handle')) {
        const idx = parseInt(t.dataset.idx || '', 10);
        const table = t.closest('table');
        if (Number.isInteger(idx) && table) this._startDrag(e, table, idx);
      }
    };
    this.editor.addEventListener('pointerdown', this._onEditorDown);

    // Reposisi overlay saat halaman/editor di-scroll atau di-resize.
    this._onReflow = () => {
      if (this.activeTable && !this.dragging) this._positionOverlay();
    };
    window.addEventListener('scroll', this._onReflow, true);
    window.addEventListener('resize', this._onReflow);

    // Struktur konten berubah (ketikan, operasi tabel via TableManager) →
    // hitung ulang handle; tabel aktif hilang dari DOM → deactivate.
    this._mo = new MutationObserver(() => {
      if (this.dragging) return;
      if (this.activeTable && !this.editor.contains(this.activeTable)) {
        this.deactivate();
        return;
      }
      this.refresh();
    });
    this._mo.observe(this.editor, { childList: true, subtree: true, characterData: true });
  }

  /* --------------------- Deteksi tabel dari kursor ------------------- */

  /** Tabel tempat kursor/seleksi saat ini berada (atau null). */
  tableFromCaret() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === 3) node = node.parentNode;
    if (!node || !node.closest) return null;
    const cell = node.closest(CELL_SELECTOR);
    const table = cell ? cell.closest('table') : (node.closest ? node.closest('table') : null);
    return table && this.editor.contains(table) ? table : null;
  }

  /** Sinkronkan overlay dengan posisi kursor — dipanggil pada selectionchange. */
  refresh() {
    if (this.dragging) return;
    const table = this.tableFromCaret();
    if (table !== this.activeTable) {
      this._clearActiveClass();
      this.activeTable = table;
      if (table) {
        table.classList.add('re-table-active');
        this.overlay.hidden = false;
      } else {
        this.overlay.hidden = true;
      }
    }
    if (this.activeTable) {
      this._buildHandles(this.activeTable);
      this._positionOverlay();
    }
  }

  deactivate() {
    if (this.dragging) return;
    this._clearActiveClass();
    this.activeTable = null;
    this.overlay.hidden = true;
    this._handlesWrap.innerHTML = '';
  }

  _clearActiveClass() {
    if (this.activeTable) this.activeTable.classList.remove('re-table-active');
  }

  /* --------------------------- Bangun handle -------------------------- */

  /** Posisi x (relatif tabel) tiap batas kolom: akhir tiap kolom efektif. */
  _boundaryOffsets(table) {
    const out = [];
    try {
      const rows = [...table.rows];
      const seen = new Set();
      for (const tr of rows) {
        for (const cell of tr.cells) {
          if (seen.has(cell)) continue;
          seen.add(cell);
          const r = cell.getBoundingClientRect();
          out.push(Math.round(r.right - this._tableRect.left));
        }
      }
    } catch (_) { return []; }
    out.sort((a, b) => a - b);
    // Dedup + buang batas paling kanan (tepi luar tabel — bukan antar-kolom)
    const uniq = out.filter((v, i, arr) => i === 0 || v !== arr[i - 1]);
    const width = table.getBoundingClientRect().width;
    return uniq.filter(v => v < width - 4);
  }

  _buildHandles(table) {
    const offs = this._boundaryOffsets(table);
    const wrap = this._handlesWrap;
    // Reuse/render ulang sederhana: selalu rebuild (jumlah kolom kecil).
    wrap.innerHTML = '';
    offs.forEach((x, i) => {
      const h = document.createElement('span');
      h.className = 're-table-handle';
      h.dataset.idx = String(i);
      h.style.top = '0px';
      h.style.height = `${table.getBoundingClientRect().height}px`;
      h.style.left = `${x - HANDLE_W / 2}px`;
      h.title = 'Tarik untuk mengubah lebar kolom · klik ganda untuk pas otomatis';
      h.addEventListener('pointerdown', (e) => this._startDrag(e, table, i));
      h.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.autoFitColumn(table, i);
      });
      wrap.appendChild(h);
    });
  }

  /* ------------------------- Aktivasi manual -------------------------- */

  /** Tampilkan handle untuk tabel tertentu (dipakai setelah sisip tabel). */
  activate(table) {
    if (!table || !this.editor.contains(table)) return;
    if (this.activeTable && this.activeTable !== table) this._clearActiveClass();
    this.activeTable = table;
    table.classList.add('re-table-active');
    this.overlay.hidden = false;
    this._buildHandles(table);
    this._positionOverlay();
  }

  _positionOverlay() {
    if (!this.activeTable) return;
    this._tableRect = this.activeTable.getBoundingClientRect();
    const r = this._tableRect;
    this.overlay.style.left = `${r.left + window.scrollX}px`;
    this.overlay.style.top = `${r.top + window.scrollY}px`;
    this.overlay.style.width = `${r.width}px`;
    this.overlay.style.height = `${r.height}px`;
    // Height handle perlu disegarkan bersama tinggi tabel.
    this._handlesWrap.querySelectorAll('.re-table-handle').forEach(h => {
      h.style.height = `${r.height}px`;
    });
  }

  /* ---------------------------- Drag resize --------------------------- */

  _startDrag(e, table, idx) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    this.activate(table);
    const widths = this._columnWidths(table);
    if (!widths.length || idx >= widths.length) return;

    this._drag = {
      table,
      idx,
      startX: e.clientX,
      startW: Math.max(MIN_COL_W, widths[idx]),
      moved: false
    };
    this.dragging = true;
    this.overlay.classList.add('re-table-resizing');
    try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }

    this._onMove = (ev) => this._onDragMove(ev);
    this._onUp = () => this._onDragEnd();
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
  }

  _onDragMove(e) {
    const d = this._drag;
    if (!d) return;
    d.moved = true;
    const w = Math.max(MIN_COL_W, d.startW + (e.clientX - d.startX));
    d.lastW = Math.round(w);
    this._setColWidth(d.table, d.idx, d.lastW);
    this._positionOverlay();
    this._showSize(d.idx, d.lastW);
  }

  _onDragEnd() {
    const d = this._drag;
    if (!d) return;
    this._drag = null;
    this.dragging = false;

    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);

    this.overlay.classList.remove('re-table-resizing');
    if (d.moved) {
      // Lebar sudah tertulis ke <col>; segarkan posisi handle & simpan riwayat.
      this._buildHandles(d.table);
      this._positionOverlay();
      this.onCommit();
    }
    setTimeout(() => this._hideSize(), 900);
  }

  /* ----------------------- Lebar kolom via colgroup -------------------- */

  /** Ambil semua <col> pada colgroup tabel; buat/isi bila belum ada. */
  _cols(table, ensure = false) {
    let cg = table.querySelector(':scope > colgroup');
    const nCols = this._effectiveColCount(table);
    if (!cg && ensure) {
      cg = document.createElement('colgroup');
      table.insertBefore(cg, table.firstChild);
    }
    if (!cg) return [];
    const cols = [...cg.children].filter(el => el.tagName.toLowerCase() === 'col');
    if (ensure && cols.length < nCols) {
      // Kolom baru (mis. habis insertColumn) — lebar awal mengikuti sel DOM-nya.
      while (cols.length < nCols) {
        const c = document.createElement('col');
        cg.appendChild(c);
        cols.push(c);
      }
      this._syncColsFromDom(table, cols);
    }
    return cols;
  }

  /** Jumlah kolom efektif grid tabel (memperhitungkan colspan). */
  _effectiveColCount(table) {
    let max = 0;
    for (const tr of table.rows) {
      let sum = 0;
      for (const cell of tr.cells) sum += Math.max(1, cell.colSpan || 1);
      max = Math.max(max, sum);
    }
    return max;
  }

  /** Ukur lebar aktual tiap kolom efektif dari sel baris pertama yang muat. */
  _columnWidths(table) {
    const cols = this._cols(table, true);
    if (cols.some(c => c.style && c.style.width)) return cols.map(c => parseFloat(c.style.width) || 0);
    // Belum pernah di-drag → ukur dari DOM, lalu kunci agar stabil.
    this._syncColsFromDom(table, cols);
    return cols.map(c => parseFloat(c.style.width) || 0);
  }

  _syncColsFromDom(table, cols) {
    const widths = this._measureColumns(table);
    cols.forEach((c, i) => {
      const w = widths[i] || MIN_COL_W;
      c.style.width = `${Math.round(w)}px`;
    });
    // contentEditable=false pada colgroup mencegah browser mengedit kolom.
    table.style.tableLayout = 'fixed';
  }

  /** Ukur lebar tiap kolom efektif dengan merata-ratakan tepi kiri sel unik. */
  _measureColumns(table) {
    const total = this._effectiveColCount(table);
    if (!total) return [];
    const lefts = new Array(total).fill(null);
    const rights = new Array(total).fill(null);
    const seen = new Set();
    const base = table.getBoundingClientRect().left;
    for (const tr of table.rows) {
      let c0 = 0;
      for (const cell of tr.cells) {
        if (seen.has(cell)) { c0 += Math.max(1, cell.colSpan || 1); continue; }
        seen.add(cell);
        const cs = Math.max(1, cell.colSpan || 1);
        const r = cell.getBoundingClientRect();
        if (lefts[c0] === null) lefts[c0] = r.left - base;
        const endIdx = Math.min(total - 1, c0 + cs - 1);
        if (rights[endIdx] === null) rights[endIdx] = r.right - base;
        c0 += cs;
      }
    }
    const widths = [];
    let prev = 0;
    for (let i = 0; i < total; i++) {
      const right = rights[i] !== null ? rights[i] : prev + MIN_COL_W;
      widths.push(Math.max(MIN_COL_W, right - prev));
      prev = right;
    }
    return widths;
  }

  _setColWidth(table, idx, px) {
    const cols = this._cols(table, true);
    if (!cols[idx]) return;
    cols[idx].style.width = `${Math.round(px)}px`;
    table.style.tableLayout = 'fixed';
  }

  /** Klik ganda handle: lebarkan kolom secukupnya mengikuti teks terpanjang. */
  autoFitColumn(table, idx) {
    const cols = this._cols(table, true);
    const probe = document.createElement('span');
    probe.className = 're-col-measure';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.whiteSpace = 'nowrap';
    document.body.appendChild(probe);
    let need = MIN_COL_W;
    for (const tr of table.rows) {
      let c0 = 0;
      for (const cell of tr.cells) {
        const cs = Math.max(1, cell.colSpan || 1);
        if (c0 <= idx && idx < c0 + cs && cs === 1) {
          probe.textContent = cell.textContent || '';
          const padL = parseFloat(getComputedStyle(cell).paddingLeft) || 0;
          const padR = parseFloat(getComputedStyle(cell).paddingRight) || 0;
          const border = (parseFloat(getComputedStyle(cell).borderLeftWidth) || 0) +
                         (parseFloat(getComputedStyle(cell).borderRightWidth) || 0);
          need = Math.max(need, Math.ceil(probe.offsetWidth + padL + padR + border + 2));
        }
        c0 += cs;
      }
    }
    probe.remove();
    if (cols[idx]) cols[idx].style.width = `${need}px`;
    table.style.tableLayout = 'fixed';
    this._buildHandles(table);
    this._positionOverlay();
    this._showSize(idx, need);
    setTimeout(() => this._hideSize(), 900);
    this.onCommit();
  }

  /* ----------------------------- Utilitas ----------------------------- */

  _showSize(idx, w) {
    this._sizeBadge.textContent = `Kolom ${idx + 1}: ${w}px`;
    this._sizeBadge.hidden = false;
  }

  _hideSize() {
    if (!this.dragging) this._sizeBadge.hidden = true;
  }

  destroy() {
    this.deactivate();
    this.editor.removeEventListener('pointerdown', this._onEditorDown);
    window.removeEventListener('scroll', this._onReflow, true);
    window.removeEventListener('resize', this._onReflow);
    if (this._mo) this._mo.disconnect();
    this.overlay.remove();
  }
}

export default TableResize;
