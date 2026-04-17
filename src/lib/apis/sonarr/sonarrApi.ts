import type { components, paths } from '$lib/apis/sonarr/sonarr.generated';
import { settings } from '$lib/stores/settings.store';
import { log } from '$lib/utils';
import axios from 'axios';
import createClient from 'openapi-fetch';
import { get } from 'svelte/store';
import { getTmdbSeries } from '../tmdb/tmdbApi';

export type SonarrSeries = components['schemas']['SeriesResource'];
export type SonarrReleaseResource = components['schemas']['ReleaseResource'];
export type SonarrDownload = components['schemas']['QueueResource'] & { series: SonarrSeries };
export type DiskSpaceInfo = components['schemas']['DiskSpaceResource'];
export type SonarrEpisode = components['schemas']['EpisodeResource'];

export interface SonarrSeriesOptions {
	title: string;
	qualityProfileId: number;
	languageProfileId: number;
	seasonFolder: boolean;
	monitored: boolean;
	tvdbId: number;
	rootFolderPath: string;
	addOptions: {
		monitor:
		| 'unknown'
		| 'all'
		| 'future'
		| 'missing'
		| 'existing'
		| 'firstSeason'
		| 'latestSeason'
		| 'pilot'
		| 'monitorSpecials'
		| 'unmonitorSpecials'
		| 'none';
		searchForMissingEpisodes: boolean;
		searchForCutoffUnmetEpisodes: boolean;
	};
}

function getSonarrApi() {
	const baseUrl = get(settings)?.sonarr.baseUrl;
	const apiKey = get(settings)?.sonarr.apiKey;
	const rootFolder = get(settings)?.sonarr.rootFolderPath;
	const qualityProfileId = get(settings)?.sonarr.qualityProfileId;
	const languageProfileId = get(settings)?.sonarr.languageProfileId;

	if (!baseUrl || !apiKey || !rootFolder || !qualityProfileId || !languageProfileId)
		return undefined;

	return createClient<paths>({
		baseUrl,
		headers: {
			'X-Api-Key': apiKey
		}
	});
}

export const getSonarrSeries = (): Promise<SonarrSeries[]> =>
	getSonarrApi()
		?.get('/api/v3/series', {
			params: {}
		})
		.then((r) => r.data || []) || Promise.resolve([]);

export const getSonarrSeriesByTvdbId = (tvdbId: number): Promise<SonarrSeries | undefined> =>
	getSonarrApi()
		?.get('/api/v3/series', {
			params: {
				query: {
					tvdbId: tvdbId
				}
			}
		})
		.then((r) => r.data?.find((m) => m.tvdbId === tvdbId)) || Promise.resolve(undefined);

export const getDiskSpace = (): Promise<DiskSpaceInfo[]> =>
	getSonarrApi()
		?.get('/api/v3/diskspace', {})
		.then((d) => d.data || []) || Promise.resolve([]);

export const addSeriesToSonarr = async (
	tmdbId: number,
	opts?: { qualityProfileId?: number; monitor?: 'all' | 'none' | 'firstSeason' }
) => {
	const tmdbSeries = await getTmdbSeries(tmdbId);

	if (!tmdbSeries || !tmdbSeries.external_ids.tvdb_id || !tmdbSeries.name)
		throw new Error('Movie not found');

	let monitorType = await getSonarrMonitor(get(settings)?.sonarr.monitor);
	const resolvedMonitor = opts?.monitor ?? (monitorType ? (monitorType as any) : 'none');
	const options: SonarrSeriesOptions = {
		title: tmdbSeries.name,
		tvdbId: tmdbSeries.external_ids.tvdb_id,
		qualityProfileId: opts?.qualityProfileId ?? (get(settings)?.sonarr.qualityProfileId || 0),
		monitored: resolvedMonitor !== 'none',
		addOptions: {
			monitor: resolvedMonitor,
			searchForMissingEpisodes: false,
			searchForCutoffUnmetEpisodes: false
		},
		rootFolderPath: get(settings)?.sonarr.rootFolderPath || '',
		languageProfileId: get(settings)?.sonarr.languageProfileId || 0,
		seasonFolder: true
	};

	return getSonarrApi()
		?.post('/api/v3/series', {
			params: {},
			body: options
		})
		.then((r) => r.data);
};

export const cancelDownloadSonarrEpisode = async (downloadId: number) => {
	const deleteResponse = await getSonarrApi()
		?.del('/api/v3/queue/{id}', {
			params: {
				path: {
					id: downloadId
				},
				query: {
					blocklist: false,
					removeFromClient: true
				}
			}
		})
		.then((r) => log(r));

	return !!deleteResponse?.response.ok;
};

export const downloadSonarrEpisode = (guid: string, indexerId: number) =>
	getSonarrApi()
		?.post('/api/v3/release', {
			params: {},
			body: {
				indexerId,
				guid
			}
		})
		.then((res) => res.response.ok) || Promise.resolve(false);

export const deleteSonarrEpisode = (id: number) =>
	getSonarrApi()
		?.del('/api/v3/episodefile/{id}', {
			params: {
				path: {
					id
				}
			}
		})
		.then((res) => res.response.ok) || Promise.resolve(false);

export const getSonarrDownloads = (): Promise<SonarrDownload[]> =>
	getSonarrApi()
		?.get('/api/v3/queue', {
			params: {
				query: {
					includeEpisode: true,
					includeSeries: true
				}
			}
		})
		.then(
			(r) =>
				(r.data?.records?.filter(
					(record) => record.episode && record.series
				) as SonarrDownload[]) || []
		) || Promise.resolve([]);

export const getSonarrDownloadsById = (sonarrId: number) =>
	getSonarrDownloads().then((downloads) => downloads.filter((d) => d.seriesId === sonarrId)) ||
	Promise.resolve([]);

export const removeFromSonarr = (id: number): Promise<boolean> =>
	getSonarrApi()
		?.del('/api/v3/series/{id}', {
			params: {
				path: {
					id
				}
			}
		})
		.then((res) => res.response.ok) || Promise.resolve(false);

export const getSonarrEpisodes = async (seriesId: number) => {
	const episodesPromise =
		getSonarrApi()
			?.get('/api/v3/episode', {
				params: {
					query: {
						seriesId
					}
				}
			})
			.then((r) => r.data || []) || Promise.resolve([]);

	const episodeFilesPromise =
		getSonarrApi()
			?.get('/api/v3/episodefile', {
				params: {
					query: {
						seriesId
					}
				}
			})
			.then((r) => r.data || []) || Promise.resolve([]);

	const episodes = await episodesPromise;
	const episodeFiles = await episodeFilesPromise;

	return episodes.map((episode) => ({
		episode,
		episodeFile: episodeFiles.find((file) => file.id === episode.episodeFileId)
	}));
};

export const fetchSonarrReleases = async (episodeId: number) =>
	getSonarrApi()
		?.get('/api/v3/release', {
			params: {
				query: {
					episodeId
				}
			}
		})
		.then((r) => r.data || []) || Promise.resolve([]);

export const fetchSonarrSeasonReleases = async (seriesId: number, seasonNumber: number) =>
	getSonarrApi()
		?.get('/api/v3/release', {
			params: {
				query: {
					seriesId,
					seasonNumber
				}
			}
		})
		.then((r) => r.data || []) || Promise.resolve([]);

export const fetchSonarrEpisodes = async (seriesId: number): Promise<SonarrEpisode[]> => {
	return (
		getSonarrApi()
			?.get('/api/v3/episode', {
				params: {
					query: {
						seriesId
					}
				}
			})
			.then((r) => r.data || []) || Promise.resolve([])
	);
};

export const getSonarrHealth = async (
	baseUrl: string | undefined = undefined,
	apiKey: string | undefined = undefined
) =>
	axios
		.get((baseUrl || get(settings)?.sonarr.baseUrl) + '/api/v3/health', {
			headers: {
				'X-Api-Key': apiKey || get(settings)?.sonarr.apiKey
			}
		})
		.then((res) => res.status === 200)
		.catch(() => false);

export const getSonarrRootFolders = async (
	baseUrl: string | undefined = undefined,
	apiKey: string | undefined = undefined
) =>
	axios
		.get<components['schemas']['RootFolderResource'][]>(
			(baseUrl || get(settings)?.sonarr.baseUrl) + '/api/v3/rootFolder',
			{
				headers: {
					'X-Api-Key': apiKey || get(settings)?.sonarr.apiKey
				}
			}
		)
		.then((res) => res.data || []);

export const getSonarrQualityProfiles = async (
	baseUrl: string | undefined = undefined,
	apiKey: string | undefined = undefined
) =>
	axios
		.get<components['schemas']['QualityProfileResource'][]>(
			(baseUrl || get(settings)?.sonarr.baseUrl) + '/api/v3/qualityprofile',
			{
				headers: {
					'X-Api-Key': apiKey || get(settings)?.sonarr.apiKey
				}
			}
		)
		.then((res) => res.data || []);

export const getSonarrLanguageProfiles = async (
	baseUrl: string | undefined = undefined,
	apiKey: string | undefined = undefined
) =>
	axios
		.get<components['schemas']['LanguageProfileResource'][]>(
			(baseUrl || get(settings)?.sonarr.baseUrl) + '/api/v3/languageprofile',
			{
				headers: {
					'X-Api-Key': apiKey || get(settings)?.sonarr.apiKey
				}
			}
		)
		.then((res) => res.data || []);

export const getSonarrMonitors = async (
) => {
	return [
		'unknown',
		'all',
		'future',
		'missing',
		'existing',
		'firstSeason',
		'latestSeason',
		'pilot',
		'monitorSpecials',
		'unmonitorSpecials',
		'none']
}

export const getSonarrMonitor = async (id: number) => {
	return getSonarrMonitors().then((r) => { return r[id] as string });
}

export function getSonarrPosterUrl(item: SonarrSeries, original = false) {
	const url =
		get(settings).sonarr.baseUrl + (item.images?.find((i) => i.coverType === 'poster')?.url || '');

	if (!original) return url.replace('poster.jpg', `poster-${500}.jpg`);

	return url;
}

export type SonarrQualityProfile = {
	id: number;
	name: string;
};

/**
 * List quality profiles via the authenticated openapi client (uses current settings).
 * Returned as a slim {id, name} list for dropdowns. Distinct from the legacy
 * `getSonarrQualityProfiles(baseUrl, apiKey)` axios helper used by the settings page.
 */
export const listSonarrQualityProfiles = async (): Promise<SonarrQualityProfile[]> => {
	const res = await getSonarrApi()?.get('/api/v3/qualityprofile', { params: {} });
	const data = (res?.data ?? []) as any[];
	return data.map((p) => ({ id: p.id, name: p.name }));
};

const sonarrCommand = async (body: Record<string, unknown>) => {
	const res = await getSonarrApi()?.post('/api/v3/command', { params: {}, body: body as any });
	return !!res?.response.ok;
};

const ensureSeriesQualityProfile = async (series: SonarrSeries, profileId: number) => {
	if (series.qualityProfileId === profileId) return series;
	const res = await getSonarrApi()?.put('/api/v3/series/{id}', {
		params: { path: { id: String(series.id) } },
		body: { ...series, qualityProfileId: profileId } as any
	});
	return (res?.data ?? series) as SonarrSeries;
};

/**
 * Unified request for mixed season-packs + individual episodes.
 * - seasonPacks: seasons to fetch as one release each (SeasonSearch)
 * - episodeIds: individual episodes to fetch (single EpisodeSearch with full list)
 *
 * Ensures the series exists in Sonarr, flips affected seasons + episodes to
 * monitored in a single series PUT (plus one episode-monitor PUT if needed),
 * then dispatches commands. Returns what actually got searched.
 */
export const requestSeriesSelection = async (
	tmdbId: number,
	qualityProfileId: number,
	selection: { seasonPacks: number[]; episodeIds: number[] }
): Promise<{
	series: SonarrSeries;
	searchedSeasons: number[];
	searchedEpisodes: number[];
}> => {
	const { seasonPacks, episodeIds } = selection;
	if (!seasonPacks.length && !episodeIds.length) {
		throw new Error('Nothing selected');
	}

	// Look up existing series or add it.
	const tmdbSeries = await getTmdbSeries(tmdbId);
	const tvdbId = tmdbSeries?.external_ids?.tvdb_id;
	let series: SonarrSeries | undefined = tvdbId
		? await getSonarrSeriesByTvdbId(tvdbId)
		: undefined;
	if (!series?.id) {
		const added = await addSeriesToSonarr(tmdbId, {
			qualityProfileId,
			monitor: 'none'
		});
		if (!added?.id) throw new Error('Sonarr did not return the new series id');
		series = added;
	} else {
		series = await ensureSeriesQualityProfile(series, qualityProfileId);
	}

	// Flip affected seasons to monitored in a single PUT (union of packs and
	// parent seasons of the selected episodes — Sonarr won't search an episode
	// whose season is unmonitored).
	const epParentSeasons = new Set<number>();
	if (episodeIds.length) {
		const epLookup = await getSonarrApi()?.get('/api/v3/episode', {
			params: { query: { seriesId: series.id } as any }
		});
		const epRows = (epLookup?.data ?? []) as any[];
		for (const id of episodeIds) {
			const row = epRows.find((e) => e.id === id);
			if (row) epParentSeasons.add(row.seasonNumber);
		}
	}
	const wantedSeasons = new Set<number>([...seasonPacks, ...epParentSeasons]);
	const seasons = (series.seasons || []).map((s: any) =>
		wantedSeasons.has(s.seasonNumber) ? { ...s, monitored: true } : s
	);
	await getSonarrApi()?.put('/api/v3/series/{id}', {
		params: { path: { id: String(series.id) } },
		body: { ...series, monitored: true, seasons } as any
	});

	// Mark individual episodes monitored (required for EpisodeSearch to grab them).
	if (episodeIds.length) {
		await getSonarrApi()?.put('/api/v3/episode/monitor', {
			params: {},
			body: { episodeIds, monitored: true } as any
		});
	}

	// Dispatch commands.
	const searchedSeasons: number[] = [];
	for (const n of seasonPacks) {
		const ok = await sonarrCommand({
			name: 'SeasonSearch',
			seriesId: series.id,
			seasonNumber: n
		});
		if (ok) searchedSeasons.push(n);
	}

	let searchedEpisodes: number[] = [];
	if (episodeIds.length) {
		const ok = await sonarrCommand({ name: 'EpisodeSearch', episodeIds });
		if (ok) searchedEpisodes = [...episodeIds];
	}

	return { series, searchedSeasons, searchedEpisodes };
};

/**
 * One-shot: add the series and trigger a SeasonSearch on the requested season.
 * Adds with monitor='none' then flips the chosen season to monitored so we don't
 * search everything.
 */
export const requestSeries = async (
	tmdbId: number,
	qualityProfileId: number,
	seasonNumber = 1
) => {
	const added = await addSeriesToSonarr(tmdbId, {
		qualityProfileId,
		monitor: 'none'
	});
	if (!added?.id) throw new Error('Sonarr did not return the new series id');

	const seasons = (added.seasons || []).map((s) =>
		s.seasonNumber === seasonNumber ? { ...s, monitored: true } : s
	);
	await getSonarrApi()?.put('/api/v3/series/{id}', {
		params: { path: { id: String(added.id) } },
		body: { ...added, monitored: true, seasons } as any
	});
	await sonarrCommand({ name: 'SeasonSearch', seriesId: added.id, seasonNumber });
	return added;
};

/**
 * Request a specific season. mode='pack' = single season-pack search, mode='episodes' = search every
 * episode of that season individually.
 */
export const requestSeason = async (
	series: SonarrSeries,
	seasonNumber: number,
	qualityProfileId: number,
	mode: 'pack' | 'episodes'
): Promise<boolean> => {
	if (!series.id) return false;
	const updated = await ensureSeriesQualityProfile(series, qualityProfileId);
	const seasons = (updated.seasons || []).map((s) =>
		s.seasonNumber === seasonNumber ? { ...s, monitored: true } : s
	);
	await getSonarrApi()?.put('/api/v3/series/{id}', {
		params: { path: { id: String(updated.id) } },
		body: { ...updated, seasons } as any
	});
	if (mode === 'pack') {
		return sonarrCommand({ name: 'SeasonSearch', seriesId: updated.id, seasonNumber });
	}
	// Fetch episode ids for this season, then fire EpisodeSearch with all of them.
	const epRes = await getSonarrApi()?.get('/api/v3/episode', {
		params: { query: { seriesId: updated.id, seasonNumber } as any }
	});
	const ids = ((epRes?.data ?? []) as any[]).map((e) => e.id).filter(Boolean);
	if (!ids.length) return false;
	// Mark them monitored so Sonarr keeps them in scope.
	await getSonarrApi()?.put('/api/v3/episode/monitor', {
		params: {},
		body: { episodeIds: ids, monitored: true } as any
	});
	return sonarrCommand({ name: 'EpisodeSearch', episodeIds: ids });
};

/**
 * Request a single episode.
 */
export const requestEpisode = async (
	series: SonarrSeries,
	episodeId: number,
	qualityProfileId: number
): Promise<boolean> => {
	if (!series.id) return false;
	await ensureSeriesQualityProfile(series, qualityProfileId);
	await getSonarrApi()?.put('/api/v3/episode/monitor', {
		params: {},
		body: { episodeIds: [episodeId], monitored: true } as any
	});
	return sonarrCommand({ name: 'EpisodeSearch', episodeIds: [episodeId] });
};

export const getSonarrEpisodesBySeriesId = async (seriesId: number) => {
	const res = await getSonarrApi()?.get('/api/v3/episode', {
		params: { query: { seriesId } as any }
	});
	return ((res?.data ?? []) as any[]);
};
