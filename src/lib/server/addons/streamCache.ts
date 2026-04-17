interface Entry<T> {
	value: T;
	expiresAt: number;
}

const CACHE_MAX = 500;
const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
	const hit = store.get(key);
	if (!hit) return undefined;
	if (hit.expiresAt < Date.now()) {
		store.delete(key);
		return undefined;
	}
	return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
	if (store.size >= CACHE_MAX) {
		const firstKey = store.keys().next().value;
		if (firstKey !== undefined) store.delete(firstKey);
	}
	store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
