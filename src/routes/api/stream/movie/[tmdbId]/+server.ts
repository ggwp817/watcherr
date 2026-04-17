import { json, type RequestHandler } from '@sveltejs/kit';
import { resolveImdbId } from '$lib/server/addons/tmdbImdb';
import { aggregateStreams } from '$lib/server/addons/streamAggregator';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthenticated' }, { status: 401 });

	const tmdbId = Number(event.params.tmdbId);
	if (!tmdbId || !Number.isFinite(tmdbId)) {
		return json({ error: 'tmdbId required' }, { status: 400 });
	}

	const imdbId = await resolveImdbId(tmdbId, 'movie');
	if (!imdbId) {
		return json({
			streams: [],
			errors: [{ addon: 'tmdb', error: 'No IMDB ID for this title' }]
		});
	}

	const result = await aggregateStreams(imdbId, 'movie');
	return json(result);
};
