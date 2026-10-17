/**
 * Utilitas tabel murni (tanpa DOM browser) untuk modul TableManager.
 * Model data: grid sel logis — setiap sel punya koordinat anchor {r,c},
 * colspan, dan rowspan. Sel yang tertutup oleh span tetangga bernilai null.
 * Fungsi-fungsi di sini berupa "pure functions" sehingga dapat diuji
 * dengan Node.js tanpa jsdom (lihat test/unit.test.mjs).
 */

/** Buat grid kosong rows×cols berisi null. */
export function createEmptyGrid(rows, cols) {
  const g = [];
  for (let r = 0; r < rows; r++) g.push(new Array(cols).fill(null));
  return g;
}

/** Bangun grid dari daftar baris HTML: [[{colspan,rowspan}, ...], ...]. */
export function buildGrid(rowDefs) {
  const widths = rowDefs.map(row =>
    row.reduce((s, c) => s + (c.colspan || 1), 0));
  const cols = Math.max(1, ...widths);
  const grid = createEmptyGrid(rowDefs.length, cols);

  rowDefs.forEach((row, r) => {
    let c = 0;
    for (const cell of row) {
      while (c < cols && grid[r][c]) c++; // lewati slot yang sudah terisi span
      if (c >= cols) break;                // baris cacat → sel ekstra dibuang
      const rs = Math.max(1, cell.rowspan || 1);
      const cs = Math.max(1, cell.colspan || 1);
      place(grid, r, c, { r, c, rowspan: rs, colspan: cs, header: !!cell.header });
      c += cs;
    }
  });
  return grid;
}

/** Tulis sel pada (r,c) + isi seluruh area span-nya; kembalikan false bila menabrak. */
export function place(grid, r, c, cell) {
  for (let i = r; i < r + cell.rowspan; i++) {
    for (let j = c; j < c + cell.colspan; j++) {
      if (i >= grid.length || j >= (grid[0] ? grid[0].length : 0)) return false;
      if (grid[i][j]) return false;
    }
  }
  const anchor = { ref: cell };
  for (let i = r; i < r + cell.rowspan; i++) {
    for (let j = c; j < c + cell.colspan; j++) grid[i][j] = anchor;
  }
  return true;
}

/** Ambil objek sel pada (r,c) — mengikuti span ke kiri/atas. Null jika tak ada. */
export function getCellAt(grid, r, c) {
  if (r < 0 || c < 0 || r >= grid.length || !grid[0] || c >= grid[0].length) return null;
  const a = grid[r][c];
  return a ? a.ref : null;
}

/** Cari koordinat anchor sel dari referensi objeknya. */
export function findCell(grid, ref) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r] ? grid[r].length : 0); c++) {
      const a = grid[r][c];
      if (a && a.ref === ref) return { r, c };
    }
  }
  return null;
}

/** Jumlah kolom efektif grid. */
export function gridCols(grid) {
  return grid && grid[0] ? grid[0].length : 0;
}

/** Ratakan grid menjadi matriks persegi panjang penuh (null → sel kosong baru). */
export function normalize(grid) {
  const cols = gridCols(grid);
  return grid.map(row => {
    const out = row.slice();
    while (out.length < cols) out.push(null);
    return out;
  });
}

/** Ubah ukuran grid menjadi rows×cols dengan mempertahankan konten & span sewajarnya. */
export function resizeGrid(grid, rows, cols) {
  rows = Math.max(1, rows | 0);
  cols = Math.max(1, cols | 0);
  const refs = new Map();
  const cells = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r] ? grid[r].length : 0); c++) {
      const a = grid[r][c];
      if (!a) continue;
      if (!refs.has(a.ref)) {
        const ref = { header: a.ref.header, text: a.ref.text };
        refs.set(a.ref, ref);
        cells.push({ r, c, rowspan: a.ref.rowspan, colspan: a.ref.colspan, ref });
      }
    }
  }
  cells.sort((x, y) => x.r - y.r || x.c - y.c);

  const out = createEmptyGrid(rows, cols);
  for (const cell of cells) {
    if (cell.r >= rows || cell.c >= cols) continue;
    const target = {
      r: cell.r,
      c: cell.c,
      rowspan: Math.min(cell.rowspan, rows - cell.r),
      colspan: Math.min(cell.colspan, cols - cell.c),
      header: cell.ref.header,
      text: cell.ref.text
    };
    if (place(out, target.r, target.c, target)) continue;
    // Menabrak span lain → geser ke slot kosong berikutnya sebaris, lalu baris berikut.
    let placed = false;
    outer:
    for (let r = cell.r; r < rows; r++) {
      const start = (r === cell.r) ? cell.c : 0;
      for (let c = start; c <= cols - target.colspan; c++) {
        if (place(out, r, c, { ...target, r, c })) { placed = true; break outer; }
      }
    }
    if (!placed) { /* tidak muat → sel dibuang */ }
  }
  return out;
}

/** Bangun ulang grid dari daftar sel (anchor saja) — dipakai operasi struktural. */
export function rebuildGrid(cells, rows, cols) {
  const out = createEmptyGrid(rows, cols);
  const sorted = [...cells].sort((x, y) => x.r - y.r || x.c - y.c);
  for (const cell of sorted) {
    if (cell.r >= rows || cell.c >= cols) continue;
    place(out, cell.r, cell.c, {
      ...cell,
      rowspan: Math.min(cell.rowspan, rows - cell.r),
      colspan: Math.min(cell.colspan, cols - cell.c)
    });
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!out[r][c]) place(out, r, c, { r, c, rowspan: 1, colspan: 1, header: false, text: '' });
    }
  }
  return out;
}

/**
 * Kumpulkan seluruh sel anchor unik dari grid (baris→kolom).
 * Salinan dangkal dibuat untuk setiap sel — penting karena satu objek ref
 * dapat menempati banyak slot grid (hasil colspan/rowspan), sehingga
 * `cells.map(c => ({...c}))` akan menghasilkan duplikat bila tidak didedup.
 */
export function collectCells(grid) {
  const seen = new Set();
  const cells = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r] ? grid[r].length : 0); c++) {
      const a = grid[r][c];
      if (!a || seen.has(a.ref)) continue;
      seen.add(a.ref);
      cells.push({ ...a.ref }); // salinan unik per sel
    }
  }
  return cells;
}

/** Referensi objek asli (tanpa salinan) — untuk operasi in-place pada grid. */
function uniqueRefs(grid) {
  const seen = new Set();
  const out = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r] ? grid[r].length : 0); c++) {
      const a = grid[r][c];
      if (!a || seen.has(a.ref)) continue;
      seen.add(a.ref);
      out.push(a.ref);
    }
  }
  return out;
}

/** Sisipkan baris pada indeks `idx` (0..rows). Rowspan yang melintasi ikut memanjang. */
export function insertRow(grid, idx) {
  const cols = gridCols(grid);
  idx = Math.max(0, Math.min(idx, grid.length));
  const out = grid.map(row => row.slice());
  out.splice(idx, 0, new Array(cols).fill(null));
  // Perpanjang rowspan yang memotong titik sisip (cek per anchor, bukan per slot)
  for (const cell of collectCells(out)) {
    if (cell.r < idx && cell.r + cell.rowspan > idx) cell.rowspan++;
  }
  // Isi slot kosong dengan sel baru
  for (let r = 0; r < out.length; r++) {
    for (let c = 0; c < cols; c++) {
      if (!out[r][c]) place(out, r, c, { r, c, rowspan: 1, colspan: 1, header: false, text: '' });
    }
  }
  return out;
}

/**
 * Hapus baris `idx`. Sel utuh di baris itu hilang; span vertikal yang
 * memotongnya menyusut, dan anchor yang terhapus berpindah ke sel di bawahnya.
 * Grid dengan satu baris → no-op (kembalikan grid yang sama).
 */
export function deleteRow(grid, idx) {
  if (idx < 0 || idx >= grid.length || grid.length <= 1) return grid;
  const cols = gridCols(grid);
  const out = grid.map(row => row.slice());
  // Kategorikan per anchor unik agar sel ber-colspan tidak dihitung berkali-kali
  const seen = new Set();
  const drop = [];
  for (let c = 0; c < cols; c++) {
    const a = out[idx][c];
    if (!a || seen.has(a.ref)) continue;
    seen.add(a.ref);
    const cell = a.ref;
    if (cell.r === idx) {
      if (cell.rowspan > 1) { cell.r = idx; cell.rowspan--; }
      else drop.push(cell);
    } else if (cell.r < idx && cell.r + cell.rowspan > idx) {
      cell.rowspan--; // span memotong baris terhapus → susut
    }
  }
  out.splice(idx, 1);
  for (const cell of drop) {
    for (let r = 0; r < out.length; r++)
      for (let j = 0; j < cols; j++)
        if (out[r][j] && out[r][j].ref === cell) out[r][j] = null;
  }
  // Isi lubang sisa
  for (let r = 0; r < out.length; r++) {
    for (let c = 0; c < cols; c++) {
      if (!out[r][c]) place(out, r, c, { r, c, rowspan: 1, colspan: 1, header: false, text: '' });
    }
  }
  return out;
}

/** Sisipkan kolom pada indeks `idx` (0..cols). Colspan yang melintasi ikut melebar. */
export function insertColumn(grid, idx) {
  const cols = gridCols(grid);
  idx = Math.max(0, Math.min(idx, cols));
  const out = grid.map(row => {
    const nr = row.slice();
    nr.splice(idx, 0, null);
    return nr;
  });
  // Cek per anchor (bukan per slot) agar colspan tidak dihitung ganda
  for (const cell of collectCells(out)) {
    if (cell.c < idx && cell.c + cell.colspan > idx) cell.colspan++;
  }
  for (let r = 0; r < out.length; r++) {
    for (let c = 0; c <= cols; c++) {
      if (!out[r][c]) place(out, r, c, { r, c, rowspan: 1, colspan: 1, header: false, text: '' });
    }
  }
  return out;
}

/** Hapus kolom `idx`. Kolom tunggal terakhir → no-op. Mirror dari deleteRow. */
export function deleteColumn(grid, idx) {
  const cols = gridCols(grid);
  if (idx < 0 || idx >= cols || cols <= 1) return grid;
  const out = grid.map(row => row.slice());
  // Kategorikan per anchor unik agar sel ber-rowspan tidak dihitung berkali-kali
  const seen = new Set();
  const drop = [];       // sel yang seluruhnya hilang
  for (let r = 0; r < out.length; r++) {
    const a = out[r][idx];
    if (!a || seen.has(a.ref)) continue;
    seen.add(a.ref);
    const cell = a.ref;
    if (cell.c === idx) {
      if (cell.colspan > 1) { cell.c = idx; cell.colspan--; }
      else drop.push(cell);
    } else if (cell.c < idx && cell.c + cell.colspan > idx) {
      cell.colspan--; // span memotong kolom terhapus → susut
    }
  }
  out.forEach(row => row.splice(idx, 1));
  for (const cell of drop) {
    for (let r = 0; r < out.length; r++)
      for (let j = 0; j < out[r].length; j++)
        if (out[r][j] && out[r][j].ref === cell) out[r][j] = null;
  }
  for (let r = 0; r < out.length; r++) {
    for (let c = 0; c < out[r].length; c++) {
      if (!out[r][c]) place(out, r, c, { r, c, rowspan: 1, colspan: 1, header: false, text: '' });
    }
  }
  return out;
}

/**
 * Geser baris `from` sebanyak `delta` langkah (mis. -1 = naik, +2 = turun dua).
 * Operasi ditolak (false) bila menabrak batas atau ada span vertikal yang
 * akan terpotong oleh pergeseran. Kembalikan grid hasil (objek baru).
 */
export function shiftRow(grid, from, delta) {
  if (!delta || from < 0 || from >= grid.length) return false;
  const to = from + delta;
  if (to < 0 || to >= grid.length) return false;
  const cols = gridCols(grid);
  const lo = Math.min(from, to), hi = Math.max(from, to);
  // Tidak boleh ada span vertikal yang terpotong oleh batas-batas zona geser
  for (const cell of collectCells(grid)) {
    if (cell.rowspan <= 1) continue;
    const top = cell.r, bot = cell.r + cell.rowspan - 1;
    const straddlesLo = top < lo && bot >= lo;
    const straddlesHi = top <= hi && bot > hi;
    if (straddlesLo || straddlesHi) return false;
  }
  const dir = delta > 0 ? 1 : -1;
  const cells = collectCells(grid).map(c => {
    const nc = { ...c };
    if (nc.r === from) nc.r = to;
    else if (nc.r > lo && nc.r < hi) nc.r -= dir; // baris antara ikut bergeser
    return nc;
  });
  return rebuildGrid(cells, grid.length, cols);
}

/** Naikkan baris satu tingkat. true/false untuk feedback UI. */
export function moveRowUp(grid, r) { return shiftRow(grid, r, -1); }
/** Turunkan baris satu tingkat. */
export function moveRowDown(grid, r) { return shiftRow(grid, r, 1); }

/**
 * Tukar posisi kolom `from` dan `to`. Bila ada span horizontal yang akan
 * terpotong oleh area penukaran, operasi ditolak (false).
 */
export function swapColumns(grid, from, to) {
  const cols = gridCols(grid);
  if (from === to) return grid;
  if (from < 0 || to < 0 || from >= cols || to >= cols) return false;
  const lo = Math.min(from, to), hi = Math.max(from, to);
  for (const cell of collectCells(grid)) {
    if (cell.colspan <= 1) continue;
    const left = cell.c, right = cell.c + cell.colspan - 1;
    const inside = left >= lo && right <= hi;
    const outside = left < lo && right > hi;
    const fullyLeft = right < lo, fullyRight = left > hi;
    if (!(inside || outside || fullyLeft || fullyRight)) return false;
  }
  const cells = collectCells(grid).map(c => {
    const nc = { ...c };
    if (nc.c === from) nc.c = to;
    else if (nc.c === to) nc.c = from;
    return nc;
  });
  return rebuildGrid(cells, grid.length, cols);
}

/** Geser kolom `from` sebanyak `delta` langkah (kiri/kanan). false bila ditolak. */
export function shiftColumn(grid, from, delta) {
  if (!delta || from < 0 || from >= gridCols(grid)) return false;
  const to = from + delta;
  const cols = gridCols(grid);
  if (to < 0 || to >= cols) return false;
  const lo = Math.min(from, to), hi = Math.max(from, to);
  for (const cell of collectCells(grid)) {
    if (cell.colspan <= 1) continue;
    const left = cell.c, right = cell.c + cell.colspan - 1;
    if ((left < lo && right >= lo) || (left <= hi && right > hi)) return false;
  }
  const dir = delta > 0 ? 1 : -1;
  const cells = collectCells(grid).map(c => {
    const nc = { ...c };
    if (nc.c === from) nc.c = to;
    else if (nc.c > lo && nc.c < hi) nc.c -= dir;
    return nc;
  });
  return rebuildGrid(cells, grid.length, cols);
}

/** Geser kolom satu ke kiri / kanan. */
export function moveColumnLeft(grid, c) { return shiftColumn(grid, c, -1); }
export function moveColumnRight(grid, c) { return shiftColumn(grid, c, 1); }

/**
 * Gabungkan rentang sel [r1,c1]–[r2,c2] menjadi satu sel.
 * Teks tiap sel digabung dengan pemisah ' · '. Gagal (false) bila rentang
 * menyentuh sel yang memiliki bagian di luar rentang (span tak boleh terpotong).
 */
export function mergeRect(grid, r1, c1, r2, c2) {
  // Normalisasi sudut
  const a = { r: Math.min(r1, r2), c: Math.min(c1, c2) };
  const b = { r: Math.max(r1, r2), c: Math.max(c1, c2) };
  if (a.r === b.r && a.c === b.c) return false; // sel tunggal → tidak ada yang digabung

  const touched = new Set();
  for (let r = a.r; r <= b.r; r++) {
    for (let c = a.c; c <= b.c; c++) {
      const cell = getCellAt(grid, r, c);
      if (!cell) return false;
      if (cell.r < a.r || cell.c < a.c ||
          cell.r + cell.rowspan - 1 > b.r || cell.c + cell.colspan - 1 > b.c) {
        return false; // span keluar dari area gabungan → ditolak
      }
      touched.add(cell);
    }
  }
  if (touched.size < 2) return false;

  const texts = [];
  [...touched].sort((x, y) => x.r - y.r || x.c - y.c).forEach(cell => {
    const t = (cell.text || '').trim();
    if (t) texts.push(t);
    // hapus dari grid
    for (let r = cell.r; r < cell.r + cell.rowspan; r++)
      for (let c = cell.c; c < cell.c + cell.colspan; c++) grid[r][c] = null;
  });

  const header = [...touched].some(x => x.header);
  return place(grid, a.r, a.c, {
    r: a.r, c: a.c,
    rowspan: b.r - a.r + 1,
    colspan: b.c - a.c + 1,
    header,
    text: texts.join(' · ')
  }) ? true : false;
}

/** Pecah sel pada (r,c) menjadi sel-sel 1×1. Kembalikan jumlah pecahan (0 bila gagal). */
export function splitCell(grid, r, c) {
  const cell = getCellAt(grid, r, c);
  if (!cell || (cell.rowspan === 1 && cell.colspan === 1)) return 0;
  const { r: cr, c: cc, rowspan, colspan, header, text } = cell;
  for (let i = cr; i < cr + rowspan; i++)
    for (let j = cc; j < cc + colspan; j++) grid[i][j] = null;
  let n = 0;
  for (let i = cr; i < cr + rowspan; i++) {
    for (let j = cc; j < cc + colspan; j++) {
      place(grid, i, j, {
        r: i, c: j, rowspan: 1, colspan: 1, header,
        text: (i === cr && j === cc) ? text : ''
      });
      n++;
    }
  }
  return n;
}

/** Ubah tampilan sel (td ⇄ th) pada (r,c). */
export function setCellHeader(grid, r, c, header) {
  const cell = getCellAt(grid, r, c);
  if (!cell) return false;
  cell.header = !!header;
  return true;
}

/** Konversi grid menjadi string HTML tabel siap sisip / render. */
export function gridToHtml(grid, opts = {}) {
  const styleAttr = opts.styleAttr || '';
  let html = `<table${styleAttr}>`;
  for (let r = 0; r < grid.length; r++) {
    html += '<tr>';
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      const a = row[c];
      if (!a) continue;
      const cell = a.ref;
      if (cell.r !== r || cell.c !== c) continue; // hanya anchor yang dicetak
      const tag = cell.header ? 'th' : 'td';
      let attrs = '';
      if (cell.colspan > 1) attrs += ` colspan="${cell.colspan}"`;
      if (cell.rowspan > 1) attrs += ` rowspan="${cell.rowspan}"`;
      const w = cell.width ? ` style="width:${Math.round(cell.width)}px"` : '';
      const txt = cell.text || '';
      html += `<${tag}${attrs}${w}>${txt ? escapeHtmlCell(txt) : '<br>'}</${tag}>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  return html;
}

function escapeHtmlCell(s) {
  return String(s).replace(/[&<>"]/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

export default {
  createEmptyGrid, buildGrid, place, getCellAt, findCell, gridCols, normalize,
  resizeGrid, rebuildGrid, collectCells, insertRow, deleteRow, insertColumn,
  deleteColumn, shiftRow, moveRowUp, moveRowDown, swapColumns, shiftColumn,
  moveColumnLeft, moveColumnRight, mergeRect, splitCell, setCellHeader, gridToHtml
};
