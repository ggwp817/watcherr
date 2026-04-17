import { json, type RequestHandler } from '@sveltejs/kit';
import { User } from '$lib/entities/User';
import { LoginEvent } from '$lib/entities/LoginEvent';
import { verifyPassword } from '$lib/server/auth/password';
import { AUTH_COOKIE, authCookieOptions, signJwt } from '$lib/server/auth/jwt';
import { checkLoginRateLimit } from '$lib/server/auth/rateLimit';

function clientIp(req: Request, fallback: string): string {
	const xff = req.headers.get('x-forwarded-for');
	if (xff) return xff.split(',')[0]!.trim();
	return fallback;
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const ip = clientIp(request, getClientAddress());
	if (!checkLoginRateLimit(ip)) {
		return json({ error: 'Too many attempts, try again in a minute.' }, { status: 429 });
	}

	const body = (await request.json().catch(() => null)) as
		| { username?: string; password?: string }
		| null;
	const rawUsername = (body?.username ?? '').trim().toLowerCase();
	const password = body?.password ?? '';

	if (!rawUsername || !password) {
		return json({ error: 'Username and password required.' }, { status: 400 });
	}

	const user = await User.findOne({ where: { username: rawUsername } });
	const ok = user ? await verifyPassword(password, user.passwordHash) : false;

	const evt = new LoginEvent();
	evt.username = rawUsername;
	evt.ip = ip;
	evt.success = ok;
	await evt.save();

	if (!ok || !user) {
		return json({ error: 'Invalid username or password.' }, { status: 401 });
	}

	user.lastLoginAt = new Date();
	await user.save();

	const token = await signJwt({ sub: user.id, v: user.tokenVersion });
	cookies.set(AUTH_COOKIE, token, authCookieOptions());
	return json({ ok: true, isAdmin: user.isAdmin });
};
