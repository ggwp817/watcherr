import { error, json, type RequestHandler } from '@sveltejs/kit';
import { User } from '$lib/entities/User';
import { requireAdmin } from '$lib/server/auth/requireAdmin';

export const POST: RequestHandler = async (event) => {
	requireAdmin(event);
	const user = await User.findOne({ where: { id: event.params.id! } });
	if (!user) throw error(404, 'User not found');
	user.tokenVersion = user.tokenVersion + 1;
	await user.save();
	return json({ ok: true });
};
