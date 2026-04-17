import { json, type RequestHandler } from '@sveltejs/kit';
import { resolveImdbId } from '$lib/server/addons/tmdbImdb';
import { aggregateSubtitles } from '$lib/server/addons/subtitleAggregator';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthenticated' }, { status: 401 });

	const tmdbId = Number(event.params.tmdbId);
	if (!tmdbId || !Number.isFinite(tmdbId)) {
		return json({ error: 'tmdbId required' }, { status: 400 });
	}

	const imdbId = await resolveImdbId(tmdbId, 'movie');
	if (!imdbId) return json({ subtitles: [], errors: [] });

	const result = await aggregateSubtitles(imdbId, 'movie', event.url.origin);
	return json(result);
};
