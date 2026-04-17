import { error, json, type RequestHandler } from '@sveltejs/kit';
import { User } from '$lib/entities/User';
import { requireAdmin } from '$lib/server/auth/requireAdmin';
import { syncJellyfinPassword } from '$lib/server/jellyfin/passwordSync';

export const POST: RequestHandler = async (event) => {
	requireAdmin(event);
	const user = await User.findOne({ where: { id: event.params.id! } });
	if (!user) throw error(404, 'User not found');
	if (!user.jellyfinUserId) {
		return json({ error: 'User is not linked to Jellyfin.' }, { status: 400 });
	}
	const body = (await event.request.json().catch(() => null)) as { password?: string } | null;
	const pw = body?.password ?? '';
	if (pw.length < 8) {
		return json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
	}

	const ok = await syncJellyfinPassword(user.jellyfinUserId, pw);
	return json({ ok, jellyfinSynced: ok });
};
