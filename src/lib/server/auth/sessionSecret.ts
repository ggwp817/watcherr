import { randomBytes } from 'node:crypto';
import { AppConfig } from '$lib/entities/AppConfig';
import TypeOrm from '$lib/db';

const KEY = 'session_secret';
let cached: string | null = null;

/**
 * Returns the HMAC secret used to sign JWTs.
 * Precedence: process.env.SESSION_SECRET > DB row > generate + persist.
 */
export async function getSessionSecret(): Promise<string> {
	if (cached) return cached;

	const envSecret = process.env.SESSION_SECRET;
	if (envSecret && envSecret.length >= 16) {
		cached = envSecret;
		return cached;
	}

	await TypeOrm.getDb();
	const existing = await AppConfig.findOne({ where: { key: KEY } });
	if (existing?.value) {
		cached = existing.value;
		return cached;
	}

	const fresh = randomBytes(32).toString('hex');
	const row = new AppConfig();
	row.key = KEY;
	row.value = fresh;
	await row.save();
	cached = fresh;
	return cached;
}
