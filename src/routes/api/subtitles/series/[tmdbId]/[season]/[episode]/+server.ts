import { json, type RequestHandler } from '@sveltejs/kit';
import { resolveImdbId } from '$lib/server/addons/tmdbImdb';
import { aggregateSubtitles } from '$lib/server/addons/subtitleAggregator';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthenticated' }, { status: 401 });

	const tmdbId = Number(event.params.tmdbId);
	const season = Number(event.params.season);
	const episode = Number(event.params.episode);
	if (
		!tmdbId ||
		!Number.isFinite(tmdbId) ||
		!Number.isFinite(season) ||
		!Number.isFinite(episode)
	) {
		return json({ error: 'tmdbId, season, episode required' }, { status: 400 });
	}

	const imdbId = await resolveImdbId(tmdbId, 'series');
	if (!imdbId) return json({ subtitles: [], errors: [] });

	const stremioId = `${imdbId}:${season}:${episode}`;
	const result = await aggregateSubtitles(stremioId, 'series', event.url.origin);
	return json(result);
};
