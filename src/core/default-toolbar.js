/**
 * Konfigurasi toolbar bawaan RichEdit.
 * Struktur data murni sehingga pengguna bisa memodifikasi/menggantinya.
 */
export const DEFAULT_TOOLBAR = [
  { items: [
    { t: 'btn', act: 'undo', icon: 'undo', title: 'Undo (Ctrl+Z)' },
    { t: 'btn', act: 'redo', icon: 'redo', title: 'Redo (Ctrl+Y)' }
  ]},
  { items: [
    { t: 'select', id: 'blockSelect', title: 'Format blok', options: [
      ['p', 'Paragraf'], ['h1', 'Judul 1'], ['h2', 'Judul 2'], ['h3', 'Judul 3'],
      ['h4', 'Judul 4'], ['blockquote', 'Kutipan'], ['pre', 'Blok kode']
    ]},
    { t: 'select', id: 'fontSelect', title: 'Jenis huruf', options: [
      ['', 'Font'], ['Arial, sans-serif', 'Arial'], ['Georgia, serif', 'Georgia'],
      ['"Times New Roman", serif', 'Times'], ['Verdana, sans-serif', 'Verdana'],
      ['"Courier New", monospace', 'Courier'], ['Impact, sans-serif', 'Impact']
    ]},
    { t: 'select', id: 'sizeSelect', title: 'Ukuran huruf', options: [
      ['', 'Ukuran'], ['12px', '12'], ['14px', '14'], ['16px', '16'], ['18px', '18'],
      ['20px', '20'], ['24px', '24'], ['30px', '30'], ['36px', '36'], ['48px', '48']
    ]}
  ]},
  { items: [
    { t: 'btn', act: 'bold', icon: 'bold', title: 'Tebal (Ctrl+B)' },
    { t: 'btn', act: 'italic', icon: 'italic', title: 'Miring (Ctrl+I)' },
    { t: 'btn', act: 'underline', icon: 'underline', title: 'Garis bawah (Ctrl+U)' },
    { t: 'btn', act: 'strikeThrough', icon: 'strike', title: 'Coret' }
  ]},
  { items: [
    { t: 'color', id: 'colorText', icon: 'A', title: 'Warna teks', value: '#e11d48' },
    { t: 'color', id: 'colorHighlight', icon: 'A', title: 'Warna sorot', value: '#fde68a', hl: true }
  ]},
  { items: [
    { t: 'btn', act: 'justifyLeft', icon: 'alignLeft', title: 'Rata kiri' },
    { t: 'btn', act: 'justifyCenter', icon: 'alignCenter', title: 'Rata tengah' },
    { t: 'btn', act: 'justifyRight', icon: 'alignRight', title: 'Rata kanan' },
    { t: 'btn', act: 'justifyFull', icon: 'alignJustify', title: 'Rata penuh' }
  ]},
  { items: [
    { t: 'btn', act: 'insertUnorderedList', icon: 'ul', title: 'Daftar berbutir' },
    { t: 'btn', act: 'insertOrderedList', icon: 'ol', title: 'Daftar bernomor' }
  ]},
  { items: [
    { t: 'btn', act: 'outdent', icon: 'outdent', title: 'Kurangi indentasi' },
    { t: 'btn', act: 'indent', icon: 'indent', title: 'Tambah indentasi' }
  ]},
  { items: [
    { t: 'btn', act: 'link', icon: 'link', title: 'Sisipkan tautan (Ctrl+K)' },
    { t: 'btn', act: 'image', icon: 'image', title: 'Sisipkan gambar (URL / komputer)' },
    { t: 'btn', act: 'upload', icon: 'upload', title: 'Unggah gambar dari komputer' },
    // Tombol "Sisipkan tabel" — ikon grid tabel, berada di antara Unggah & Garis pemisah.
    { t: 'btn', act: 'insertTable', icon: 'table', title: 'Sisipkan tabel' },
    { t: 'btn', act: 'hr', icon: 'hr', title: 'Garis pemisah' }
  ]},
  { items: [
    { t: 'btn', act: 'quote', icon: 'quote', title: 'Kutipan' },
    { t: 'btn', act: 'code', icon: 'code', title: 'Blok kode' }
  ]},
  { items: [
    { t: 'btn', act: 'clear', icon: 'clear', title: 'Hapus format' },
    { t: 'btn', act: 'source', icon: 'source', title: 'Lihat sumber HTML' }
  ]}
];

export default DEFAULT_TOOLBAR;
