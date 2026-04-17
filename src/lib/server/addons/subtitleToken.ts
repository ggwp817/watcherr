import crypto from 'node:crypto';
import { getSessionSecret } from '../auth/sessionSecret';

interface TokenPayload {
	upstreamUrl: string;
	exp: number;
}

function base64url(input: Buffer | string): string {
	return Buffer.from(input)
		.toString('base64')
		.replace(/=+$/, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
}

function fromBase64url(input: string): Buffer {
	const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
	return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

async function hmac(data: string): Promise<string> {
	const secret = await getSessionSecret();
	return base64url(crypto.createHmac('sha256', secret).update(data).digest());
}

export async function signSubtitleToken(
	upstreamUrl: string,
	ttlSeconds: number
): Promise<string> {
	const payload: TokenPayload = {
		upstreamUrl,
		exp: Math.floor(Date.now() / 1000) + ttlSeconds
	};
	const body = base64url(JSON.stringify(payload));
	const sig = await hmac(body);
	return `${body}.${sig}`;
}

export async function verifySubtitleToken(
	token: string
): Promise<TokenPayload | null> {
	if (!token || typeof token !== 'string') return null;
	const parts = token.split('.');
	if (parts.length !== 2) return null;
	const [body, sig] = parts;
	const expected = await hmac(body);
	const a = Buffer.from(sig);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
	try {
		const payload = JSON.parse(fromBase64url(body).toString('utf8')) as TokenPayload;
		if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
			return null;
		}
		if (typeof payload.upstreamUrl !== 'string') return null;
		return payload;
	} catch {
		return null;
	}
}
