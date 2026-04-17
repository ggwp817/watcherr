import { json, type RequestHandler } from '@sveltejs/kit';
import { Settings } from '$lib/entities/Settings';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const PINNED_FIRST = 'https://image.tmdb.org/t/p/original/2rmK7mnchw9Xr3XdiTFSxTTLXqv.jpg';

export const GET: RequestHandler = async () => {
	const s = await Settings.get();
	const key = s.tmdb?.apiKey || process.env.TMDB_API_KEY || (import.meta.env.VITE_TMDB_API_KEY as string | undefined) || '';
	if (!key) return json({ backdrops: [PINNED_FIRST] });

	try {
		const r = await fetch(`${TMDB_BASE}/trending/all/week?language=en-US`, {
			headers: { Authorization: `Bearer ${key}` }
		});
		if (!r.ok) return json({ backdrops: [PINNED_FIRST] });
		const body = (await r.json()) as { results?: Array<{ backdrop_path?: string | null }> };
		const trending = (body.results ?? [])
			.map((it) => it.backdrop_path)
			.filter((p): p is string => !!p)
			.map((p) => `https://image.tmdb.org/t/p/original${p}`);
		const backdrops = [PINNED_FIRST, ...trending.filter((u) => u !== PINNED_FIRST)].slice(0, 18);
		return json({ backdrops });
	} catch {
		return json({ backdrops: [PINNED_FIRST] });
	}
};
