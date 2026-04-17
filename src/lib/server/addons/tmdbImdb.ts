export async function resolveImdbId(
	tmdbId: number,
	type: 'movie' | 'series'
): Promise<string | null> {
	const { TmdbImdbMap } = await import('$lib/entities/TmdbImdbMap');
	const { Settings } = await import('$lib/entities/Settings');

	const hit = await TmdbImdbMap.findOne({ where: { tmdbId, type } });
	if (hit) return hit.imdbId;

	const settings = await Settings.get();
	const apiKey =
		(settings as any)?.tmdb?.apiKey ||
		process.env.TMDB_API_KEY ||
		(import.meta.env.VITE_TMDB_API_KEY as string | undefined) ||
		'';
	if (!apiKey) {
		console.warn('[tmdbImdb] no TMDB API key configured');
		return null;
	}

	const tmdbType = type === 'series' ? 'tv' : 'movie';
	const url = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/external_ids`;

	let imdbId: string | null = null;
	try {
		const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
		if (!res.ok) {
			console.warn(`[tmdbImdb] ${tmdbType}/${tmdbId} external_ids ${res.status}`);
			return null;
		}
		const data = (await res.json()) as { imdb_id?: string | null };
		imdbId = data.imdb_id && data.imdb_id.length > 0 ? data.imdb_id : null;
	} catch (e) {
		console.warn(`[tmdbImdb] ${tmdbType}/${tmdbId} fetch failed:`, e);
		return null;
	}

	const row = new TmdbImdbMap();
	row.tmdbId = tmdbId;
	row.type = type;
	row.imdbId = imdbId;
	await row.save();
	return imdbId;
}
