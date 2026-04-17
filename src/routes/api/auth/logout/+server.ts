import { json, type RequestHandler } from '@sveltejs/kit';
import { AUTH_COOKIE } from '$lib/server/auth/jwt';

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete(AUTH_COOKIE, { path: '/' });
	return json({ ok: true });
};
