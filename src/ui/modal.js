/**
 * Modal input generik berbasis Promise.
 * Elemen DOM dibuat sendiri sehingga tidak bergantung pada HTML host —
 * cukup container (default: document.body).
 */
export class Modal {
  constructor(container = document.body) {
    this.root = document.createElement('div');
    this.root.className = 're-modal';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="re-modal-backdrop" data-close></div>
      <div class="re-modal-box">
        <h3 data-role="title">Judul</h3>
        <label data-role="label">Label</label>
        <input type="text" data-role="input" />
        <div class="re-modal-actions">
          <button type="button" data-close>Batal</button>
          <button type="button" class="primary" data-role="ok">Simpan</button>
        </div>
      </div>`;

    this.titleEl = this.root.querySelector('[data-role="title"]');
    this.labelEl = this.root.querySelector('[data-role="label"]');
    this.inputEl = this.root.querySelector('[data-role="input"]');
    this.okEl = this.root.querySelector('[data-role="ok"]');

    this.resolve = null;

    this.okEl.addEventListener('click', () => this.close(this.inputEl.value.trim() || null));
    this.root.querySelectorAll('[data-close]').forEach(el =>
      el.addEventListener('click', () => this.close(null)));
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.close(this.inputEl.value.trim() || null); }
      if (e.key === 'Escape') { e.preventDefault(); this.close(null); }
    });

    container.appendChild(this.root);
  }

  /**
   * Tampilkan modal dan tunggu hasilnya.
   * @returns {Promise<string|null>} nilai input, atau null bila dibatalkan
   */
  ask({ title, label, value = '', placeholder = '' }) {
    return new Promise(resolve => {
      this.titleEl.textContent = title;
      this.labelEl.textContent = label;
      this.inputEl.value = value;
      this.inputEl.placeholder = placeholder;
      this.root.hidden = false;
      this.resolve = resolve;
      setTimeout(() => { this.inputEl.focus(); this.inputEl.select(); }, 30);
    });
  }

  close(result) {
    this.root.hidden = true;
    if (this.resolve) {
      this.resolve(result);
      this.resolve = null;
    }
  }

  destroy() {
    this.close(null);
    this.root.remove();
  }
}

export default Modal;
