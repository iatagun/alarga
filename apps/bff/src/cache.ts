// ponytail: süreç-içi Map önbelleği; tek makinede yeter. Çok instance'a çıkarsak
// Redis (Upstash) ile değiştir — arayüz aynı kalır.

interface Entry<T> {
  value: T;
  /** Epoch ms — bu andan sonra veri bayat sayılır. */
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export interface Cached<T> {
  value: T;
  expiresAt: number;
  stale: boolean;
}

/**
 * `key` için önbellekten getirir; yoksa/bozuksa `load` çağırır.
 * Bayat kayıt varsa ve `load` hata verirse bayat kaydı döndürür (deniz > boş ekran).
 */
export async function getOrLoad<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<Cached<T>> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) {
    return { value: hit.value, expiresAt: hit.expiresAt, stale: false };
  }
  try {
    const value = await load();
    const expiresAt = now + ttlMs;
    store.set(key, { value, expiresAt });
    return { value, expiresAt, stale: false };
  } catch (err) {
    if (hit) {
      return { value: hit.value, expiresAt: hit.expiresAt, stale: true };
    }
    throw err;
  }
}
