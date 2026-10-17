/**
 * Statistik kata/karakter + indikator "tersimpan" pada statusbar.
 */
export class Statusbar {
  /**
   * @param {object} opts
   * @param {HTMLElement} [opts.container] - elemen statusbar (dibuat jika tidak ada)
   * @param {Function} opts.getText - () => string teks polos editor
   */
  constructor({ container, getText }) {
    this.getText = getText;
    if (container) {
      this.wordsEl = container.querySelector('[data-re="words"]') || container.children[0];
      this.charsEl = container.querySelector('[data-re="chars"]') || container.children[1];
      this.savedEl = container.querySelector('[data-re="saved"]') || container.querySelector('.spacer')?.nextElementSibling || null;
    }
  }

  update() {
    const text = this.getText() || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (this.wordsEl) this.wordsEl.textContent = `${words} kata`;
    if (this.charsEl) this.charsEl.textContent = `${text.length} karakter`;
  }

  flashSaved(label = 'Tersimpan otomatis') {
    if (!this.savedEl) return;
    this.savedEl.textContent = 'Tersimpan ✓';
    this.savedEl.classList.add('saved-flash');
    setTimeout(() => {
      this.savedEl.classList.remove('saved-flash');
      this.savedEl.textContent = label;
    }, 1200);
  }
}

export default Statusbar;
