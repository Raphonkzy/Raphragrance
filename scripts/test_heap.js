const fs = require('fs');

// Quick test of candidate generation speed
const count = 50000;
const arr = new Float32Array(count);
for (let i = 0; i < count; i++) arr[i] = Math.random();

// Min-heap of size 200
class MinHeap {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.heap = []; // { idx, val }
  }
  push(idx, val) {
    if (this.heap.length < this.maxSize) {
      this.heap.push({ idx, val });
      this._up(this.heap.length - 1);
    } else if (val > this.heap[0].val) {
      this.heap[0] = { idx, val };
      this._down(0);
    }
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].val > this.heap[i].val) {
        const tmp = this.heap[p]; this.heap[p] = this.heap[i]; this.heap[i] = tmp;
        i = p;
      } else break;
    }
  }
  _down(i) {
    const len = this.heap.length;
    while ((i << 1) + 1 < len) {
      let left = (i << 1) + 1;
      let right = left + 1;
      let smallest = (right < len && this.heap[right].val < this.heap[left].val) ? right : left;
      if (this.heap[smallest].val < this.heap[i].val) {
        const tmp = this.heap[smallest]; this.heap[smallest] = this.heap[i]; this.heap[i] = tmp;
        i = smallest;
      } else break;
    }
  }
}

const t0 = Date.now();
for (let q = 0; q < 1000; q++) {
  const heap = new MinHeap(200);
  for (let i = 0; i < 20000; i++) {
    heap.push(i, arr[i]);
  }
}
console.log('1,000 queries with MinHeap on 20,000 items took:', Date.now() - t0, 'ms');
