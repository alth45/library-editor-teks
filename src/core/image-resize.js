/**
 * ImageResize — fitur resize gambar di dalam editor contenteditable.
 *
 * Ketika sebuah <img> di dalam editor diklik, gambar ditandai "aktif" dan
 * muncul bingkai (overlay) dengan 12 titik handle:
 *   - 4 sudut   : nw, ne, sw, se  → resize bebas / rasio asli (Shift)
 *   - 8 tepi    : n, s, e, w + ct (tengah atas), cb (tengah bawah),
 *                 ml (tengah kiri), mr (tengah kanan)
 *     → stretch hanya satu sumbu (lebar ATAU tinggi saja)
 *
 * Mekanisme:
 *   - Overlay dibuat sekali per editor, diposisikan absolut terhadap halaman
 *     (getBoundingClientRect + scroll), sehingga tidak mengganggu DOM konten.
 *   - Saat drag dimulai, lebar/tinggi asli dicatat; pointermove menghitung
 *     ukuran baru (dengan minimum, batas max-width editor, dan optional
 *     aspect-ratio lock via Shift).
 *   - Saat drag selesai, hasil ditulis ke style img + atribut width/height,
 *     lalu callback onCommit dipanggil (untuk history.commit & event change).
 */

const HANDLES = [
  { dir: 'nw', cls: 're-rh-nw', cursor: 'nwse-resize', top: 0, left: 0 },
  { dir: 'n',  cls: 're-rh-n',  cursor: 'ns-resize',   top: 0, left: 0.5 },
  { dir: 'ne', cls: 're-rh-ne', cursor: 'nesw-resize', top: 0, left: 1 },
  { dir: 'ct', cls: 're-rh-ct', cursor: 'ns-resize',   top: 0, left: 0.25 },
  { dir: 'e',  cls: 're-rh-e',  cursor: 'ew-resize',   top: 0.5, left: 1 },
  { dir: 'mr', cls: 're-rh-mr', cursor: 'ew-resize',   top: 0.25, left: 1 },
  { dir: 'se', cls: 're-rh-se', cursor: 'nwse-resize', top: 1, left: 1 },
  { dir: 's',  cls: 're-rh-s',  cursor: 'ns-resize',   top: 1, left: 0.5 },
  { dir: 'sw', cls: 're-rh-sw', cursor: 'nesw-resize', top: 1, left: 0 },
  { dir: 'cb', cls: 're-rh-cb', cursor: 'ns-resize',   top: 1, left: 0.75 },
  { dir: 'w',  cls: 're-rh-w',  cursor: 'ew-resize',   top: 0.5, left: 0 },
  { dir: 'ml', cls: 're-rh-ml', cursor: 'ew-resize',   top: 0.75, left: 0 }
];

const MIN_SIZE = 24; // px minimum agar gambar tidak hilang tak terlihat

export class ImageResize {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.editor      - elemen contenteditable
   * @param {Function}    [opts.onCommit]  - dipanggil setelah resize selesai
   *                                        (untuk commit history / emit change)
   */
  constructor({ editor, onCommit }) {
    this.editor = editor;
    this.onCommit = typeof onCommit === 'function' ? onCommit : () => {};

    this.activeImg = null;
    this.dragging = false;
    this._rafPending = false;
    this._pendingEvent = null;

    this._buildOverlay();
    this._bind();
  }

  /* --------------------------- Overlay UI --------------------------- */

  _buildOverlay() {
    const ov = document.createElement('div');
    ov.className = 're-img-resize';
    ov.contentEditable = 'false';
    ov.hidden = true;

    this._frameEl = document.createElement('div');
    this._frameEl.className = 're-img-frame';
    ov.appendChild(this._frameEl);

    this._sizeBadge = document.createElement('span');
    this._sizeBadge.className = 're-img-size';
    ov.appendChild(this._sizeBadge);

    this._handles = {};
    for (const h of HANDLES) {
      const el = document.createElement('span');
      el.className = `re-img-handle ${h.cls}`;
      el.dataset.dir = h.dir;
      el.style.cursor = h.cursor;
      el.style.top = `calc(${h.top * 100}% - 6px)`;
      el.style.left = `calc(${h.left * 100}% - 6px)`;
      el.addEventListener('pointerdown', (e) => this._onHandleDown(e, h));
      ov.appendChild(el);
      this._handles[h.dir] = el;
    }

    document.body.appendChild(ov);
    this.overlay = ov;
  }

  /* ----------------------------- Events ----------------------------- */

  _bind() {
    this._onEditorClick = (e) => {
      const t = e.target;
      if (t && t.tagName === 'IMG' && this.editor.contains(t)) {
        this.activate(t);
      } else if (!this.overlay.contains(t)) {
        this.deactivate();
      }
    };
    this.editor.addEventListener('click', this._onEditorClick);

    // Scroll/resize halaman → reposisi overlay
    this._onReflow = () => {
      if (this.activeImg && !this.dragging) this._positionOverlay();
    };
    window.addEventListener('scroll', this._onReflow, true);
    window.addEventListener('resize', this._onReflow);

    // Hapus overlay bila gambar aktif dihapus dari editor
    this._mo = new MutationObserver(() => {
      if (this.activeImg && !this.editor.contains(this.activeImg)) this.deactivate();
    });
    this._mo.observe(this.editor, { childList: true, subtree: true });
  }

  /* ------------------------- Aktivasi / nonaktif -------------------- */

  activate(img) {
    if (!(img instanceof HTMLImageElement) || !this.editor.contains(img)) return;
    if (this.activeImg && this.activeImg !== img) this._clearActiveClass();
    this.activeImg = img;
    img.classList.add('re-img-active');
    this.overlay.hidden = false;
    this._positionOverlay();
  }

  deactivate() {
    if (this.dragging) return; // jangan ganggu proses drag
    this._clearActiveClass();
    this.activeImg = null;
    this.overlay.hidden = true;
  }

  _clearActiveClass() {
    if (this.activeImg) this.activeImg.classList.remove('re-img-active');
  }

  _positionOverlay() {
    if (!this.activeImg) return;
    const r = this.activeImg.getBoundingClientRect();
    this.overlay.style.left = `${r.left + window.scrollX}px`;
    this.overlay.style.top = `${r.top + window.scrollY}px`;
    this.overlay.style.width = `${r.width}px`;
    this.overlay.style.height = `${r.height}px`;
  }

  /* ---------------------------- Drag resize -------------------------- */

  _onHandleDown(e, handle) {
    if (!this.activeImg || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const img = this.activeImg;
    const rect = img.getBoundingClientRect();
    const naturalW = img.naturalWidth || rect.width;
    const naturalH = img.naturalHeight || rect.height;

    this._drag = {
      dir: handle.dir,
      startX: e.clientX,
      startY: e.clientY,
      startW: Math.max(rect.width, MIN_SIZE),
      startH: Math.max(rect.height, MIN_SIZE),
      ratio: naturalW > 0 && naturalH > 0 ? naturalW / naturalH : (rect.width / rect.height || 1),
      moved: false
    };

    this.dragging = true;
    this.overlay.classList.add('re-resizing');
    img.classList.add('re-img-resizing');
    try { e.target.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }

    this._onMove = (ev) => this._onDragMove(ev);
    this._onUp = (ev) => this._onDragEnd(ev);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
  }

  _onDragMove(e) {
    if (!this._drag) return;
    this._pendingEvent = e;
    this._drag.moved = true;
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._rafPending = false;
      if (this._pendingEvent) this._applyDrag(this._pendingEvent);
    });
  }

  _applyDrag(e) {
    const d = this._drag;
    const img = this.activeImg;
    if (!d || !img) return;

    let dx = e.clientX - d.startX;
    let dy = e.clientY - d.startY;

    // Arah sumbu yang dipengaruhi per handle:
    //   e,w  → horizontal saja        n,s    → vertikal saja
    //   ct,cb→ vertikal (tengah tepi atas/bawah)
    //   ml,mr→ horizontal (tengah tepi kiri/kanan)
    //   nw,ne,sw,se → kedua sumbu (sudut)
    const H_DIRS = ['e', 'w', 'ml', 'mr', 'nw', 'ne', 'sw', 'se'];
    const V_DIRS = ['n', 's', 'ct', 'cb', 'nw', 'ne', 'sw', 'se'];
    const affectsW = H_DIRS.includes(d.dir);
    const affectsH = V_DIRS.includes(d.dir);

    // Handle di sisi kiri/atas: geser ke kiri/atas berarti memperbesar.
    const negX = d.dir === 'w' || d.dir === 'ml' || d.dir === 'nw' || d.dir === 'sw';
    const negY = d.dir === 'n' || d.dir === 'ct' || d.dir === 'nw' || d.dir === 'ne';
    if (negX) dx = -dx;
    if (negY) dy = -dy;

    let w = d.startW;
    let h = d.startH;

    if (affectsW) w = d.startW + dx;
    if (affectsH) h = d.startH + dy;

    // Sudut + Shift = kunci rasio aspek asli (proportional).
    const isCorner = d.dir.length === 2 && /[nesw][nesw]/.test(d.dir);
    if (isCorner && e.shiftKey) {
      // Skala seragam berdasarkan sumbu yang paling besar perubahannya.
      const scaleW = (d.startW + dx) / d.startW;
      const scaleH = (d.startH + dy) / d.startH;
      const s = Math.abs(dx) >= Math.abs(dy) ? scaleW : scaleH;
      w = d.startW * s;
      h = w / d.ratio;
    }

    // Batas minimum & maksimum (max-width area tulisan editor).
    w = Math.max(MIN_SIZE, w);
    h = Math.max(MIN_SIZE, h);
    const maxW = this._maxWidthPx();
    if (maxW && w > maxW) {
      const k = maxW / w;
      w = maxW;
      if (isCorner && e.shiftKey) h *= k;
    }

    img.style.width = `${Math.round(w)}px`;
    img.style.height = `${Math.round(h)}px`;

    this._positionOverlay();
    this._showSize(Math.round(w), Math.round(h));
  }

  _onDragEnd() {
    if (!this._drag) return;
    const changed = this._drag.moved;
    this._drag = null;
    this.dragging = false;

    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);

    this.overlay.classList.remove('re-resizing');
    if (this.activeImg) this.activeImg.classList.remove('re-img-resizing');

    if (changed && this.activeImg) {
      // Simpan juga sebagai atribut width/height agar awet walau gaya dibersihkan.
      const w = Math.round(parseFloat(this.activeImg.style.width) || this.activeImg.clientWidth);
      const h = Math.round(parseFloat(this.activeImg.style.height) || this.activeImg.clientHeight);
      this.activeImg.setAttribute('width', String(w));
      this.activeImg.setAttribute('height', String(h));
      this._showSize(w, h);
      this.onCommit();
    }
    setTimeout(() => this._hideSize(), 900);
  }

  /* ----------------------------- Utilitas ---------------------------- */

  _maxWidthPx() {
    const cs = getComputedStyle(this.editor);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const inner = this.editor.clientWidth - padX;
    return inner > 0 ? inner : null;
  }

  _showSize(w, h) {
    this._sizeBadge.textContent = `${w} × ${h}`;
    this._sizeBadge.hidden = false;
  }

  _hideSize() {
    if (!this.dragging) this._sizeBadge.hidden = true;
  }

  destroy() {
    this.deactivate();
    this.editor.removeEventListener('click', this._onEditorClick);
    window.removeEventListener('scroll', this._onReflow, true);
    window.removeEventListener('resize', this._onReflow);
    if (this._mo) this._mo.disconnect();
    this.overlay.remove();
  }
}

export default ImageResize;
