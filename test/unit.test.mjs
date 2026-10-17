/**
 * Test ringan untuk fungsi pure (tanpa DOM): escapeHtml, escapeAttr, debounce.
 * Jalankan: node test/unit.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Muat isi utils/dom.js lalu eval dalam ruang terisolasi (modul ini tidak pakai DOM).
const src = readFileSync(join(root, 'src/utils/dom.js'), 'utf8')
  .replace(/export\s+/g, '');
// eslint-disable-next-line no-new-func
const { escapeHtml, escapeAttr, debounce } = new Function(
  `${src}; return { escapeHtml, escapeAttr, debounce };`
)();

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; }
};

test('escapeHtml meng-escape karakter khusus', () => {
  assert.equal(escapeHtml(`<a href="x">&'</a>`),
    '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('escapeAttr meng-escape tanda kutip & <', () => {
  assert.equal(escapeAttr('a"b<c'), 'a&quot;b&lt;c');
});

test('debounce hanya memanggil sekali setelah jeda', async () => {
  let calls = 0;
  const fn = debounce(() => calls++, 20);
  fn(); fn(); fn();
  await new Promise(r => setTimeout(r, 50));
  assert.equal(calls, 1);
});

console.log(`\n${passed} test lulus.`);
