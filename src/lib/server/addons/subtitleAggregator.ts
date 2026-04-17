import { Addon } from '$lib/entities/Addon';
import { cacheGet, cacheSet } from './streamCache';
import { signSubtitleToken } from './subtitleToken';
import type { AddonError, NormalizedSubtitle, RawStremioSubtitle } from './types';

const TTL_MS = 10 * 60 * 1000;
const ADDON_TIMEOUT_MS = 8_000;
const SUBTITLE_TOKEN_TTL = 60 * 60;

export interface SubtitleAggregation {
	subtitles: NormalizedSubtitle[];
	errors: AddonError[];
}

export async function aggregateSubtitles(
	stremioId: string,
	type: 'movie' | 'series',
	proxyBaseUrl: string
): Promise<SubtitleAggregation> {
	const cacheKey = `sub:${type}:${stremioId}`;
	const hit = cacheGet<SubtitleAggregation>(cacheKey);
	if (hit) return hit;

	const addons = await Addon.find({
		where: { enabled: true },
		order: { sortOrder: 'ASC', createdAt: 'ASC' }
	});
	const subAddons = addons.filter(
		(a) => a.resources.includes('subtitles') && a.types.includes(type)
	);

	const results = await Promise.allSettled(
		subAddons.map((a) => queryOne(a, stremioId, type, proxyBaseUrl))
	);

	const subtitles: NormalizedSubtitle[] = [];
	const errors: AddonError[] = [];
	const seen = new Set<string>();

	results.forEach((r, idx) => {
		const addon = subAddons[idx];
		if (r.status === 'rejected') {
			errors.push({
				addon: addon.name,
				error: r.reason instanceof Error ? r.reason.message : String(r.reason)
			});
			return;
		}
		for (const s of r.value) {
			if (seen.has(s.id)) continue;
			seen.add(s.id);
			subtitles.push(s);
		}
	});

	const aggregation: SubtitleAggregation = { subtitles, errors };
	cacheSet(cacheKey, aggregation, TTL_MS);
	return aggregation;
}

async function queryOne(
	addon: Addon,
	stremioId: string,
	type: 'movie' | 'series',
	proxyBaseUrl: string
): Promise<NormalizedSubtitle[]> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ADDON_TIMEOUT_MS);
	try {
		const url = `${addon.baseUrl}/subtitles/${type}/${encodeURIComponent(stremioId)}.json`;
		const res = await fetch(url, { signal: controller.signal });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = (await res.json()) as { subtitles?: RawStremioSubtitle[] };
		if (!data.subtitles || !Array.isArray(data.subtitles)) return [];
		const out: NormalizedSubtitle[] = [];
		for (const s of data.subtitles) {
			if (!s.url) continue;
			const id = (s.id ?? s.url).toString();
			const token = await signSubtitleToken(s.url, SUBTITLE_TOKEN_TTL);
			const lang = (s.lang ?? 'en').toString();
			out.push({
				id,
				url: `${proxyBaseUrl}/api/subtitles/proxy?token=${encodeURIComponent(token)}`,
				lang,
				label: lang.toUpperCase(),
				source: addon.name
			});
		}
		return out;
	} finally {
		clearTimeout(timer);
	}
}
