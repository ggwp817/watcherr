import { error, json, type RequestHandler } from '@sveltejs/kit';
import { User } from '$lib/entities/User';
import { requireAdmin } from '$lib/server/auth/requireAdmin';

async function loadOr404(id: string): Promise<User> {
	const u = await User.findOne({ where: { id } });
	if (!u) throw error(404, 'User not found');
	return u;
}

async function countAdmins(): Promise<number> {
	return User.count({ where: { isAdmin: true } });
}

export const PATCH: RequestHandler = async (event) => {
	requireAdmin(event);
	const id = event.params.id!;
	const user = await loadOr404(id);
	const body = (await event.request.json().catch(() => null)) as
		| { username?: string; isAdmin?: boolean; jellyfinUserId?: string | null }
		| null;
	if (!body) return json({ error: 'Bad request' }, { status: 400 });

	if (body.username !== undefined) {
		const next = body.username.trim().toLowerCase();
		if (!/^[a-z0-9_.-]{3,32}$/.test(next)) {
			return json({ error: 'Invalid username.' }, { status: 400 });
		}
		if (next !== user.username) {
			const clash = await User.findOne({ where: { username: next } });
			if (clash) return json({ error: 'Username taken.' }, { status: 409 });
		}
		user.username = next;
	}

	if (body.isAdmin !== undefined && body.isAdmin !== user.isAdmin) {
		if (!body.isAdmin && user.id === event.locals.user!.id) {
			return json({ error: 'Cannot demote yourself.' }, { status: 400 });
		}
		if (!body.isAdmin && user.isAdmin && (await countAdmins()) <= 1) {
			return json({ error: 'Cannot demote the last admin.' }, { status: 400 });
		}
		user.isAdmin = body.isAdmin;
	}

	let jellyfinLinkChanged = false;
	if (body.jellyfinUserId !== undefined && body.jellyfinUserId !== user.jellyfinUserId) {
		user.jellyfinUserId = body.jellyfinUserId;
		jellyfinLinkChanged = true;
	}

	await user.save();

	return json({
		ok: true,
		jellyfinLinkChanged,
		note: jellyfinLinkChanged
			? 'Jellyfin link updated. Use Reset Password to set the password on the new Jellyfin account.'
			: null
	});
};

export const DELETE: RequestHandler = async (event) => {
	requireAdmin(event);
	const id = event.params.id!;
	const user = await loadOr404(id);
	if (user.id === event.locals.user!.id) {
		return json({ error: 'Cannot delete yourself.' }, { status: 400 });
	}
	if (user.isAdmin && (await countAdmins()) <= 1) {
		return json({ error: 'Cannot delete the last admin.' }, { status: 400 });
	}
	await user.remove();
	return json({ ok: true });
};
