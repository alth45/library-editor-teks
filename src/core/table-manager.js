/**
 * TableManager — jembatan antara fungsi murni src/core/table.js dengan DOM
 * contenteditable editor.
 *
 * Alur kerja setiap operasi tabel:
 *   1. Temukan <table> & rentang sel dari posisi kursor/seleksi saat ini.
 *   2. Urai tabel DOM menjadi "rowDefs" → buildGrid() (model data grid).
 *   3. Jalankan operasi struktural memakai fungsi murni (insertRow,
 *      deleteColumn, mergeRect, splitCell, resizeGrid, dst.).
 *   4. Render grid hasil menjadi HTML (gridToHtml) dan ganti tabel lama.
 *   5. Kembalikan kursor ke sel target agar pengguna bisa langsung mengetik.
 *
 * Karena seluruh manipulasi terjadi lewat innerHTML + commit History,
 * undo/redo bawaan editor otomatis mencakup perubahan struktur tabel.
 */
import {
  buildGrid,
  getCellAt,
  insertRow,
  deleteRow,
  insertColumn,
  deleteColumn,
  moveRowUp,
  moveRowDown,
  moveColumnLeft,
  moveColumnRight,
  swapColumns,
  mergeRect,
  splitCell,
  setCellHeader,
  resizeGrid,
  gridToHtml
} from './table.js';

const CELL_SELECTOR = 'td, th';

export class TableManager {
  /**
   * @param {object} deps
   * @param {HTMLElement} deps.editor - elemen contenteditable
   * @param {import('./selection.js').SelectionManager} deps.selection
   * @param {import('./history.js').History} deps.history
   * @param {object} [deps.hooks] - { syncToolbar, updateStats, notify }
   */
  constructor({ editor, selection, history, hooks = {} }) {
    this.editor = editor;
    this.selection = selection;
    this.history = history;
    this.hooks = hooks;
  }

  /* ==================== Penelusuran DOM → model grid ==================== */

  /** Elemen td/th tempat kursor berada (atau null bila bukan dalam tabel). */
  currentCell() {
    const el = this._nodeFromRangeStart();
    const cell = el && el.closest ? el.closest(CELL_SELECTOR) : null;
    return cell && this.editor.contains(cell) ? cell : null;
  }

  /** Tabel tempat kursor berada, atau null. */
  currentTable() {
    const cell = this.currentCell();
    if (!cell) return null;
    const table = cell.closest('table');
    return table && this.editor.contains(table) ? table : null;
  }

  /** true bila ada seleksi multi-sel (drag menyeberangi beberapa td/th). */
  selectionSpansMultipleCells() {
    const cells = this.selectedCells();
    return cells.length > 1;
  }

  /** Semua sel yang tersentuh seleksi Range aktif (untuk merge). */
  selectedCells() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return [];
    const range = sel.getRangeAt(0);
    const out = [];
    this.editor.querySelectorAll(CELL_SELECTOR).forEach(cell => {
      if (range.intersectsNode(cell)) out.push(cell);
    });
    // Bila seleksi collapsed, intersectsNode mungkin kosong → pakai sel kursor
    if (!out.length) {
      const c = this.currentCell();
      if (c) out.push(c);
    }
    return out;
  }

  _nodeFromRangeStart() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === 3) node = node.parentNode;
    return node;
  }

  /**
   * Urai satu <table> DOM menjadi rowDefs untuk buildGrid():
   * [[{colspan,rowspan,header,text}, ...], ...].
   */
  tableToRowDefs(table) {
    const rows = [...table.rows];
    return rows.map(tr =>
      [...tr.cells].map(cell => ({
        colspan: Math.max(1, cell.colSpan || 1),
        rowspan: Math.max(1, cell.rowSpan || 1),
        header: cell.tagName.toLowerCase() === 'th',
        text: cell.innerHTML
      })));
  }

  /** Bangun grid + koordinat (r,c) untuk sel DOM tertentu. */
  gridFromCell(cell) {
    const table = cell.closest('table');
    if (!table) return null;
    const rowDefs = this.tableToRowDefs(table);
    const grid = buildGrid(rowDefs);
    const rc = this.findDomPos(grid, table, cell);
    return { table, rowDefs, grid, r: rc.r, c: rc.c };
  }

  /**
   * Petakan elemen td/th ke koordinat anchor (r,c) pada grid.
   * Algoritma menelusuri baris demi baris: tiap slot grid yang merupakan
   * anchor baru dipasangkan dengan sel DOM berikutnya pada <tr> yang sama
   * (HTMLTableCollection .cells sudah mengecualikan lanjutan span vertikal).
   */
  findDomPos(grid, table, targetCell) {
    for (let r = 0; r < table.rows.length; r++) {
      const tr = table.rows[r];
      let domIdx = 0;
      const row = grid[r] || [];
      let seenAnchor = false;
      for (let c = 0; c < row.length && domIdx < tr.cells.length; c++) {
        const g = getCellAt(grid, r, c);
        if (!g) continue;
        // Hanya slot yang menjadi anchor SEL DOM pada baris ini (g.r === r)
        // dan kolom pertama span-nya (g.c === c) yang dihitung sebagai sel baru.
        if (g.r === r && g.c === c) {
          const cell = tr.cells[domIdx];
          if (cell === targetCell) return { r, c };
          domIdx++;
          seenAnchor = true;
        }
      }
      void seenAnchor;
    }
    return { r: 0, c: 0 };
  }

  /* ============================ Render ============================ */

  /** Ganti tabel lama dengan hasil render grid, lalu pulihkan kursor. */
  _applyGrid(table, grid, focus = { r: 0, c: 0 }) {
    // Sinkronkan teks sel dari DOM sebelum serialisasi (user mungkin mengetik
    // tanpa commit; span juga tidak boleh membawa konten ganda).
    this._syncTextsFromDom(table, grid);
    const html = gridToHtml(grid, { styleAttr: '' });
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const newTable = wrap.firstChild;
    table.replaceWith(newTable);
    this._focusCell(newTable, focus.r, focus.c);
    this._afterChange();
    return newTable;
  }

  /** Salin innerHTML tiap sel DOM ke field `text` pada grid (match by posisi). */
  _syncTextsFromDom(table, grid) {
    for (let r = 0; r < table.rows.length; r++) {
      const tr = table.rows[r];
      let domIdx = 0;
      const row = grid[r] || [];
      for (let c = 0; c < row.length && domIdx < tr.cells.length; c++) {
        const g = getCellAt(grid, r, c);
        if (!g) continue;
        if (g.r === r && g.c === c) {
          const cell = tr.cells[domIdx];
          g.text = cell ? cell.innerHTML : '';
          if (cell) g.header = cell.tagName.toLowerCase() === 'th';
          domIdx++;
        }
      }
    }
  }

  /** Letakkan kursor di dalam sel (r,c) pada tabel baru. */
  _focusCell(table, r, c) {
    const cell = this._domCellAt(table, r, c);
    if (!cell) return;
    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    this.selection.savedRange = range.cloneRange();
    this.editor.focus();
  }

  /** Ambil elemen sel DOM pada koordinat logis (r,c) — mengikuti span. */
  _domCellAt(table, r, c) {
    const rowDefs = this.tableToRowDefs(table);
    const grid = buildGrid(rowDefs);
    const anchor = getCellAt(grid, r, c);
    if (!anchor) return null;
    return this.findDomCell(grid, table, anchor.r, anchor.c);
  }

  /** Elemen td/th yang menjadi anchor koordinat (r,c). */
  findDomCell(grid, table, r, c) {
    const tr = table.rows[r];
    if (!tr || !tr.cells.length) return null;
    let domIdx = 0;
    const row = grid[r] || [];
    for (let cc = 0; cc < row.length && domIdx < tr.cells.length; cc++) {
      const g = getCellAt(grid, r, cc);
      if (!g) continue;
      if (g.r === r && g.c === cc) {
        if (cc === c) return tr.cells[domIdx];
        domIdx++;
      }
    }
    return tr.cells[Math.min(domIdx, tr.cells.length - 1)] || null;
  }

  _afterChange() {
    this.history.commit();
    if (this.hooks.updateStats) this.hooks.updateStats();
    if (this.hooks.syncToolbar) this.hooks.syncToolbar();
  }

  _notify(msg) {
    if (this.hooks.notify) this.hooks.notify(msg);
  }

  /** Helper: ambil konteks tabel dari kursor; false + notifikasi bila tidak ada. */
  _requireTable() {
    const cell = this.currentCell();
    if (!cell) {
      this._notify('Kursor harus berada di dalam tabel.');
      return null;
    }
    return this.gridFromCell(cell);
  }

  /* ========================= Operasi publik ========================= */

  /** Sisipkan tabel baru rows×cols (baris pertama jadi header) di posisi kursor. */
  insertTable(rows = 3, cols = 3, withHeader = true) {
    return this.insertTableWithHeaderRows(rows, cols, withHeader ? 1 : 0);
  }

  /** Varian dengan jumlah baris header bebas (0..rows). */
  insertTableWithHeaderRows(rows = 3, cols = 3, headerRows = 1) {
    rows = Math.max(1, rows | 0);
    cols = Math.max(1, cols | 0);
    headerRows = Math.max(0, Math.min(headerRows | 0, rows));
    // Grid kosong penuh: bangun lewat resizeGrid dari grid 1×1 — sel baru
    // otomatis berisi teks '' sehingga dirender sebagai <td><br></td>.
    const grid = resizeGrid(buildGrid([[{}]]), rows, cols);
    for (let r = 0; r < headerRows; r++) {
      for (let c = 0; c < cols; c++) setCellHeader(grid, r, c, true);
    }
    const html = gridToHtml(grid, { styleAttr: '' });

    this.selection.restore();
    document.execCommand('insertHTML', false, html + '<p><br></p>');
    this._afterChange();
    return true;
  }

  deleteTable() {
    const table = this.currentTable();
    if (!table) { this._notify('Kursor harus berada di dalam tabel.'); return false; }
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    table.replaceWith(p);
    const range = document.createRange();
    range.selectNodeContents(p);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    this.selection.savedRange = range.cloneRange();
    this._afterChange();
    return true;
  }

  insertRowAbove() { return this._insertRowRelative(-1); }
  insertRowBelow() { return this._insertRowRelative(0); }

  _insertRowRelative(offset) {
    const ctx = this._requireTable();
    if (!ctx) return false;
    const idx = Math.max(0, Math.min(ctx.r + offset, ctx.grid.length));
    const grid = insertRow(ctx.grid, idx);
    this._applyGrid(ctx.table, grid, { r: idx, c: ctx.c });
    return true;
  }

  deleteRow() {
    const ctx = this._requireTable();
    if (!ctx) return false;
    if (ctx.grid.length <= 1) { this._notify('Tabel harus punya minimal satu baris — gunakan Hapus Tabel.'); return false; }
    const grid = deleteRow(ctx.grid, ctx.r);
    this._applyGrid(ctx.table, grid, { r: Math.min(ctx.r, grid.length - 1), c: ctx.c });
    return true;
  }

  insertColumnBefore() { return this._insertColRelative(-1); }
  insertColumnAfter() { return this._insertColRelative(0); }

  _insertColRelative(offset) {
    const ctx = this._requireTable();
    if (!ctx) return false;
    const cols = ctx.grid[0] ? ctx.grid[0].length : 1;
    const idx = Math.max(0, Math.min(ctx.c + offset, cols));
    const grid = insertColumn(ctx.grid, idx);
    this._applyGrid(ctx.table, grid, { r: ctx.r, c: idx });
    return true;
  }

  deleteColumn() {
    const ctx = this._requireTable();
    if (!ctx) return false;
    const cols = ctx.grid[0] ? ctx.grid[0].length : 0;
    if (cols <= 1) { this._notify('Tabel harus punya minimal satu kolom — gunakan Hapus Tabel.'); return false; }
    const grid = deleteColumn(ctx.grid, ctx.c);
    this._applyGrid(ctx.table, grid, { r: ctx.r, c: Math.min(ctx.c, (grid[0] || []).length - 1) });
    return true;
  }

  moveRowUp() { return this._shift(moveRowUp, 'r'); }
  moveRowDown() { return this._shift(moveRowDown, 'r'); }
  moveColumnLeft() { return this._shift(moveColumnLeft, 'c'); }
  moveColumnRight() { return this._shift(moveColumnRight, 'c'); }

  _shift(fn, axis) {
    const ctx = this._requireTable();
    if (!ctx) return false;
    const result = fn(ctx.grid, axis === 'r' ? ctx.r : ctx.c);
    if (result === false) { this._notify('Tidak bisa menggeser: menabrak batas atau sel gabungan.'); return false; }
    // Kursor ikut berpindah satu langkah searah pergeseran.
    const focus = axis === 'r'
      ? { r: Math.max(0, Math.min(ctx.r + (fn === moveRowUp ? -1 : 1), result.length - 1)), c: ctx.c }
      : { r: ctx.r, c: Math.max(0, Math.min(ctx.c + (fn === moveColumnLeft ? -1 : 1), (result[0] || []).length - 1)) };
    this._applyGrid(ctx.table, result, focus);
    return true;
  }

  swapFirstLastColumns() {
    const ctx = this._requireTable();
    if (!ctx) return false;
    const cols = ctx.grid[0] ? ctx.grid[0].length : 0;
    if (cols < 2) { this._notify('Butuh minimal dua kolom.'); return false; }
    const result = swapColumns(ctx.grid, 0, cols - 1);
    if (result === false) { this._notify('Penukaran ditolak: ada sel gabungan yang terpotong.'); return false; }
    this._applyGrid(ctx.table, result, { r: ctx.r, c: ctx.c });
    return true;
  }

  /** Gabungkan semua sel yang terseleksi (rentang persegi). */
  mergeCells() {
    const cells = this.selectedCells();
    if (cells.length < 2) { this._notify('Seleksi minimal dua sel untuk menggabungkan.'); return false; }
    const table = cells[0].closest('table');
    if (!table || cells.some(c => c.closest('table') !== table)) {
      this._notify('Sel yang digabung harus berada dalam satu tabel.');
      return false;
    }
    const grid = buildGrid(this.tableToRowDefs(table));
    this._syncTextsFromDom(table, grid);
    // Konversi tiap sel DOM → koordinat grid
    const coords = cells.map(cell => this.findDomPos(grid, table, cell));
    const r1 = Math.min(...coords.map(p => p.r));
    const c1 = Math.min(...coords.map(p => p.c));
    const r2 = Math.max(...coords.map(p => p.r + (getCellAt(grid, p.r, p.c)?.rowspan || 1) - 1));
    const c2 = Math.max(...coords.map(p => p.c + (getCellAt(grid, p.r, p.c)?.colspan || 1) - 1));
    const ok = mergeRect(grid, r1, c1, r2, c2);
    if (!ok) { this._notify('Penggabungan ditolak: rentang menyentuh sel gabungan lain.'); return false; }
    this._applyGrid(table, grid, { r: r1, c: c1 });
    return true;
  }

  splitCell() {
    const ctx = this._requireTable();
    if (!ctx) return false;
    const n = splitCell(ctx.grid, ctx.r, ctx.c);
    if (!n) { this._notify('Sel ini tidak digabung sehingga tidak bisa dipecah.'); return false; }
    this._applyGrid(ctx.table, ctx.grid, { r: ctx.r, c: ctx.c });
    return true;
  }

  /** Toggle tampilan header (th ⇄ td) pada sel kursor. */
  toggleCellHeader() {
    const ctx = this._requireTable();
    if (!ctx) return false;
    const cell = getCellAt(ctx.grid, ctx.r, ctx.c);
    if (!cell) return false;
    setCellHeader(ctx.grid, ctx.r, ctx.c, !cell.header);
    this._applyGrid(ctx.table, ctx.grid, { r: ctx.r, c: ctx.c });
    return true;
  }

  /** Ubah ukuran tabel menjadi rows×cols (konten dipertahankan semaksimal mungkin). */
  resizeTable(rows, cols) {
    const ctx = this._requireTable();
    if (!ctx) return false;
    const result = resizeGrid(ctx.grid, rows, cols);
    this._applyGrid(ctx.table, result, {
      r: Math.min(ctx.r, result.length - 1),
      c: Math.min(ctx.c, (result[0] || []).length - 1)
    });
    return true;
  }

  /** Ringkasan posisi kursor — dipakai toolbar untuk enable/disable tombol tabel. */
  context() {
    const cell = this.currentCell();
    if (!cell) return null;
    const ctx = this.gridFromCell(cell);
    if (!ctx) return null;
    return {
      r: ctx.r,
      c: ctx.c,
      rows: ctx.grid.length,
      cols: ctx.grid[0] ? ctx.grid[0].length : 0,
      header: !!(getCellAt(ctx.grid, ctx.r, ctx.c) || {}).header,
      merged: (() => {
        const g = getCellAt(ctx.grid, ctx.r, ctx.c);
        return !!(g && (g.rowspan > 1 || g.colspan > 1));
      })()
    };
  }
}

export default TableManager;
