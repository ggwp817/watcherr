import { error, json, type RequestHandler } from '@sveltejs/kit';
import { User } from '$lib/entities/User';
import { requireAdmin } from '$lib/server/auth/requireAdmin';
import { hashPassword } from '$lib/server/auth/password';
import { syncJellyfinPassword } from '$lib/server/jellyfin/passwordSync';

export const POST: RequestHandler = async (event) => {
	requireAdmin(event);
	const user = await User.findOne({ where: { id: event.params.id! } });
	if (!user) throw error(404, 'User not found');

	const body = (await event.request.json().catch(() => null)) as { newPassword?: string } | null;
	const next = body?.newPassword ?? '';
	if (next.length < 8) {
		return json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
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
