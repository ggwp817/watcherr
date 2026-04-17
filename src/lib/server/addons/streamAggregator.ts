import { Addon } from '$lib/entities/Addon';
import { normalizeStream } from './streamNormalizer';
import { cacheGet, cacheSet } from './streamCache';
import type { AddonError, NormalizedStream, RawStremioStream } from './types';

const TTL_MS = 5 * 60 * 1000;
const ADDON_TIMEOUT_MS = 8_000;

const qualityRank: Record<NormalizedStream['quality'], number> = {
	'4k': 4,
	'1080p': 3,
	'720p': 2,
	'480p': 1,
	unknown: 0
};

export interface StreamAggregation {
	streams: NormalizedStream[];
	errors: AddonError[];
}

export async function aggregateStreams(
	stremioId: string,
	type: 'movie' | 'series'
): Promise<StreamAggregation> {
	const cacheKey = `stream:${type}:${stremioId}`;
	const hit = cacheGet<StreamAggregation>(cacheKey);
	if (hit) return hit;

	const addons = await Addon.find({
		where: { enabled: true },
		order: { sortOrder: 'ASC', createdAt: 'ASC' }
	});
	const streamAddons = addons.filter(
		(a) => a.resources.includes('stream') && a.types.includes(type)
	);

	const results = await Promise.allSettled(
		streamAddons.map((a) => queryOne(a, stremioId, type))
	);

	const streams: NormalizedStream[] = [];
	const errors: AddonError[] = [];
	const seen = new Set<string>();

	results.forEach((r, idx) => {
		const addon = streamAddons[idx];
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
			streams.push(s);
		}
	});

	streams.sort((a, b) => {
		const q = qualityRank[b.quality] - qualityRank[a.quality];
		if (q !== 0) return q;
		const sz = (b.size ?? 0) - (a.size ?? 0);
		if (sz !== 0) return sz;
		return (b.seeders ?? 0) - (a.seeders ?? 0);
	});

	const aggregation: StreamAggregation = { streams, errors };
	cacheSet(cacheKey, aggregation, TTL_MS);
	return aggregation;
}

async function queryOne(
	addon: Addon,
	stremioId: string,
	type: 'movie' | 'series'
): Promise<NormalizedStream[]> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ADDON_TIMEOUT_MS);
	try {
		const url = `${addon.baseUrl}/stream/${type}/${encodeURIComponent(stremioId)}.json`;
		const res = await fetch(url, { signal: controller.signal });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = (await res.json()) as { streams?: RawStremioStream[] };
		if (!data.streams || !Array.isArray(data.streams)) return [];
		return data.streams
			.map((s) => normalizeStream(s, addon.name))
			.filter((s): s is NormalizedStream => s !== null);
	} finally {
		clearTimeout(timer);
	}
}
