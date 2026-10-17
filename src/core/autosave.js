import { debounce } from '../utils/dom.js';

/**
 * Autosave konten ke localStorage (atau storage lain yang diberikan).
 */
export class Autosave {
  /**
   * @param {object} opts
   * @param {Function} opts.getContent - () => string (HTML)
   * @param {string} [opts.key='richedit:content:v1']
   * @param {number} [opts.delay=800]
   * @param {Storage} [opts.storage=localStorage]
   * @param {Function} [opts.onSaved] - dipanggil setelah berhasil simpan
   */
  constructor({ getContent, key = 'richedit:content:v1', delay = 800, storage, onSaved = () => {} }) {
    this.getContent = getContent;
    this.key = key;
    this.storage = storage !== undefined ? storage : (typeof localStorage !== 'undefined' ? localStorage : null);
    this.onSaved = onSaved;
    this.saveDebounced = debounce(() => this.saveNow(), delay);
  }

  load() {
    if (!this.storage) return null;
    try {
      return this.storage.getItem(this.key);
    } catch (e) {
      return null;
    }
  }

  saveNow() {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.key, this.getContent());
      this.onSaved();
    } catch (e) { /* kuota penuh, abaikan */ }
  }

  clear() {
    if (!this.storage) return;
    try { this.storage.removeItem(this.key); } catch (e) { /* noop */ }
  }
}

export default Autosave;
