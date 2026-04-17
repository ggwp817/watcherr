// src/lib/components/RequestButton/requestActions.ts
import { get } from 'svelte/store';
import { settings } from '$lib/stores/settings.store';
import { sessionQualityProfile } from '$lib/stores/sessionQualityProfile';
import { requestState, type RequestKey } from '$lib/stores/requestState';
import {
	notificationStack,
	createErrorNotification
} from '$lib/stores/notification.store';
import Notification from '$lib/components/Notification/Notification.svelte';
import {
	requestMovie,
	triggerRadarrMovieSearch,
	type RadarrQualityProfile
} from '$lib/apis/radarr/radarrApi';
import {
	requestSeries,
	requestSeason,
	requestSeriesSelection,
	requestEpisode,
	type SonarrSeries
} from '$lib/apis/sonarr/sonarrApi';

// Re-export type so callers can rely on a single import surface.
export type { RadarrQualityProfile };

export const resolveRadarrProfileId = () =>
	get(sessionQualityProfile).radarr ?? get(settings)?.radarr.qualityProfileId ?? 0;

export const resolveSonarrProfileId = () =>
	get(sessionQualityProfile).sonarr ?? get(settings)?.sonarr.qualityProfileId ?? 0;

function notifySuccess(title: string, description = '') {
	// Notification component supports 'info' | 'error' | 'warning' — use 'info' for success toasts.
	notificationStack.create(Notification, {
		type: 'info',
		title,
		description
	});
}

function notifyError(title: string, description: string) {
	createErrorNotification(title, description);
}

function notifyWarning(title: string, description = '') {
	notificationStack.create(Notification, {
		type: 'warning',
		title,
		description
	});
}

function logRequest(tmdbId: number, type: 'movie' | 'series', profileId?: number | null) {
	void fetch('/api/requests', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ tmdbId, type, profileId: profileId ?? null })
	}).catch(() => {
		// Silent fail — request log is non-critical
	});
}

/**
 * Schedule a delayed check for "no releases found". After `delayMs` (default 60s),
 * calls `isStillMissing()`; if true, marks the request state key as failed with a
 * "No releases found" reason and shows a warning toast.
 *
 * Returns a cancel function — call it if a download later appears so the timer
 * doesn't fire a false warning.
 */
export function scheduleNoReleasesCheck(
	key: RequestKey,
	label: string,
	isStillMissing: () => Promise<boolean> | boolean,
	delayMs = 60_000
): () => void {
	const handle = setTimeout(async () => {
		try {
			const stillMissing = await isStillMissing();
			if (stillMissing) {
				const reason = 'No releases found yet';
				requestState.markFailed(key, reason);
				notifyWarning(
					`${label}: no releases found`,
					'Indexers returned no usable releases after 60 seconds. You can retry or open the release picker.'
				);
			}
		} catch {
			// Ignore — check errors shouldn't surface as warnings.
		}
	}, delayMs);
	return () => clearTimeout(handle);
}

async function run<T>(key: RequestKey, label: string, fn: () => Promise<T>): Promise<T | null> {
	requestState.markRequesting(key);
	try {
		const result = await fn();
		requestState.markDone(key);
		notifySuccess(`${label} requested`);
		return result;
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		requestState.markFailed(key, msg);
		notifyError(`${label} failed`, msg);
		return null;
	}
}

export const handleRequestMovie = async (tmdbId: number, profileId?: number) => {
	const resolved = profileId ?? resolveRadarrProfileId();
	const result = await run(`movie:${tmdbId}`, 'Movie', () => requestMovie(tmdbId, resolved));
	if (result) logRequest(tmdbId, 'movie', resolved);
	return result;
};

export const handleRetryMovie = (movieId: number) =>
	run(`movie:retry-${movieId}`, 'Movie search', () => triggerRadarrMovieSearch(movieId));

export const handleRequestSeries = async (
	tmdbId: number,
	profileId?: number,
	seasonNumber = 1
) => {
	const resolved = profileId ?? resolveSonarrProfileId();
	const result = await run(`series:${tmdbId}`, `Season ${seasonNumber}`, () =>
		requestSeries(tmdbId, resolved, seasonNumber)
	);
	if (result) logRequest(tmdbId, 'series', resolved);
	return result;
};

export const handleRequestSeason = (
	series: SonarrSeries,
	seasonNumber: number,
	mode: 'pack' | 'episodes',
	profileId?: number
) =>
	run(`season:${series.id}-${seasonNumber}`, `Season ${seasonNumber}`, () =>
		requestSeason(series, seasonNumber, profileId ?? resolveSonarrProfileId(), mode)
	);

/**
 * Unified batched request: mixes full-season packs and individual episodes.
 * Ensures the series exists in Sonarr, flips affected monitored flags in a
 * single PUT, then dispatches SeasonSearch per pack + one EpisodeSearch for
 * all individual episodes. Shows a single summary toast.
 *
 * Returns what actually got searched so the caller can wire up per-item
 * no-releases watchdogs.
 */
export async function handleRequestSelection(
	tmdbId: number,
	selection: { seasonPacks: number[]; episodeIds: number[] },
	profileId?: number
): Promise<{ searchedSeasons: number[]; searchedEpisodes: number[] }> {
	const key: RequestKey = `series:${tmdbId}`;
	requestState.markRequesting(key);
	const resolvedProfile = profileId ?? resolveSonarrProfileId();

	try {
		const { searchedSeasons, searchedEpisodes } = await requestSeriesSelection(
			tmdbId,
			resolvedProfile,
			selection
		);

		if (!searchedSeasons.length && !searchedEpisodes.length) {
			throw new Error('Sonarr rejected the request');
		}

		const parts: string[] = [];
		if (searchedSeasons.length) {
			parts.push(
				searchedSeasons.length === 1
					? `Season ${searchedSeasons[0]}`
					: `${searchedSeasons.length} seasons`
			);
		}
		if (searchedEpisodes.length) {
			parts.push(
				searchedEpisodes.length === 1
					? `1 episode`
					: `${searchedEpisodes.length} episodes`
			);
		}
		notifySuccess(
			`${parts.join(' + ')} requested`,
			'Sonarr is searching for releases. Items with no releases will be flagged after 60s.'
		);
		requestState.markDone(key);
		logRequest(tmdbId, 'series', resolvedProfile);
		return { searchedSeasons, searchedEpisodes };
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		requestState.markFailed(key, msg);
		notifyError('Request failed', msg);
		return { searchedSeasons: [], searchedEpisodes: [] };
	}
}

export const handleRequestEpisode = (
	series: SonarrSeries,
	episodeId: number,
	profileId?: number
) =>
	run(`episode:${episodeId}`, 'Episode', () =>
		requestEpisode(series, episodeId, profileId ?? resolveSonarrProfileId())
	);
