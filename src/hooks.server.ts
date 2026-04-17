import TypeOrm from '$lib/db';
import { ensureAdminSeeded } from '$lib/server/auth/bootstrap';
import { AUTH_COOKIE, authCookieOptions, signJwt, verifyJwt } from '$lib/server/auth/jwt';
import { User } from '$lib/entities/User';
import { redirect, type Handle } from '@sveltejs/kit';
import 'reflect-metadata';

await TypeOrm.getDb();
await ensureAdminSeeded();

const PUBLIC_PATHS = new Set(['/login']);
const PUBLIC_PREFIXES = ['/api/auth/login', '/api/auth/logout', '/api/auth/backdrops'];
const STATIC_PREFIXES = [
	'/favicon',
	'/icons/',
	'/apple-touch-icon',
	'/manifest.webmanifest',
	'/logo_',
	'/_app/',
	'/@fs/',
	'/src/',
	'/node_modules/'
];

function isPublic(pathname: string): boolean {
	if (PUBLIC_PATHS.has(pathname)) return true;
	if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
	if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
	return false;
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;

	const token = event.cookies.get(AUTH_COOKIE);
	const claims = token ? await verifyJwt(token) : null;
	if (claims) {
		const user = await User.findOne({ where: { id: claims.sub } });
		if (user && user.tokenVersion === claims.v) {
			event.locals.user = {
				id: user.id,
				username: user.username,
				isAdmin: user.isAdmin,
				tokenVersion: user.tokenVersion,
				mode: (user as any).mode ?? null
			};

			if (claims.iat && Date.now() / 1000 - claims.iat > 60 * 60 * 24 * 7) {
				const fresh = await signJwt({ sub: user.id, v: user.tokenVersion });
				event.cookies.set(AUTH_COOKIE, fresh, authCookieOptions());
			}
		}
	}

	if (!event.locals.user && !isPublic(event.url.pathname)) {
		throw redirect(303, '/login');
	}

	return resolve(event);
};
