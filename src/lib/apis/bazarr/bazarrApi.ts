import { getBazarrApiKey, getBazarrBaseUrl } from './config';

export type BazarrMediaKind = 'episode' | 'movie';
export type BazarrLanguage = 'en' | 'ar';

export type BazarrEpisodeRef = { kind: 'episode'; seriesId: number; episodeId: number };
export type BazarrMovieRef = { kind: 'movie'; radarrId: number };
export type BazarrRef = BazarrEpisodeRef | BazarrMovieRef;

async function bazarrFetch(path: string, init?: RequestInit): Promise<Response> {
	const apiKey = getBazarrApiKey();
	const baseUrl = getBazarrBaseUrl();
	if (!apiKey) throw new Error('Bazarr API key not configured');
	return fetch(`${baseUrl}${path}`, {
		...init,
		headers: {
			'X-API-KEY': apiKey,
			...(init?.headers ?? {})
		}
	});
}

function pathsMatch(a: string | null | undefined, b: string): boolean {
	if (!a) return false;
	if (a === b) return true;
	const tailA = a.split('/').slice(-2).join('/');
	const tailB = b.split('/').slice(-2).join('/');
	return tailA === tailB;
}

/**
 * Resolve Bazarr's internal ids for a media file by matching path against
 * Bazarr's series/episodes/movies tables. Returns null if not found.
 *
 * Episode flow: GET /series -> find matching series directory -> GET /episodes?seriesid[]=X -> find episode by path.
 * Movie flow: GET /movies -> find movie by path.
 */
export async function findBazarrRef(
	kind: BazarrMediaKind,
	filePath: string
): Promise<BazarrRef | null> {
	if (kind === 'movie') {
		const r = await bazarrFetch('/api/movies?start=0&length=-1');
		if (!r.ok) {
			console.warn('[bazarr] movies list failed', r.status);
			return null;
		}
		const rows = ((await r.json()) as { data?: Array<{ radarrId: number; path: string }> }).data ?? [];
		const match = rows.find((row) => pathsMatch(row.path, filePath));
		if (!match) {
			console.warn('[bazarr] no movie match for', filePath);
			return null;
		}
		return { kind: 'movie', radarrId: match.radarrId };
	}

	const seriesRes = await bazarrFetch('/api/series?start=0&length=-1');
	if (!seriesRes.ok) {
		console.warn('[bazarr] series list failed', seriesRes.status);
		return null;
	}
	const seriesRows =
		((await seriesRes.json()) as { data?: Array<{ sonarrSeriesId: number; path: string }> })
			.data ?? [];
	const series = seriesRows.find((s) => s.path && filePath.startsWith(s.path + '/'));
	if (!series) {
		console.warn('[bazarr] no series path prefix matches', filePath);
		return null;
	}

	const epRes = await bazarrFetch(
		`/api/episodes?seriesid%5B%5D=${encodeURIComponent(String(series.sonarrSeriesId))}`
	);
	if (!epRes.ok) {
		console.warn('[bazarr] episodes list failed', epRes.status);
		return null;
	}
	const epRows =
		((await epRes.json()) as { data?: Array<{ sonarrEpisodeId: number; path: string }> }).data ??
		[];
	const ep = epRows.find((e) => pathsMatch(e.path, filePath));
	if (!ep) {
		console.warn('[bazarr] no episode match for', filePath);
		return null;
	}
	return {
		kind: 'episode',
		seriesId: series.sonarrSeriesId,
		episodeId: ep.sonarrEpisodeId
	};
}

/**
 * Upload an already-downloaded subtitle file to Bazarr.
 * Bazarr places it alongside the media with correct naming and triggers Sonarr/Radarr sync.
 */
export async function uploadSubtitleFile(
	ref: BazarrRef,
	language: BazarrLanguage,
	content: Blob,
	filename: string
): Promise<void> {
	const params = new URLSearchParams({ language, forced: 'False', hi: 'False' });
	let path: string;
	if (ref.kind === 'episode') {
		params.set('seriesid', String(ref.seriesId));
		params.set('episodeid', String(ref.episodeId));
		path = `/api/episodes/subtitles?${params.toString()}`;
	} else {
		params.set('radarrid', String(ref.radarrId));
		path = `/api/movies/subtitles?${params.toString()}`;
	}
	const form = new FormData();
	form.append('file', content, filename);
	const r = await bazarrFetch(path, { method: 'POST', body: form });
	if (!r.ok && r.status !== 204) {
		throw new Error(`Bazarr upload ${language} failed: ${r.status}`);
	}
}

/**
 * Trigger Bazarr to search for and download subtitles in the given languages.
 * Uses PATCH with all params in the query string (the documented search trigger).
 * POST on these endpoints is for direct file uploads.
 */
/**
 * Run ffsubsync on a just-uploaded subtitle so it aligns with the video's audio.
 * Looks up the subtitle path from Bazarr, then PATCHes /api/subtitles with action=sync.
 * Framerate fix is left ON — PAL↔NTSC drift (1.04x stretch) is the main reason AR subs drift.
 */
export async function syncSubtitle(
	ref: BazarrRef,
	language: BazarrLanguage
): Promise<void> {
	let subsPath: string | null = null;
	let mediaPath: string | null = null;
	let idVal: number;
	let type: 'episode' | 'movie';

	const pickSubPath = (subs: unknown): string | null => {
		if (!Array.isArray(subs)) return null;
		for (const s of subs) {
			const code = Array.isArray(s) ? s[0] : (s as any)?.code2;
			const p = Array.isArray(s) ? s[1] : (s as any)?.path;
			if (code === language && typeof p === 'string' && p.length > 0) return p;
		}
		return null;
	};

	if (ref.kind === 'episode') {
		const r = await bazarrFetch(
			`/api/episodes?seriesid%5B%5D=${encodeURIComponent(String(ref.seriesId))}`
		);
		if (!r.ok) return;
		const rows = ((await r.json()) as { data?: any[] }).data ?? [];
		const ep = rows.find((e: any) => e.sonarrEpisodeId === ref.episodeId);
		if (!ep) return;
		mediaPath = ep.path;
		subsPath = pickSubPath(ep.subtitles);
		idVal = ref.episodeId;
		type = 'episode';
	} else {
		const r = await bazarrFetch(
			`/api/movies?radarrid%5B%5D=${encodeURIComponent(String(ref.radarrId))}`
		);
		if (!r.ok) return;
		const rows = ((await r.json()) as { data?: any[] }).data ?? [];
		const mv = rows[0];
		if (!mv) return;
		mediaPath = mv.path;
		subsPath = pickSubPath(mv.subtitles);
		idVal = ref.radarrId;
		type = 'movie';
	}

	if (!subsPath || !mediaPath) return;

	const params = new URLSearchParams({
		action: 'sync',
		language,
		path: subsPath,
		type,
		id: String(idVal),
		reference: mediaPath,
		max_offset_seconds: '60',
		no_fix_framerate: 'False',
		gss: 'False'
	});
	const r = await bazarrFetch(`/api/subtitles?${params.toString()}`, { method: 'PATCH' });
	if (!r.ok && r.status !== 202 && r.status !== 204) {
		console.warn('[bazarr] ffsubsync failed', language, r.status);
	}
}

export async function requestBazarrSubtitles(
	ref: BazarrRef,
	languages: BazarrLanguage[]
): Promise<void> {
	await Promise.all(
		languages.map(async (lang) => {
			const params = new URLSearchParams({
				language: lang,
				forced: 'False',
				hi: 'False'
			});
			let path: string;
			if (ref.kind === 'episode') {
				params.set('seriesid', String(ref.seriesId));
				params.set('episodeid', String(ref.episodeId));
				path = `/api/episodes/subtitles?${params.toString()}`;
			} else {
				params.set('radarrid', String(ref.radarrId));
				path = `/api/movies/subtitles?${params.toString()}`;
			}
			const r = await bazarrFetch(path, { method: 'PATCH' });
			if (!r.ok && r.status !== 202 && r.status !== 204) {
				console.warn('[bazarr] subtitle search failed', lang, r.status);
				throw new Error(`Bazarr ${lang} search failed: ${r.status}`);
			}
		})
	);
}
