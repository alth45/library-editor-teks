/**
 * Utilitas DOM kecil yang dipakai bersama oleh seluruh modul RichEdit.
 */

/** Escape teks untuk disisipkan sebagai konten HTML. */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Escape nilai untuk atribut HTML. */
export function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Debounce: tunda pemanggilan `fn` hingga `ms` tanpa panggilan baru. */
export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
