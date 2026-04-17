<script lang="ts">
	import { getJellyfinEpisodes, type JellyfinItem } from '$lib/apis/jellyfin/jellyfinApi';
	import {
		addSeriesToSonarr,
		getSonarrDownloadsById,
		getSonarrEpisodes,
		getSonarrEpisodesBySeriesId,
		listSonarrQualityProfiles,
		type SonarrQualityProfile
	} from '$lib/apis/sonarr/sonarrApi';
	import {
		getTmdbIdFromTvdbId,
		getTmdbSeries,
		getTmdbSeriesRecommendations,
		getTmdbSeriesSeasons,
		getTmdbSeriesSimilar,
		type TmdbSeriesFull2
	} from '$lib/apis/tmdb/tmdbApi';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card/Card.svelte';
	import { fetchCardTmdbProps } from '$lib/components/Card/card';
	import Carousel from '$lib/components/Carousel/Carousel.svelte';
	import CarouselPlaceholderItems from '$lib/components/Carousel/CarouselPlaceholderItems.svelte';
	import UiCarousel from '$lib/components/Carousel/UICarousel.svelte';
	import EpisodeCard from '$lib/components/EpisodeCard/EpisodeCard.svelte';
	import PersonCard from '$lib/components/PersonCard/PersonCard.svelte';
	import RequestButton from '$lib/components/RequestButton/RequestButton.svelte';
	import RequestedByPill from '$lib/components/RequestedByPill.svelte';
	import SeasonTabs, { type SeasonTab } from '$lib/components/RequestButton/SeasonTabs.svelte';
	import SeasonView, {
		type EpisodeViewModel
	} from '$lib/components/RequestButton/SeasonView.svelte';
	import {
		handleRequestSeason,
		handleRequestEpisode,
		handleRequestSelection,
		resolveSonarrProfileId,
		scheduleNoReleasesCheck
	} from '$lib/components/RequestButton/requestActions';
	import RequestModal from '$lib/components/RequestModal/RequestModal.svelte';
	import SeriesRequestModal from '$lib/components/RequestButton/SeriesRequestModal.svelte';
	import OpenInButton from '$lib/components/TitlePageLayout/OpenInButton.svelte';
	import TitlePageLayout from '$lib/components/TitlePageLayout/TitlePageLayout.svelte';
	import { playerState } from '$lib/components/VideoPlayer/VideoPlayer';
	import StreamButton from '$lib/components/StreamButton/StreamButton.svelte';
	import StreamListModal from '$lib/components/StreamList/StreamListModal.svelte';
	import StreamEpisodePicker from '$lib/components/StreamList/StreamEpisodePicker.svelte';
	import { page } from '$app/stores';
	import { TMDB_BACKDROP_SMALL } from '$lib/constants';
	import {
		createJellyfinItemStore,
		createSonarrDownloadStore,
		createSonarrSeriesStore
	} from '$lib/stores/data.store';
	import { modalStack } from '$lib/stores/modal.store';
	import {
		sessionQualityProfile,
		setSonarrProfile
	} from '$lib/stores/sessionQualityProfile';
	import { settings } from '$lib/stores/settings.store';
	import type { TitleId } from '$lib/types';
	import { capitalize, formatMinutesToTime, formatSize } from '$lib/utils';
	import classNames from 'classnames';
	import { ChevronLeft, ChevronRight, DotFilled } from 'radix-icons-svelte';
	import { onDestroy, onMount, type ComponentProps } from 'svelte';
	import { writable } from 'svelte/store';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';

	export let titleId: TitleId;
	export let isModal = false;
	export let handleCloseModal: () => void = () => {};

	const data = loadInitialPageData();
	const recommendationData = preloadRecommendationData();

	const jellyfinItemStore = createJellyfinItemStore(data.then((d) => d.tmdbId));
	const sonarrSeriesStore = createSonarrSeriesStore(data.then((d) => d.tmdbSeries?.name || ''));
	const sonarrDownloadStore = createSonarrDownloadStore(sonarrSeriesStore);

	let seasonSelectVisible = false;
	let visibleSeasonNumber: number = 1;
	let visibleEpisodeIndex: number | undefined = undefined;
	let nextJellyfinEpisode: JellyfinItem | undefined = undefined;

	const jellyfinEpisodeData: {
		[key: string]: {
			jellyfinId: string | undefined;
			progress: number;
			watched: boolean;
		};
	} = {};
	const episodeComponents: HTMLDivElement[] = [];

	// Refresh jellyfin episode data
	jellyfinItemStore.subscribe(async (value) => {
		const item = value.item;
		if (!item?.Id) return;
		const episodes = await getJellyfinEpisodes(item.Id);

		episodes?.forEach((episode) => {
			const key = `S${episode?.ParentIndexNumber}E${episode?.IndexNumber}`;

			if (!nextJellyfinEpisode && episode?.UserData?.Played === false) {
				nextJellyfinEpisode = episode;
			}

			jellyfinEpisodeData[key] = {
				jellyfinId: episode?.Id,
				progress: episode?.UserData?.PlayedPercentage || 0,
				watched: episode?.UserData?.Played || false
			};
		});

		if (!nextJellyfinEpisode) nextJellyfinEpisode = episodes?.[0];
		visibleSeasonNumber = nextJellyfinEpisode?.ParentIndexNumber || visibleSeasonNumber;

		if ($sonarrSeriesStore.item?.id) refreshSeriesData();
	});

	async function loadInitialPageData() {
		const tmdbId = await (titleId.provider === 'tvdb'
			? getTmdbIdFromTvdbId(titleId.id)
			: Promise.resolve(titleId.id));
		const tmdbSeries = await getTmdbSeries(tmdbId);

		return {
			tmdbId,
			tmdbUrl: 'https://www.themoviedb.org/tv/' + tmdbId,
			tmdbSeries,
			seasonsData: preloadAndMapSeasonsData(tmdbSeries)
		};
	}

	// One-tap request flow state ------------------------------------------------

	let resolvedTmdbId: number | null = null;
	let seasonsDataRef: Promise<ComponentProps<EpisodeCard>[]>[] | null = null;
	let tmdbSeasonStills = new Map<number, Map<number, string | null>>();
	data.then((d) => {
		resolvedTmdbId = d.tmdbId;
		seasonsDataRef = d.seasonsData;
	});

	const sonarrProfiles = writable<SonarrQualityProfile[]>([]);
	listSonarrQualityProfiles().then((p) => sonarrProfiles.set(p));

	let streamModal: {
		visible: boolean;
		episodeLabel: string | null;
		streamsUrl: string;
		subtitlesUrl: string;
	} | null = null;

	$: isOnlineMode = $page.data?.user?.mode === 'online';

	let showEpisodePicker = false;
	let streamFromPicker = false;

	function openSeriesStream() {
		showEpisodePicker = true;
	}

	function handleEpisodePick(e: CustomEvent<{ seasonNumber: number; episodeNumber: number }>) {
		showEpisodePicker = false;
		streamFromPicker = true;
		openEpisodeStream(e.detail.seasonNumber, e.detail.episodeNumber);
	}

	function handleStreamBack() {
		streamFromPicker = false;
		showEpisodePicker = true;
	}

	function openEpisodeStream(seasonNumber: number, episodeNumber: number) {
		if (resolvedTmdbId == null) return;
		streamModal = {
			visible: true,
			episodeLabel: `S${String(seasonNumber).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')}`,
			streamsUrl: `/api/stream/series/${resolvedTmdbId}/${seasonNumber}/${episodeNumber}`,
			subtitlesUrl: `/api/subtitles/series/${resolvedTmdbId}/${seasonNumber}/${episodeNumber}`
		};
	}

	let activeSeason = 1;
	let tabs: SeasonTab[] = [];
	let tmdbSeasonNumbers: number[] = [];
	let episodes: EpisodeViewModel[] = [];
	let inflightEpisodeIds = new Set<number>();
	let progressTimer: ReturnType<typeof setInterval> | null = null;

	$: seriesIsDone =
		!!$sonarrSeriesStore.item?.id && tabs.length > 0 && tabs.every((t) => t.badge === 'complete');
	$: seriesAwaiting = (() => {
		const s: any = $sonarrSeriesStore.item;
		if (!s?.id || seriesIsDone) return null;
		const next = s.nextAiring ? new Date(s.nextAiring) : null;
		const prev = s.previousAiring ? new Date(s.previousAiring) : null;
		// Only block the request button for brand-new series that have never aired.
		// For returning series, keep the button available so users can request
		// new seasons/episodes — just surface the upcoming date as a subtitle elsewhere.
		if (prev) return null;
		if (next && next.getTime() > Date.now()) {
			return {
				note: `Upcoming — airs ${next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
				sub: "Hasn't aired yet"
			};
		}
		return null;
	})();

	data.then((d) => {
		tmdbSeasonNumbers = (d.tmdbSeries?.seasons ?? [])
			.map((s) => s.season_number ?? 0)
			.filter((n) => n > 0)
			.sort((a, b) => a - b);
		if (!tabs.length && tmdbSeasonNumbers.length) {
			tabs = tmdbSeasonNumbers.map((n) => ({
				seasonNumber: n,
				label: `S${n}`,
				badge: null,
				downloadingPercent: 0
			}));
		}
	});

	// Per-episode stalled tracking: episodeId -> { lastPct, lastPctAt }
	const episodeProgressTracker = new Map<number, { lastPct: number; lastPctAt: number }>();
	const EPISODE_STALL_MS = 10 * 60 * 1000;

	// Pending no-releases cancellers, keyed by requestState key.
	const pendingNoReleasesChecks = new Map<string, () => void>();

	function cancelNoReleases(key: string) {
		const c = pendingNoReleasesChecks.get(key);
		if (c) {
			c();
			pendingNoReleasesChecks.delete(key);
		}
	}

	async function loadSeasonStillsIfNeeded(seasonNumber: number) {
		if (tmdbSeasonStills.has(seasonNumber)) return;
		if (!seasonsDataRef) return;
		const idx = seasonNumber - 1;
		if (idx < 0 || idx >= seasonsDataRef.length) return;
		try {
			const tmdbSeason = await seasonsDataRef[idx];
			const map = new Map<number, string | null>();
			(tmdbSeason || []).forEach((ep, i) => {
				// EpisodeCard props have backdropUrl: TMDB_BACKDROP_SMALL + still_path
				// We need the raw still_path only; reuse by stripping the prefix.
				const url = (ep as any).backdropUrl as string | undefined;
				const still = url ? url.replace(TMDB_BACKDROP_SMALL, '') : null;
				map.set(i + 1, still || null);
			});
			tmdbSeasonStills.set(seasonNumber, map);
		} catch {
			tmdbSeasonStills.set(seasonNumber, new Map());
		}
	}

	async function refreshSeriesData() {
		const series = $sonarrSeriesStore.item;
		if (!series?.id) {
			tabs = [];
			episodes = [];
			return;
		}
		const [epsWithFiles, queue] = await Promise.all([
			getSonarrEpisodes(series.id),
			getSonarrDownloadsById(series.id)
		]);
		// Flatten to plain episode objects with a hasFile helper.
		const flatEps = (epsWithFiles || []).map((e: any) => ({
			...(e.episode ?? e),
			hasFile: !!e.episodeFile || !!e.episode?.hasFile
		}));

		const bySeason = new Map<number, typeof flatEps>();
		for (const e of flatEps) {
			if (e.seasonNumber == null || e.seasonNumber === 0) continue;
			if (!bySeason.has(e.seasonNumber)) bySeason.set(e.seasonNumber, []);
			bySeason.get(e.seasonNumber)!.push(e);
		}
		const allSeasonNumbers = Array.from(
			new Set<number>([...bySeason.keys(), ...tmdbSeasonNumbers])
		).sort((a, b) => a - b);

		const nowMs = Date.now();
		tabs = allSeasonNumbers.map((n) => {
			const seasonEps = bySeason.get(n) ?? [];
			const allHave = seasonEps.length > 0 && seasonEps.every((e) => e.hasFile);
			const downloading = (queue ?? []).filter((q: any) => q.seasonNumber === n);
			const unaired =
				seasonEps.length > 0 &&
				seasonEps.every((e) => e.airDate && new Date(e.airDate).getTime() > nowMs);
			const earliestAir = unaired
				? seasonEps
						.map((e) => new Date(e.airDate!).getTime())
						.sort((a, b) => a - b)[0]
				: null;
			let badge: SeasonTab['badge'] = null;
			let pct = 0;
			let upcomingDate: string | null = null;
			if (allHave) badge = 'complete';
			else if (downloading.length) {
				badge = 'downloading';
				const size = downloading.reduce((s: number, d: any) => s + (d.size || 0), 0) || 1;
				const left = downloading.reduce((s: number, d: any) => s + (d.sizeleft || 0), 0);
				pct = Math.round(((size - left) / size) * 100);
			} else if (unaired && earliestAir) {
				badge = 'upcoming';
				upcomingDate = new Date(earliestAir).toLocaleDateString(undefined, {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				});
			}
			return {
				seasonNumber: n,
				label: `S${n}`,
				badge,
				downloadingPercent: pct,
				upcomingDate
			};
		});

		if (!tabs.some((t) => t.seasonNumber === activeSeason) && tabs.length) {
			activeSeason = tabs[0].seasonNumber;
		}

		await loadSeasonStillsIfNeeded(activeSeason);
		const stills = tmdbSeasonStills.get(activeSeason) ?? new Map<number, string | null>();

		const now = Date.now();
		episodes = (bySeason.get(activeSeason) ?? [])
			.sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0))
			.map((e) => {
				const qEntry: any = (queue ?? []).find((q: any) => q.episodeId === e.id);
				let status: EpisodeViewModel['status'] = 'idle';
				let pct = 0;
				if (e.hasFile) status = 'complete';
				else if (qEntry) {
					status = 'downloading';
					const size = qEntry.size || 1;
					pct = Math.round(((size - (qEntry.sizeleft || 0)) / size) * 100);

					// Cancel any pending no-releases check for this episode — download started.
					cancelNoReleases(`episode:${e.id}`);

					// Stalled detection.
					const prev = episodeProgressTracker.get(e.id!);
					if (!prev || prev.lastPct !== pct) {
						episodeProgressTracker.set(e.id!, { lastPct: pct, lastPctAt: now });
					} else if (pct < 100 && now - prev.lastPctAt >= EPISODE_STALL_MS) {
						status = 'failed';
					}
				} else {
					episodeProgressTracker.delete(e.id!);
				}
				if (inflightEpisodeIds.has(e.id!)) {
					if (status === 'downloading' || status === 'complete') {
						inflightEpisodeIds.delete(e.id!);
					} else {
						status = 'requesting';
					}
				}
				const jf = jellyfinEpisodeData[`S${e.seasonNumber}E${e.episodeNumber}`];
				return {
					episodeId: e.id!,
					episodeNumber: e.episodeNumber ?? 0,
					title: e.title ?? `Episode ${e.episodeNumber}`,
					stillPath: stills.get(e.episodeNumber ?? 0) ?? null,
					runtimeMinutes: e.runtime ?? null,
					airDate: e.airDate ?? null,
					status,
					downloadPercent: pct,
					inJellyfin: !!jf?.jellyfinId,
					jellyfinId: jf?.jellyfinId,
					watched: !!jf?.watched,
					watchProgress: jf?.progress ?? 0
				};
			});
	}

	async function onRequestSeries(profileId?: number) {
		const pid = profileId ?? resolveSonarrProfileId();
		setSonarrProfile(pid);
		if (resolvedTmdbId == null) return;
		const tmdbId = resolvedTmdbId;
		const tmdbSeries = (await data)?.tmdbSeries;
		let existing = $sonarrSeriesStore.item ?? undefined;

		if (!existing) {
			try {
				await addSeriesToSonarr(tmdbId, { qualityProfileId: pid, monitor: 'none' });
				await sonarrSeriesStore.refreshIn();
				existing = $sonarrSeriesStore.item ?? undefined;
			} catch (e) {
				// If add fails we still open the modal in TMDB-only fallback below.
			}
		}

		const sonarrSeriesId = existing?.id;
		const [initialQueue, episodesRaw] = await Promise.all([
			sonarrSeriesId ? getSonarrDownloadsById(sonarrSeriesId) : Promise.resolve([]),
			sonarrSeriesId ? getSonarrEpisodesBySeriesId(sonarrSeriesId) : Promise.resolve([])
		]);

		const queueStore = writable<any[]>(initialQueue ?? []);
		const requestedEpisodeIds = writable<Set<number>>(new Set());
		const requestedSeasons = writable<Set<number>>(new Set());

		const episodesBySeason = new Map<number, any[]>();
		for (const e of episodesRaw ?? []) {
			const arr = episodesBySeason.get(e.seasonNumber) ?? [];
			arr.push({
				id: e.id,
				episodeNumber: e.episodeNumber,
				name: e.title,
				hasFile: !!e.hasFile
			});
			episodesBySeason.set(e.seasonNumber, arr);
		}

		const sonarrSeasons = (existing?.seasons ?? []) as any[];
		let modalSeasons = sonarrSeasons.map((s: any) => ({
			seasonNumber: s.seasonNumber,
			episodeCount: s.statistics?.episodeCount ?? 0,
			episodeFileCount: s.statistics?.episodeFileCount ?? 0,
			episodes: (episodesBySeason.get(s.seasonNumber) ?? []).sort(
				(a, b) => a.episodeNumber - b.episodeNumber
			)
		}));

		// Fallback: series not yet in Sonarr → build season list from TMDB so the
		// user can still pick which seasons to request on first add.
		if (!modalSeasons.length && tmdbSeries?.seasons?.length) {
			modalSeasons = (tmdbSeries.seasons as any[]).map((s: any) => ({
				seasonNumber: s.season_number,
				episodeCount: s.episode_count ?? 0,
				episodeFileCount: 0,
				episodes: []
			}));
		}

		// Poll Sonarr queue every 4s while modal is open so pills update live.
		let pollTimer: ReturnType<typeof setInterval> | undefined;
		const pollQueue = async () => {
			const sid = $sonarrSeriesStore.item?.id;
			if (!sid) return;
			try {
				const q = await getSonarrDownloadsById(sid);
				queueStore.set(q ?? []);
				// Any episode that now appears in the queue is no longer "waiting".
				requestedEpisodeIds.update((s) => {
					if (!s.size) return s;
					const next = new Set(s);
					for (const item of q ?? []) {
						const epId = (item as any).episodeId;
						if (epId && next.has(epId)) next.delete(epId);
					}
					return next;
				});
				requestedSeasons.update((s) => {
					if (!s.size) return s;
					const next = new Set(s);
					for (const item of q ?? []) {
						const sn = (item as any).seasonNumber;
						if (typeof sn === 'number' && next.has(sn)) next.delete(sn);
					}
					return next;
				});
			} catch {
				// Ignore poll errors; UI keeps last good state.
			}
		};
		pollTimer = setInterval(pollQueue, 4000);

		modalStack.create(SeriesRequestModal, {
			seriesName: tmdbSeries?.name ?? 'Series',
			seasons: modalSeasons,
			existingSonarrSeries: existing,
			queueStore,
			requestedEpisodeIds,
			requestedSeasons,
			profiles: $sonarrProfiles,
			selectedProfileId: pid,
			onClose: () => {
				if (pollTimer) clearInterval(pollTimer);
			},
			onPlayEpisode: (episodeId: number) => {
				goto(`/series/${tmdbId}/play?episodeId=${episodeId}`);
			},
			onConfirm: async ({
				seasonPacks,
				episodeIds,
				profileId: confirmedProfileId
			}: {
				seasonPacks: number[];
				episodeIds: number[];
				profileId: number;
			}) => {
				setSonarrProfile(confirmedProfileId);
				const { searchedSeasons, searchedEpisodes } = await handleRequestSelection(
					tmdbId,
					{ seasonPacks, episodeIds },
					confirmedProfileId
				);

				await sonarrSeriesStore.refreshIn();
				await refreshSeriesData();
				// Kick off a fast queue refresh so "waiting" transitions to "queued" quickly.
				await pollQueue();
				setTimeout(pollQueue, 1500);

				const sid = $sonarrSeriesStore.item?.id;
				if (!sid) return;

				for (const n of searchedSeasons) {
					const key = `season:${sid}-${n}`;
					cancelNoReleases(key);
					pendingNoReleasesChecks.set(
						key,
						scheduleNoReleasesCheck(key, `Season ${n}`, async () => {
							try {
								const currentSid = $sonarrSeriesStore.item?.id;
								if (!currentSid) return false;
								const q = await getSonarrDownloadsById(currentSid);
								const hasQueue = !!(q && q.some((d: any) => d.seasonNumber === n));
								const have =
									($sonarrSeriesStore.item?.seasons as any[])?.find(
										(s: any) => s.seasonNumber === n
									)?.statistics?.episodeFileCount ?? 0;
								return !hasQueue && have === 0;
							} catch {
								return false;
							}
						})
					);
				}

				for (const epId of searchedEpisodes) {
					const key = `episode:${epId}`;
					cancelNoReleases(key);
					pendingNoReleasesChecks.set(
						key,
						scheduleNoReleasesCheck(key, `Episode ${epId}`, async () => {
							try {
								const currentSid = $sonarrSeriesStore.item?.id;
								if (!currentSid) return false;
								const q = await getSonarrDownloadsById(currentSid);
								if (q?.some((d: any) => d.episodeId === epId)) return false;
								const eps = await getSonarrEpisodesBySeriesId(currentSid);
								const row = eps?.find((e: any) => e.id === epId);
								return !row?.hasFile;
							} catch {
								return false;
							}
						})
					);
				}
			}
		});
	}

	async function onRequestSeasonPack(profileId: number) {
		setSonarrProfile(profileId);
		const series = $sonarrSeriesStore.item;
		if (!series) return;
		await handleRequestSeason(series, activeSeason, 'pack', profileId);
		await refreshSeriesData();

		const seasonNumber = activeSeason;
		const key = `season:${series.id}-${seasonNumber}`;
		cancelNoReleases(key);
		pendingNoReleasesChecks.set(
			key,
			scheduleNoReleasesCheck(key, `Season ${seasonNumber}`, async () => {
				try {
					const queue = await getSonarrDownloadsById(series.id!);
					const hasQueue = !!(queue && queue.length && queue.some((q: any) => q.seasonNumber === seasonNumber));
					const seasonTab = tabs.find((t) => t.seasonNumber === seasonNumber);
					const complete = seasonTab?.badge === 'complete';
					return !hasQueue && !complete;
				} catch {
					return false;
				}
			})
		);
	}

	async function onRequestEpisode(episodeId: number, profileId: number) {
		setSonarrProfile(profileId);
		const series = $sonarrSeriesStore.item;
		if (!series) return;
		inflightEpisodeIds.add(episodeId);
		episodes = episodes.map((ep) =>
			ep.episodeId === episodeId ? { ...ep, status: 'requesting' } : ep
		);
		setTimeout(() => {
			if (inflightEpisodeIds.delete(episodeId)) refreshSeriesData();
		}, 15000);
		await handleRequestEpisode(series, episodeId, profileId);
		await refreshSeriesData();

		const key = `episode:${episodeId}`;
		cancelNoReleases(key);
		pendingNoReleasesChecks.set(
			key,
			scheduleNoReleasesCheck(key, 'Episode', async () => {
				try {
					const queue = await getSonarrDownloadsById(series.id!);
					const hasQueue = !!(queue && queue.some((q: any) => q.episodeId === episodeId));
					const ep = episodes.find((x) => x.episodeId === episodeId);
					const complete = ep?.status === 'complete';
					return !hasQueue && !complete;
				} catch {
					return false;
				}
			})
		);
	}

	function openAdvancedSeason() {
		const series = $sonarrSeriesStore.item;
		if (!series?.id) return;
		modalStack.create(RequestModal, {
			seasonPack: { sonarrId: series.id, seasonNumber: activeSeason }
		});
	}

	function openAdvancedEpisode(episodeId: number) {
		modalStack.create(RequestModal, { sonarrEpisodeId: episodeId });
	}

	// Refresh the episode grid when the Sonarr series becomes available or changes.
	$: if ($sonarrSeriesStore.item?.id) {
		refreshSeriesData();
	}

	onMount(() => {
		progressTimer = setInterval(() => {
			refreshSeriesData();
		}, 5000);
	});
	onDestroy(() => {
		if (progressTimer) clearInterval(progressTimer);
		for (const cancel of pendingNoReleasesChecks.values()) cancel();
		pendingNoReleasesChecks.clear();
	});

	async function preloadRecommendationData() {
		const { tmdbId, tmdbSeries } = await data;
		const tmdbRecommendationProps = getTmdbSeriesRecommendations(tmdbId).then((r) =>
			Promise.all(r.map(fetchCardTmdbProps))
		);

		const tmdbSimilarProps = getTmdbSeriesSimilar(tmdbId)
			.then((r) => Promise.all(r.map(fetchCardTmdbProps)))
			.then((r) => r.filter((p) => p.backdropUrl));

		const castProps: ComponentProps<PersonCard>[] =
			tmdbSeries?.aggregate_credits?.cast?.slice(0, 20)?.map((m) => ({
				tmdbId: m.id || 0,
				backdropUri: m.profile_path || '',
				name: m.name || '',
				subtitle: m.roles?.[0]?.character || m.known_for_department || ''
			})) || [];

		return {
			tmdbRecommendationProps: await tmdbRecommendationProps,
			tmdbSimilarProps: await tmdbSimilarProps,
			castProps
		};
	}

	function preloadAndMapSeasonsData(
		tmdbSeries: TmdbSeriesFull2 | undefined
	): Promise<ComponentProps<EpisodeCard>[]>[] {
		const tmdbSeasons = getTmdbSeriesSeasons(
			tmdbSeries?.id || 0,
			tmdbSeries?.number_of_seasons || 0
		);

		return tmdbSeasons.map((season) =>
			season.then(
				(s) =>
					s?.episodes?.map((episode) => ({
						title: episode?.name || '',
						subtitle: `Episode ${episode?.episode_number}`,
						backdropUrl: TMDB_BACKDROP_SMALL + episode?.still_path || '',
						airDate:
							episode.air_date && new Date(episode.air_date) > new Date()
								? new Date(episode.air_date)
								: undefined
					})) || []
			)
		);
	}

	function playNextEpisode() {
		if (nextJellyfinEpisode?.Id) playerState.streamJellyfinId(nextJellyfinEpisode?.Id || '');
	}

	// Focus next episode on load
	let didFocusNextEpisode = false;
	$: {
		if (episodeComponents && !didFocusNextEpisode) {
			const episodeComponent = nextJellyfinEpisode?.IndexNumber
				? episodeComponents[nextJellyfinEpisode?.IndexNumber - 1]
				: undefined;

			if (episodeComponent && nextJellyfinEpisode?.ParentIndexNumber === visibleSeasonNumber) {
				const parent = episodeComponent.offsetParent;

				if (parent) {
					parent.scrollTo({
						left:
							episodeComponent.offsetLeft -
							document.body.clientWidth / 2 +
							episodeComponent.clientWidth / 2,
						behavior: 'smooth'
					});

					didFocusNextEpisode = true;
				}
			}
		}
	}
</script>

{#await data}
	<TitlePageLayout {isModal} {handleCloseModal}>
		<div slot="episodes-carousel">
			<Carousel
				gradientFromColor="from-stone-950"
				class={classNames('px-2 sm:px-4 lg:px-8', {
					'2xl:px-0': !isModal
				})}
				heading="Episodes"
			>
				<CarouselPlaceholderItems />
			</Carousel>
		</div>
	</TitlePageLayout>
{:then { tmdbId, tmdbUrl, tmdbSeries, seasonsData }}
	<TitlePageLayout
		titleInformation={{
			tmdbId,
			type: 'series',
			backdropUriCandidates: tmdbSeries?.images?.backdrops?.map((b) => b.file_path || '') || [],
			posterPath: tmdbSeries?.poster_path || '',
			title: tmdbSeries?.name || '',
			tagline: tmdbSeries?.tagline || tmdbSeries?.name || '',
			overview: tmdbSeries?.overview || ''
		}}
		{isModal}
		{handleCloseModal}
	>
		<svelte:fragment slot="title-info">
			{new Date(tmdbSeries?.first_air_date || Date.now()).getFullYear()}
			<DotFilled />
			{tmdbSeries?.status}
			<DotFilled />
			<a href={tmdbUrl} target="_blank">{tmdbSeries?.vote_average?.toFixed(1)} TMDB</a>
		</svelte:fragment>

		<svelte:fragment slot="title-right">
			<div class="flex flex-col gap-3 items-end lg:items-start">
				<RequestedByPill {tmdbId} type="series" />
			<div
				class="flex gap-2 items-center flex-row-reverse justify-end lg:flex-row lg:justify-start"
			>
				{#if $jellyfinItemStore.loading || $sonarrSeriesStore.loading}
					<div class="placeholder h-10 w-48 rounded-xl" />
				{:else}
					<OpenInButton
						title={tmdbSeries?.name}
						jellyfinItem={$jellyfinItemStore.item}
						sonarrSeries={$sonarrSeriesStore.item}
						type="series"
						{tmdbId}
					/>
					{#if !!nextJellyfinEpisode}
						<Button type="primary" on:click={playNextEpisode}>
							<span>
								{$_('library.content.play')}
								{`S${nextJellyfinEpisode?.ParentIndexNumber}E${nextJellyfinEpisode?.IndexNumber}`}
							</span>
							<ChevronRight size={20} />
						</Button>
					{:else if isOnlineMode}
						<StreamButton label="Stream Series" on:click={openSeriesStream} />
					{:else if $settings.sonarr.apiKey && $settings.sonarr.baseUrl}
						{@const tmdbAirTs = tmdbSeries?.first_air_date ? new Date(tmdbSeries.first_air_date).getTime() : 0}
						{@const tmdbUpcoming = !!tmdbAirTs && tmdbAirTs > Date.now()}
						{@const tmdbAwaiting = tmdbUpcoming
							? {
									note: `Airs ${new Date(tmdbAirTs).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
									sub: 'Not yet aired'
							  }
							: null}
						<RequestButton
							label={$_('library.content.requestSeries') ?? 'Request Series'}
							variant="series"
							stateKey={`series:${tmdbId}`}
							profiles={$sonarrProfiles}
							selectedProfileId={$sessionQualityProfile.sonarr ??
								$settings.sonarr.qualityProfileId}
							done={seriesIsDone}
							awaiting={seriesAwaiting ?? tmdbAwaiting}
							on:request={(e) => onRequestSeries(e.detail.profileId)}
							on:advanced={() => {
								if ($sonarrSeriesStore.item?.id) {
									modalStack.create(RequestModal, {
										seasonPack: {
											sonarrId: $sonarrSeriesStore.item.id,
											seasonNumber: activeSeason || 1
										}
									});
								}
							}}
						/>
					{/if}
				{/if}
			</div>
			</div>
		</svelte:fragment>

		<div slot="episodes-carousel">
			{#if $sonarrSeriesStore.item?.id && tabs.length}
				<div
					class={classNames('flex flex-col gap-4 px-2 sm:px-4 lg:px-8', {
						'2xl:px-0': !isModal
					})}
				>
					<SeasonTabs
						{tabs}
						{activeSeason}
						on:pick={(e) => {
							activeSeason = e.detail.seasonNumber;
							refreshSeriesData();
						}}
					/>
					<SeasonView
						seriesId={$sonarrSeriesStore.item.id}
						seasonNumber={activeSeason}
						episodeCount={episodes.length}
						profiles={$sonarrProfiles}
						selectedProfileId={$sessionQualityProfile.sonarr ??
							$settings.sonarr.qualityProfileId}
						{episodes}
						upcomingDate={tabs.find((t) => t.seasonNumber === activeSeason)?.upcomingDate ?? null}
						{isOnlineMode}
						on:requestSeasonPack={(e) => onRequestSeasonPack(e.detail.profileId)}
						on:requestEpisode={(e) =>
							onRequestEpisode(e.detail.episodeId, e.detail.profileId)}
						on:streamEpisode={(e) => openEpisodeStream(activeSeason, e.detail.episodeNumber)}
						on:playEpisode={(e) => {
							const ep = episodes.find((x) => x.episodeId === e.detail.episodeId);
							if (ep?.jellyfinId) playerState.streamJellyfinId(ep.jellyfinId);
						}}
						on:advancedSeason={openAdvancedSeason}
						on:advancedEpisode={(e) => openAdvancedEpisode(e.detail.episodeId)}
						on:retryEpisode={(e) =>
							onRequestEpisode(
								e.detail.episodeId,
								$sessionQualityProfile.sonarr ?? $settings.sonarr.qualityProfileId
							)}
					/>
				</div>
			{:else}
				<Carousel
					gradientFromColor="from-stone-950"
					class={classNames('px-2 sm:px-4 lg:px-8', {
						'2xl:px-0': !isModal
					})}
				>
					<UiCarousel slot="title" class="flex gap-6">
						{#each [...Array(tmdbSeries?.number_of_seasons || 0).keys()].map((i) => i + 1) as seasonNumber}
							{@const season = tmdbSeries?.seasons?.find(
								(s) => s.season_number === seasonNumber
							)}
							{@const isSelected = season?.season_number === visibleSeasonNumber}
							<button
								class={classNames(
									'font-medium tracking-wide transition-colors flex-shrink-0 flex items-center gap-1',
									{
										'text-zinc-200': isSelected && seasonSelectVisible,
										'text-zinc-500 hover:text-zinc-200 cursor-pointer':
											(!isSelected || seasonSelectVisible === false) &&
											tmdbSeries?.number_of_seasons !== 1,
										'text-zinc-500 cursor-default': tmdbSeries?.number_of_seasons === 1,
										hidden:
											!seasonSelectVisible &&
											visibleSeasonNumber !== (season?.season_number || 1)
									}
								)}
								on:click={() => {
									if (tmdbSeries?.number_of_seasons === 1) return;

									if (seasonSelectVisible) {
										visibleSeasonNumber = season?.season_number || 1;
										seasonSelectVisible = false;
									} else {
										seasonSelectVisible = true;
									}
								}}
							>
								<ChevronLeft
									size={20}
									class={(seasonSelectVisible || tmdbSeries?.number_of_seasons === 1) &&
										'hidden'}
								/>
								Season {season?.season_number}
							</button>
						{/each}
					</UiCarousel>
					{#key visibleSeasonNumber}
						{#await seasonsData[visibleSeasonNumber - 1]}
							<CarouselPlaceholderItems />
						{:then seasonEpisodes}
							{#each seasonEpisodes || [] as props, i}
								{@const jellyfinData = jellyfinEpisodeData[`S${visibleSeasonNumber}E${i + 1}`]}
								<div bind:this={episodeComponents[i]}>
									<EpisodeCard
										{...props}
										{...jellyfinData
											? {
													watched: jellyfinData.watched,
													progress: jellyfinData.progress,
													jellyfinId: jellyfinData.jellyfinId
											  }
											: {}}
										on:click={() => (visibleEpisodeIndex = i)}
									/>
								</div>
							{:else}
								<CarouselPlaceholderItems />
							{/each}
						{/await}
					{/key}
				</Carousel>
			{/if}
		</div>

		<svelte:fragment slot="info-components">
			<div class="col-span-2 lg:col-span-1">
				<p class="text-zinc-400 text-sm">{$_('library.content.directedBy')}</p>
				<h2 class="font-medium">{tmdbSeries?.created_by?.map((c) => c.name).join(', ')}</h2>
			</div>
			{#if tmdbSeries?.first_air_date}
				<div class="col-span-2 lg:col-span-1">
					<p class="text-zinc-400 text-sm">{$_('library.content.firstAirDate')}</p>
					<h2 class="font-medium">
						{new Date(tmdbSeries?.first_air_date).toLocaleDateString($settings.language, {
							year: 'numeric',
							month: 'short',
							day: 'numeric'
						})}
					</h2>
				</div>
			{/if}
			{#if tmdbSeries?.next_episode_to_air}
				<div class="col-span-2 lg:col-span-1">
					<p class="text-zinc-400 text-sm">{$_('library.content.nextAirDate')}</p>
					<h2 class="font-medium">
						{new Date(tmdbSeries.next_episode_to_air?.air_date).toLocaleDateString(
							$settings.language,
							{
								year: 'numeric',
								month: 'short',
								day: 'numeric'
							}
						)}
					</h2>
				</div>
			{:else if tmdbSeries?.last_air_date}
				<div class="col-span-2 lg:col-span-1">
					<p class="text-zinc-400 text-sm">{$_('library.content.lastAirDate')}</p>
					<h2 class="font-medium">
						{new Date(tmdbSeries.last_air_date).toLocaleDateString($settings.language, {
							year: 'numeric',
							month: 'short',
							day: 'numeric'
						})}
					</h2>
				</div>
			{/if}
			<div class="col-span-2 lg:col-span-1">
				<p class="text-zinc-400 text-sm">{$_('library.content.networks')}</p>
				<h2 class="font-medium">{tmdbSeries?.networks?.map((n) => n.name).join(', ')}</h2>
			</div>
			<div class="col-span-2 lg:col-span-1">
				<p class="text-zinc-400 text-sm">{$_('library.content.episodeRunTime')}</p>
				<h2 class="font-medium">{tmdbSeries?.episode_run_time} Minutes</h2>
			</div>
			<div class="col-span-2 lg:col-span-1">
				<p class="text-zinc-400 text-sm">{$_('library.content.spokenLanguages')}</p>
				<h2 class="font-medium">
					{tmdbSeries?.spoken_languages?.map((l) => capitalize(l.english_name || '')).join(', ')}
				</h2>
			</div>
		</svelte:fragment>

		<svelte:fragment slot="servarr-components">
			{@const sonarrSeries = $sonarrSeriesStore.item}
			{#if sonarrSeries}
				{#if sonarrSeries?.statistics?.episodeFileCount}
					<div class="col-span-2 lg:col-span-1">
						<p class="text-zinc-400 text-sm">{$_('library.content.available')}</p>
						<h2 class="font-medium">
							{sonarrSeries?.statistics?.episodeFileCount || 0} Episodes
						</h2>
					</div>
				{/if}
				{#if sonarrSeries?.statistics?.sizeOnDisk}
					<div class="col-span-2 lg:col-span-1">
						<p class="text-zinc-400 text-sm">{$_('library.content.sizeDisk')}</p>
						<h2 class="font-medium">
							{formatSize(sonarrSeries?.statistics?.sizeOnDisk || 0)}
						</h2>
					</div>
				{/if}
				{#if $sonarrDownloadStore.downloads?.length}
					{@const download = $sonarrDownloadStore.downloads?.[0]}
					<div class="col-span-2 lg:col-span-1">
						<p class="text-zinc-400 text-sm">{$_('library.content.downloadCompletedIn')}</p>
						<h2 class="font-medium">
							{download?.estimatedCompletionTime
								? formatMinutesToTime(
										(new Date(download?.estimatedCompletionTime).getTime() - Date.now()) / 1000 / 60
								  )
								: 'Stalled'}
						</h2>
					</div>
				{/if}

			{:else if $sonarrSeriesStore.loading}
				<div class="flex gap-4 flex-wrap col-span-4 sm:col-span-6 mt-4">
					<div class="placeholder h-10 w-40 rounded-xl" />
					<div class="placeholder h-10 w-40 rounded-xl" />
				</div>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="carousels">
			{#await recommendationData}
				<Carousel gradientFromColor="from-stone-950">
					<div slot="title" class="font-medium text-lg">{$_('library.content.castAndCrew')}</div>
					<CarouselPlaceholderItems />
				</Carousel>

				<Carousel gradientFromColor="from-stone-950">
					<div slot="title" class="font-medium text-lg">
						{$_('library.content.recommendations')}
					</div>
					<CarouselPlaceholderItems />
				</Carousel>

				<Carousel gradientFromColor="from-stone-950">
					<div slot="title" class="font-medium text-lg">{$_('library.content.similarSeries')}</div>
					<CarouselPlaceholderItems />
				</Carousel>
			{:then { castProps, tmdbRecommendationProps, tmdbSimilarProps }}
				{#if castProps?.length}
					<Carousel gradientFromColor="from-stone-950">
						<div slot="title" class="font-medium text-lg">{$_('library.content.castAndCrew')}</div>
						{#each castProps as prop}
							<PersonCard {...prop} />
						{/each}
					</Carousel>
				{/if}

				{#if tmdbRecommendationProps?.length}
					<Carousel gradientFromColor="from-stone-950">
						<div slot="title" class="font-medium text-lg">
							{$_('library.content.recommendations')}
						</div>
						{#each tmdbRecommendationProps as prop}
							<Card {...prop} openInModal={isModal} />
						{/each}
					</Carousel>
				{/if}

				{#if tmdbSimilarProps?.length}
					<Carousel gradientFromColor="from-stone-950">
						<div slot="title" class="font-medium text-lg">
							{$_('library.content.similarSeries')}
						</div>
						{#each tmdbSimilarProps as prop}
							<Card {...prop} openInModal={isModal} />
						{/each}
					</Carousel>
				{/if}
			{/await}
		</svelte:fragment>
	</TitlePageLayout>
{/await}

{#await data then { tmdbSeries }}
	{#if showEpisodePicker && resolvedTmdbId}
		<StreamEpisodePicker
			bind:visible={showEpisodePicker}
			tmdbId={resolvedTmdbId}
			seriesName={tmdbSeries?.name ?? ''}
			posterUrl={tmdbSeries?.poster_path ? `https://image.tmdb.org/t/p/w92${tmdbSeries.poster_path}` : null}
			seasonNumbers={tmdbSeasonNumbers}
			on:pick={handleEpisodePick}
		/>
	{/if}
	{#if streamModal?.visible}
		<StreamListModal
			bind:visible={streamModal.visible}
			title={tmdbSeries?.name ?? ''}
			episodeLabel={streamModal.episodeLabel}
			posterUrl={tmdbSeries?.poster_path ? `https://image.tmdb.org/t/p/w92${tmdbSeries.poster_path}` : null}
			streamsUrl={streamModal.streamsUrl}
			subtitlesUrl={streamModal.subtitlesUrl}
			showBack={streamFromPicker}
			on:back={handleStreamBack}
		/>
	{/if}
{/await}
