import jwt from 'jsonwebtoken';
import { getSessionSecret } from './sessionSecret';

export type JwtClaims = {
	sub: string;
	v: number;
	iat?: number;
	exp?: number;
};

const EXPIRES_IN = '30d';
const ISSUER = 'watcherr';

export async function signJwt(claims: Pick<JwtClaims, 'sub' | 'v'>): Promise<string> {
	const secret = await getSessionSecret();
	return jwt.sign(claims, secret, { expiresIn: EXPIRES_IN, issuer: ISSUER, algorithm: 'HS256' });
}

export async function verifyJwt(token: string | undefined | null): Promise<JwtClaims | null> {
	if (!token) return null;
	const secret = await getSessionSecret();
	try {
		const payload = jwt.verify(token, secret, { issuer: ISSUER, algorithms: ['HS256'] });
		if (typeof payload === 'object' && payload && 'sub' in payload && 'v' in payload) {
			return payload as JwtClaims;
		}
		return null;
	} catch {
		return null;
	}
}

export const AUTH_COOKIE = 'watcherr_auth';

export function authCookieOptions() {
	return {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax' as const,
		maxAge: 60 * 60 * 24 * 30
	};
}
