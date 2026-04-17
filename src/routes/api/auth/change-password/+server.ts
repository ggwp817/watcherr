import { json, type RequestHandler } from '@sveltejs/kit';
import { User } from '$lib/entities/User';
import { hashPassword, verifyPassword } from '$lib/server/auth/password';
import { syncJellyfinPassword } from '$lib/server/jellyfin/passwordSync';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = (await request.json().catch(() => null)) as
		| { currentPassword?: string; newPassword?: string }
		| null;
	const current = body?.currentPassword ?? '';
	const next = body?.newPassword ?? '';
	if (next.length < 8) {
		return json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
	}

	const user = await User.findOne({ where: { id: locals.user.id } });
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	if (!(await verifyPassword(current, user.passwordHash))) {
		return json({ error: 'Current password is incorrect.' }, { status: 400 });
	}

	user.passwordHash = await hashPassword(next);
	user.tokenVersion = user.tokenVersion + 1;
	await user.save();

	let jellyfinSynced: boolean | null = null;
	if (user.jellyfinUserId) {
		jellyfinSynced = await syncJellyfinPassword(user.jellyfinUserId, next);
	}

	return json({ ok: true, jellyfinSynced });
};
