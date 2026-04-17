import { json, type RequestHandler } from '@sveltejs/kit';
import { User } from '$lib/entities/User';
import { requireAdmin } from '$lib/server/auth/requireAdmin';
import { hashPassword } from '$lib/server/auth/password';
import { syncJellyfinPassword } from '$lib/server/jellyfin/passwordSync';

function sanitize(u: User) {
	return {
		id: u.id,
		username: u.username,
		isAdmin: u.isAdmin,
		jellyfinUserId: u.jellyfinUserId,
		lastLoginAt: u.lastLoginAt,
		tokenVersion: u.tokenVersion
	};
}

export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const users = await User.find({ order: { username: 'ASC' } });
	return json(users.map(sanitize));
};

export const POST: RequestHandler = async (event) => {
	requireAdmin(event);
	const body = (await event.request.json().catch(() => null)) as
		| { username?: string; password?: string; isAdmin?: boolean; jellyfinUserId?: string | null }
		| null;

	const username = (body?.username ?? '').trim().toLowerCase();
	const password = body?.password ?? '';
	if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
		return json(
			{ error: 'Username must be 3-32 chars, lowercase letters/digits/._-' },
			{ status: 400 }
		);
	}
	if (password.length < 8) {
		return json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
	}

	const existing = await User.findOne({ where: { username } });
	if (existing) return json({ error: 'Username already taken.' }, { status: 409 });

	const user = new User();
	user.username = username;
	user.passwordHash = await hashPassword(password);
	user.isAdmin = !!body?.isAdmin;
	user.tokenVersion = 0;
	user.lastLoginAt = null;
	user.jellyfinUserId = body?.jellyfinUserId ?? null;
	user.jellyfinAuthToken = null;
	user.preferences = null;
	await user.save();

	let jellyfinSynced: boolean | null = null;
	if (user.jellyfinUserId) {
		jellyfinSynced = await syncJellyfinPassword(user.jellyfinUserId, password);
	}

	return json({ user: sanitize(user), jellyfinSynced });
};
