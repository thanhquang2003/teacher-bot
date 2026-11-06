// Giới hạn số lượt gọi AI chạy cùng lúc; lượt dư xếp hàng theo thứ tự.
class Gate {
  constructor(max = 2) {
    this.max = max;
    this.running = 0;
    this.waiting = [];
  }

  setMax(n) {
    this.max = Math.max(1, Number(n) || 1);
    this.#drain();
  }

  get position() { return this.waiting.length; }

  acquire(onWait, signal) {
    if (this.running < this.max) {
      this.running++;
      return Promise.resolve(() => this.#release());
    }
    return new Promise((resolve, reject) => {
      const w = { resolve: () => { this.running++; resolve(() => this.#release()); } };
      this.waiting.push(w);
      onWait?.(this.waiting.length);
      signal?.addEventListener('abort', () => {
        const i = this.waiting.indexOf(w);
        if (i >= 0) { this.waiting.splice(i, 1); reject(new Error('aborted')); }
      }, { once: true });
    });
  }

  #release() { this.running--; this.#drain(); }

  #drain() {
    while (this.running < this.max && this.waiting.length) this.waiting.shift().resolve();
  }
}

module.exports = { Gate };
