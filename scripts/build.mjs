/**
 * Build script sederhana: gabungkan modul ES menjadi satu bundle IIFE
 * (untuk <script> biasa) + ESM, dan satukan CSS ke dist/richedit.css.
 * Tidak butuh bundler eksternal — cukup Node.js.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });

// Urutan topologis modul (index.js terakhir).
const MODULES = [
  'src/utils/dom.js',
  'src/core/icons.js',
  'src/core/default-toolbar.js',
  'src/core/sanitize.js',
  'src/core/selection.js',
  'src/core/history.js',
  'src/core/autosave.js',
  'src/core/commands.js',
  'src/ui/toolbar.js',
  'src/ui/modal.js',
  'src/ui/statusbar.js',
  'src/editor/rich-edit.js',
  'src/index.js'
];

const stripImportsExports = (src) => src
  .replace(/^\s*import\s[^;]+;\s*$/gm, '')
  .replace(/^\s*export\s+default\s+[A-Za-z_$][\w$]*;?\s*$/gm, '') // `export default Foo;` → buang seluruh baris
  .replace(/^\s*export\s+default\s+/gm, '')                        // `export default class ... {`
  .replace(/^\s*export\s+(?=(class|function|const|let|var))/gm, '')
  .replace(/^\s*export\s*\{[^}]*\}(?:\s*from\s*['"][^'"]+['"])?;?\s*$/gm, '');

const parts = MODULES.map(m => {
  const code = stripImportsExports(readFileSync(join(root, m), 'utf8'));
  return `/* ---- ${m} ---- */\n${code}`;
});

const banner = `/*! RichEdit v1.0.0 — rich text editor murni JavaScript (MIT) */`;

const iife = `${banner}
var RichEdit = (function () {
'use strict';
${parts.join('\n\n')}
return RichEdit;
})();
`;

const esm = `${banner}
${parts.join('\n\n')}
export { RichEdit, RichEdit as Editor, ICONS, DEFAULT_TOOLBAR, SelectionManager, History, Commands, Autosave, sanitizeHTML, Toolbar, Modal, Statusbar, escapeHtml, escapeAttr, debounce };
export default RichEdit;
`;

writeFileSync(join(dist, 'richedit.js'), iife);
writeFileSync(join(dist, 'richedit.esm.js'), esm);

const css = readFileSync(join(root, 'src/styles/theme.css'), 'utf8');
writeFileSync(join(dist, 'richedit.css'), `/* RichEdit v1.0.0 — tema + gaya editor */\n${css}`);

console.log('Build selesai → dist/richedit.js, dist/richedit.esm.js, dist/richedit.css');
