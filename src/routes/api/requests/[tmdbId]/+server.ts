import { json, type RequestHandler } from '@sveltejs/kit';
import { Request as RequestEntity } from '$lib/entities/Request';

export const GET: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return json({ error: 'Unauthenticated' }, { status: 401 });

	const tmdbId = Number(event.params.tmdbId);
	const type = event.url.searchParams.get('type');
	if (!tmdbId || (type !== 'movie' && type !== 'series')) {
		return json({ error: 'tmdbId + type (movie|series) required' }, { status: 400 });
	}

	const rows = await RequestEntity.find({
		where: { tmdbId, type },
		order: { requestedAt: 'DESC' }
	});

	const uniqueUsers = new Map<string, { username: string; requestedAt: Date }>();
	for (const r of rows) {
		if (!uniqueUsers.has(r.userId)) {
			uniqueUsers.set(r.userId, { username: r.username, requestedAt: r.requestedAt });
		}
	}
	const requesters = Array.from(uniqueUsers.values());

	return json({
		count: rows.length,
		uniqueCount: requesters.length,
		latest: requesters[0] ?? null,
		requesters: user.isAdmin ? requesters : requesters.slice(0, 3)
	});
};
