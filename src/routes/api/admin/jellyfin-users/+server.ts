import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/requireAdmin';
import { listJellyfinUsers } from '$lib/server/jellyfin/adminClient';

export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const users = await listJellyfinUsers();
	return json(users.map((u) => ({ id: u.Id, name: u.Name })));
};
