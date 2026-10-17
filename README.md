# RichEdit

Rich text editor **murni JavaScript** (tanpa dependensi runtime) yang dipecah
menjadi struktur library modular, dibundel dengan **Vite**. Dibangun di atas `contenteditable` + `document.execCommand`,
dengan undo/redo buatan sendiri, sanitasi paste berbasis whitelist, mode sumber HTML,
autosave ke `localStorage`, dan tema gelap.

## Struktur direktori

```
richedit/
├── package.json              # manifest npm (type: module, exports, scripts)
├── vite.config.js            # konfigurasi Vite (dev server demo + build library)
├── README.md
├── .gitignore
├── editor.html               # versi asli single-file (dipertahankan sebagai referensi)
├── src/
│   ├── index.js              # entry point — ekspor publik library
│   ├── editor/
│   │   └── rich-edit.js      # kelas utama RichEdit (perakitan semua modul + API publik)
│   ├── core/
│   │   ├── icons.js          # ikon inline SVG toolbar
│   │   ├── default-toolbar.js# konfigurasi toolbar bawaan (data murni, bisa diganti)
│   │   ├── selection.js      # SelectionManager — simpan/pulihkan kursor & offset
│   │   ├── history.js        # History — snapshot undo/redo dengan pemulihan seleksi
│   │   ├── commands.js       # Commands — wrapper execCommand (bold, link, gambar, dll.)
│   │   ├── autosave.js       # Autosave — simpan konten debounce ke Storage
│   │   └── sanitize.js       # sanitizeHTML — whitelist tag/atribut/style
│   ├── ui/
│   │   ├── toolbar.js        # Toolbar — bangun DOM toolbar, sync state, event
│   │   ├── modal.js          # Modal — dialog input berbasis Promise (DOM dibuat sendiri)
│   │   └── statusbar.js      # Statusbar — statistik kata/karakter + indikator simpan
│   ├── utils/
│   │   └── dom.js            # escapeHtml, escapeAttr, debounce
│   └── styles/
│       └── theme.css         # variabel tema + gaya toolbar/editor/modal (.re-*)
├── dist/                     # hasil build (IIFE + ESM + CSS gabungan)
├── demo/
│   └── index.html            # demo memakai library dari src/ via ES modules
├── scripts/
│   └── build.mjs             # bundler alternatif tanpa dependensi (`npm run build:legacy`)
└── test/
    └── unit.test.mjs         # test fungsi pure (node test/unit.test.mjs)
```

## Cara memakai

### 1. ES modules (disarankan, saat pengembangan)

```html
<link rel="stylesheet" href="src/styles/theme.css" />
<div id="surface"></div>
<script type="module">
  import { RichEdit } from './src/index.js';

  const editor = new RichEdit({ element: '#surface' });
  editor.on('change', ({ html }) => console.log(html));
</script>
```

### 2. Hasil bundel Vite (`npm run build` → `dist/`)

```html
<!-- IIFE (skrip klasik, membuat global `RichEdit`) -->
<link rel="stylesheet" href="dist/richedit.css" />
<div id="surface"></div>
<script src="dist/richedit.iife.js"></script>
<script>
  const editor = new RichEdit({ element: '#surface' });
</script>
```

Atau sebagai ES module:

```html
<link rel="stylesheet" href="dist/richedit.css" />
<div id="surface"></div>
<script type="module">
  import { RichEdit } from './dist/richedit.js';
  const editor = new RichEdit({ element: '#surface' });
</script>
```

Gaya sudah di-`import` oleh `src/index.js`, sehingga Vite otomatis mengekstraknya
menjadi satu file `dist/richedit.css` saat build library.

## Opsi konstruktor

| Opsi            | Default                 | Keterangan                                  |
|-----------------|-------------------------|---------------------------------------------|
| `element`       | `document.body`         | Penampung area editor (selektor/HTMLElement)|
| `toolbar`       | `DEFAULT_TOOLBAR`       | Konfigurasi grup/item toolbar               |
| `statusbar`     | `null`                  | Elemen statusbar host (opsional)            |
| `autosave`      | `true`                  | Simpan otomatis ke storage                  |
| `storageKey`    | `richedit:content:v1`   | Kunci penyimpanan                           |
| `storage`       | `localStorage`          | Implementasi `Storage` / `null`             |
| `historyLimit`  | `120`                   | Maksimum snapshot undo                      |
| `initialHtml`   | (halaman selamat datang)| Konten awal bila belum ada yang tersimpan   |
| `loadSaved`     | `true`                  | Muat konten tersimpan saat init             |
| `sanitizePaste` | `true`                  | Sanitasi HTML hasil paste/setHTML           |

## API publik

```js
editor.getHTML()        // string HTML
editor.setHTML(html)    // ganti konten (lewat sanitasi)
editor.getText()        // teks polos
editor.undo() / redo()
editor.exec('bold')     // jalankan perintah
editor.toggleSource()   // mode sumber HTML
editor.save()           // paksa simpan
editor.on('change'|'saved'|'sourceToggle', fn)
editor.destroy()
```

## Skrip

```bash
npm install         # pasang Vite (satu-satunya devDependency)
npm run dev         # dev server Vite + HMR → http://localhost:5179/demo/
npm run build       # bundle library dengan Vite → dist/richedit.js (ESM),
                    # dist/richedit.iife.js (global), dist/richedit.css (gabungan)
npm run preview     # sajikan hasil build untuk pengecekan cepat
npm run build:legacy  # opsional: bundler Node tanpa dependensi (scripts/build.mjs)
node test/unit.test.mjs
```

## Lisensi

MIT
