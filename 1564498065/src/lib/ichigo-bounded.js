/**
 * Helper struktur data dengan batas ukuran supaya memori tidak naik terus.
 */

/**
 * Set ke Map dengan batas ukuran (FIFO/LRU: yang paling lama tidak disentuh dibuang).
 * Key yang di-set ulang dipindah ke posisi paling baru.
 */
export function setBounded(map, key, value, max = 1000) {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  while (map.size > max) {
    const oldest = map.keys().next().value;
    map.delete(oldest);
  }
  return map;
}

/**
 * Get dari Map sambil menandai key sebagai "baru dipakai" (LRU).
 */
export function getTouch(map, key) {
  if (!map.has(key)) return undefined;
  const v = map.get(key);
  map.delete(key);
  map.set(key, v);
  return v;
}

/**
 * Object biasa (kompatibel dengan Object.keys/entries, obj[key], obj[key] = v)
 * tapi jumlah key dibatasi. Saat melebihi `max` (+10% toleransi), key yang
 * paling lama ditulis dibuang sampai kembali ke `max`.
 * Menulis ulang key yang sudah ada memindahkannya jadi yang paling baru.
 */
export function createBoundedObject(max = 5000) {
  const target = {};
  let count = 0;
  const slack = Math.max(1, Math.floor(max * 0.1));
  const has = (k) => Object.prototype.hasOwnProperty.call(target, k);

  return new Proxy(target, {
    set(t, k, v) {
      if (typeof k !== "string") {
        t[k] = v;
        return true;
      }
      if (has(k)) {
        delete t[k];
        count--;
      }
      t[k] = v;
      count++;
      if (count > max + slack) {
        for (const key in t) {
          if (count <= max) break;
          delete t[key];
          count--;
        }
      }
      return true;
    },
    deleteProperty(t, k) {
      if (typeof k === "string" && has(k)) count--;
      return delete t[k];
    },
  });
}
