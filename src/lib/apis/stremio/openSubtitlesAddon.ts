import { getStremioAddonUrl } from './config';

export type StremioSub = {
	sub_id: number;
	lang_code: string;
	title: string;
	url: string;
	ai_translated?: boolean;
	from_trusted?: boolean;
};

type StremioResponse = { subtitles?: StremioSub[] };

export async function searchStremioSubs(
	imdbId: string,
	season?: number | null,
	episode?: number | null
): Promise<StremioSub[]> {
	const addonUrl = getStremioAddonUrl();
	if (!addonUrl) return [];
	const isEpisode = season != null && episode != null;
	const type = isEpisode ? 'series' : 'movie';
	const idPart = isEpisode ? `${imdbId}:${season}:${episode}` : imdbId;
	try {
		const r = await fetch(`${addonUrl}/subtitles/${type}/${idPart}.json`, {
			redirect: 'follow'
		});
		if (!r.ok) return [];
		const data = (await r.json()) as StremioResponse;
		return (data.subtitles ?? []).filter((s) => !s.ai_translated);
	} catch (e) {
		console.warn('[stremio] search failed', e);
		return [];
	}
}

export function pickBestMatch(
	subs: StremioSub[],
	lang: 'ar' | 'en',
	releaseTitle?: string | null
): StremioSub | null {
	const candidates = subs.filter((s) => s.lang_code === lang);
	if (candidates.length === 0) return null;
	if (!releaseTitle) return candidates[0];

	const tokens = releaseTitle
		.toLowerCase()
		.split(/[\s._\-()[\]]+/)
		.filter((t) => t.length >= 3);

	const score = (s: StremioSub) => {
		const t = s.title.toLowerCase();
		let n = 0;
		for (const tok of tokens) if (t.includes(tok)) n++;
		if (s.from_trusted) n += 0.5;
		return n;
	};

	return [...candidates].sort((a, b) => score(b) - score(a))[0];
}

/**
 * Strip the addon's promo banner cue and collapse duplicate WEBVTT headers
 * so the subtitle file we hand to Bazarr contains only real dialog cues.
 */
function sanitizeAddonVtt(text: string): string {
	const parts = text.split(/\n\s*WEBVTT\s*\n/);
	// Keep the last section — the addon prefixes its promo as its own WEBVTT block.
	const body = parts.length > 1 ? parts[parts.length - 1] : text.replace(/^\s*WEBVTT\s*\n/, '');
	return 'WEBVTT\n\n' + body.trimStart();
}

export async function fetchSubContent(sub: StremioSub): Promise<Blob | null> {
	try {
		const r = await fetch(sub.url, { redirect: 'follow' });
		if (!r.ok) return null;
		const text = await r.text();
		const cleaned = sanitizeAddonVtt(text);
		return new Blob([cleaned], { type: 'text/vtt' });
	} catch (e) {
		console.warn('[stremio] download failed', e);
		return null;
	}
}
