interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): unknown | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: unknown, ttlSeconds = 300): void {
    // Evict oldest entries if at capacity
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  clear(): void {
    this.store.clear();
  }
}

export const cache = new MemoryCache();
