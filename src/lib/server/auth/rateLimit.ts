const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, number[]>();

export function checkLoginRateLimit(ip: string): boolean {
	const now = Date.now();
	const list = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
	if (list.length >= MAX_ATTEMPTS) {
		attempts.set(ip, list);
		return false;
	}
	list.push(now);
	attempts.set(ip, list);
	return true;
}

export function _resetRateLimit(): void {
	attempts.clear();
}
