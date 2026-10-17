/**
 * Ikon toolbar sebagai inline SVG — tidak butuh file/font eksternal.
 */

const svg = (p) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

export const ICONS = {
  undo: svg('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'),
  redo: svg('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>'),
  bold: '<b style="font-family:Georgia,serif;font-size:15px">B</b>',
  italic: '<i style="font-family:Georgia,serif;font-size:15px">I</i>',
  underline: '<u style="font-size:14px">U</u>',
  strike: '<s style="font-size:14px">S</s>',
  alignLeft: svg('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="13" y2="12"/><line x1="3" y1="18" x2="17" y2="18"/>'),
  alignCenter: svg('<line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>'),
  alignRight: svg('<line x1="3" y1="6" x2="21" y2="6"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="7" y1="18" x2="21" y2="18"/>'),
  alignJustify: svg('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'),
  ul: svg('<line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.4" fill="currentColor" stroke="none"/>'),
  ol: svg('<line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><text x="1.5" y="8" font-size="7" font-family="sans-serif" fill="currentColor" stroke="none">1</text><text x="1.5" y="14" font-size="7" font-family="sans-serif" fill="currentColor" stroke="none">2</text><text x="1.5" y="20" font-size="7" font-family="sans-serif" fill="currentColor" stroke="none">3</text>'),
  indent: svg('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><path d="M3 12l5-3v6z" fill="currentColor" stroke="none" transform="translate(0,0)"/>'),
  outdent: svg('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><path d="M8 12l-5-3v6z" fill="currentColor" stroke="none"/>'),
  link: svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
  upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><line x1="12" y1="3" x2="12" y2="15"/>'),
  hr: svg('<line x1="3" y1="12" x2="21" y2="12"/>'),
  quote: svg('<path d="M6 17h3l2-4V7H5v6h3z"/><path d="M16 17h3l2-4V7h-6v6h3z"/>'),
  code: svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  clear: svg('<path d="M4 20h16"/><path d="M6.5 16.5L15 8l-3-3-8.5 8.5a2 2 0 0 0 0 2.8l.2.2a2 2 0 0 0 2.8 0z"/><path d="M13 5l6 6"/>'),
  source: svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="14" y1="4" x2="10" y2="20"/>'),
  table: svg('<rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="3" y1="9.5" x2="21" y2="9.5"/><line x1="3" y1="14.5" x2="21" y2="14.5"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/>'),
  tableInsertRow: svg('<rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="16.5" x2="12" y2="19.5"/><line x1="10.5" y1="18" x2="13.5" y2="18"/>'),
  tableDeleteRow: svg('<rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="10.5" y1="18" x2="13.5" y2="18"/>'),
  tableInsertCol: svg('<rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="14.5" y1="4" x2="14.5" y2="20"/><line x1="17.5" y1="10.5" x2="17.5" y2="13.5"/><line x1="16" y1="12" x2="19" y2="12"/>'),
  tableDeleteCol: svg('<rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="14.5" y1="4" x2="14.5" y2="20"/><line x1="16" y1="12" x2="19" y2="12"/>'),
  mergeCells: svg('<rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M8.5 8.5 12 5l3.5 3.5"/><path d="M8.5 15.5 12 19l3.5-3.5"/>'),
  splitCell: svg('<rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="12" y1="4" x2="12" y2="20"/><path d="M9 8 5.5 12 9 16"/><path d="M15 8l3.5 4L15 16"/>'),
  cellHeader: svg('<rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 13v4"/><path d="M12 13v4"/><path d="M8 15h4"/>')
};

export default ICONS;
