import { json, type RequestHandler } from '@sveltejs/kit';
import { Request as RequestEntity } from '$lib/entities/Request';
import { User } from '$lib/entities/User';

export const POST: RequestHandler = async (event) => {
	const caller = event.locals.user;
	if (!caller) return json({ error: 'Unauthenticated' }, { status: 401 });

	const body = (await event.request.json().catch(() => null)) as
		| {
				tmdbId?: number;
				type?: 'movie' | 'series';
				profileId?: number | null;
				asUserId?: string;
		  }
		| null;

	const tmdbId = Number(body?.tmdbId);
	const type = body?.type;
	if (!tmdbId || !Number.isFinite(tmdbId) || (type !== 'movie' && type !== 'series')) {
		return json({ error: 'tmdbId + type (movie|series) required' }, { status: 400 });
	}

	let requesterId = caller.id;
	let requesterName = caller.username;

	if (body?.asUserId && body.asUserId !== caller.id) {
		if (!caller.isAdmin) {
			return json({ error: 'Only admins can attribute requests to others' }, { status: 403 });
		}
		const target = await User.findOne({ where: { id: body.asUserId } });
		if (!target) return json({ error: 'Target user not found' }, { status: 404 });
		requesterId = target.id;
		requesterName = target.username;
	}

	const row = new RequestEntity();
	row.userId = requesterId;
	row.username = requesterName;
	row.tmdbId = tmdbId;
	row.type = type;
	row.profileId = body?.profileId ?? null;
	await row.save();

	return json({ ok: true, id: row.id });
};
