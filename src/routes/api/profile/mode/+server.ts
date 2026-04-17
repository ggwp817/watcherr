import { json, type RequestHandler } from '@sveltejs/kit';
import { User } from '$lib/entities/User';

export const PATCH: RequestHandler = async (event) => {
	const caller = event.locals.user;
	if (!caller) return json({ error: 'Unauthenticated' }, { status: 401 });

	const body = (await event.request.json().catch(() => null)) as
		| { mode?: 'request' | 'online' }
		| null;

	if (body?.mode !== 'request' && body?.mode !== 'online') {
		return json({ error: 'mode must be "request" or "online"' }, { status: 400 });
	}

	const user = await User.findOne({ where: { id: caller.id } });
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	(user as any).mode = body.mode;
	await user.save();

	return json({ ok: true, mode: body.mode });
};
