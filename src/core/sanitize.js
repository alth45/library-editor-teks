/**
 * Sanitasi HTML whitelist-based — dipakai untuk membersihkan hasil paste
 * dan konten yang dimuat dari penyimpanan.
 */

export const ALLOWED_TAGS = new Set([
  'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'INS', 'MARK',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'SPAN', 'DIV', 'A', 'IMG', 'HR',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH'
]);

export const ALLOWED_ATTRS = {
  A: ['href', 'title'],
  IMG: ['src', 'alt', 'width', 'height'],
  TD: ['colspan', 'rowspan'],
  TH: ['colspan', 'rowspan'],
  '*': ['style']
};

export const ALLOWED_STYLES = [
  'color', 'background-color', 'font-weight', 'font-style',
  'text-decoration', 'text-decoration-line', 'text-align',
  'font-size', 'font-family'
];

/**
 * Bersihkan string HTML: buang tag/atribut/gaya di luar whitelist,
 * ganti tag tak dikenal dengan isi dalamnya (unwrap), dan hapus
 * skema URL berbahaya (javascript:, data:text/html).
 */
export function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  function cleanAttrs(el) {
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const allowed = (ALLOWED_ATTRS[el.tagName] || []).concat(ALLOWED_ATTRS['*']);

      if (name.startsWith('on') || !allowed.includes(name)) {
        el.removeAttribute(attr.name);
        return;
      }

      if (name === 'style') {
        const keep = {};
        ALLOWED_STYLES.forEach(prop => {
          const v = el.style.getPropertyValue(prop);
          if (v) keep[prop] = v;
        });
        el.removeAttribute('style');
        Object.entries(keep).forEach(([p, v]) => el.style.setProperty(p, v));
      }

      if (name === 'href' || name === 'src') {
        const v = (attr.value || '').trim().toLowerCase();
        if (v.startsWith('javascript:') || v.startsWith('data:text/html')) {
          el.removeAttribute(attr.name);
        }
      }
    });
  }

  function cleanChildren(parent) {
    let node = parent.firstChild;
    while (node) {
      const next = node.nextSibling;

      if (node.nodeType === 3) { node = next; continue; }
      if (node.nodeType !== 1) { parent.removeChild(node); node = next; continue; }

      if (!ALLOWED_TAGS.has(node.tagName)) {
        // Buka pembungkusnya (unwrap) lalu lanjutkan dari anak pertamanya
        const first = node.firstChild;
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
        node = first || next;
        continue;
      }

      cleanAttrs(node);
      cleanChildren(node);
      node = next;
    }
  }

  cleanChildren(doc.body);
  return doc.body.innerHTML;
}

export default sanitizeHTML;
