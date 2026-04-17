<script lang="ts">
	import {
		delteActiveEncoding as deleteActiveEncoding,
		getJellyfinItem,
		getJellyfinPlaybackInfo,
		JELLYFIN_DEVICE_ID,
		reportJellyfinPlaybackProgress,
		reportJellyfinPlaybackStarted,
		reportJellyfinPlaybackStopped
	} from '$lib/apis/jellyfin/jellyfinApi';
	import getDeviceProfile from '$lib/apis/jellyfin/playback-profiles';
	import { getQualities } from '$lib/apis/jellyfin/qualities';
	import {
		findBazarrRef,
		requestBazarrSubtitles,
		syncSubtitle,
		uploadSubtitleFile
	} from '$lib/apis/bazarr/bazarrApi';
	import {
		searchStremioSubs,
		pickBestMatch,
		fetchSubContent
	} from '$lib/apis/stremio/openSubtitlesAddon';
	import { settings } from '$lib/stores/settings.store';
	import classNames from 'classnames';
	import Hls from 'hls.js';
	import CCButton from './CCButton.svelte';
	import CCMenu from './CCMenu.svelte';
	import SubtitleOverlay from './SubtitleOverlay.svelte';
	import {
		extractEnArSubtitleTracks,
		saveSubtitleOffset,
		saveSubtitleSize,
		sizePresetToPercent,
		SUBTITLE_OFFSET_MAX,
		SUBTITLE_OFFSET_MIN,
		SUBTITLE_OFFSET_STEP
	} from './subtitles';
	import type { SubtitleLanguage, SubtitleSizePreset, SubtitleTrack } from './subtitles';
	import {
		Cross2,
		EnterFullScreen,
		ExitFullScreen,
		Gear,
		Pause,
		Play,
		SpeakerLoud,
		SpeakerModerate,
		SpeakerOff,
		SpeakerQuiet
	} from 'radix-icons-svelte';
	import { onDestroy, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { contextMenu } from '../ContextMenu/ContextMenu';
	import ContextMenu from '../ContextMenu/ContextMenu.svelte';
	import SelectableContextMenuItem from '../ContextMenu/SelectableContextMenuItem.svelte';
	import IconButton from '../IconButton.svelte';
	import { modalStack } from '../../stores/modal.store';
	import Slider from './Slider.svelte';
	import { playerState } from './VideoPlayer';
	import { linear } from 'svelte/easing';
	import ContextMenuButton from '../ContextMenu/ContextMenuButton.svelte';

	export let modalId: symbol;

	let qualityContextMenuId = Symbol();

	let video: HTMLVideoElement;
	let videoWrapper: HTMLDivElement;
	let mouseMovementTimeout: NodeJS.Timeout;
	let stopCallback: () => void;
	let deleteEncoding: () => void;
	let reportProgress: () => void;
	let progressInterval: NodeJS.Timeout;

	// These functions are different in every browser
	let reqFullscreenFunc: ((elem: HTMLElement) => void) | undefined = undefined;
	let exitFullscreen: (() => void) | undefined = undefined;
	let fullscreenChangeEvent: string | undefined = undefined;
	let getFullscreenElement: (() => HTMLElement) | undefined = undefined;

	// Find the correct functions
	let elem = document.createElement('div');
	// @ts-ignore
	if (elem.requestFullscreen) {
		reqFullscreenFunc = (elem) => {
			elem.requestFullscreen();
		};
		fullscreenChangeEvent = 'fullscreenchange';
		getFullscreenElement = () => <HTMLElement>document.fullscreenElement;
		if (document.exitFullscreen) exitFullscreen = () => document.exitFullscreen();
		// @ts-ignore
	} else if (elem.webkitRequestFullscreen) {
		reqFullscreenFunc = (elem) => {
			// @ts-ignore
			elem.webkitRequestFullscreen();
		};
		fullscreenChangeEvent = 'webkitfullscreenchange';
		// @ts-ignore
		getFullscreenElement = () => <HTMLElement>document.webkitFullscreenElement;
		// @ts-ignore
		if (document.webkitExitFullscreen) exitFullscreen = () => document.webkitExitFullscreen();
		// @ts-ignore
	} else if (elem.msRequestFullscreen) {
		reqFullscreenFunc = (elem) => {
			// @ts-ignore
			elem.msRequestFullscreen();
		};
		fullscreenChangeEvent = 'MSFullscreenChange';
		// @ts-ignore
		getFullscreenElement = () => <HTMLElement>document.msFullscreenElement;
		// @ts-ignore
		if (document.msExitFullscreen) exitFullscreen = () => document.msExitFullscreen();
		// @ts-ignore
	} else if (elem.mozRequestFullScreen) {
		reqFullscreenFunc = (elem) => {
			// @ts-ignore
			elem.mozRequestFullScreen();
		};
		fullscreenChangeEvent = 'mozfullscreenchange';
		// @ts-ignore
		getFullscreenElement = () => <HTMLElement>document.mozFullScreenElement;
		// @ts-ignore
		if (document.mozCancelFullScreen) exitFullscreen = () => document.mozCancelFullScreen();
	}

	let paused: boolean;
	let duration: number = 0;
	let displayedTime: number = 0;
	let bufferedTime: number = 0;

	let videoLoaded: boolean = false;
	let seeking: boolean = false;
	let playerStateBeforeSeek: boolean;

	let fullscreen: boolean = false;
	let volume: number = 1;
	let mute: boolean = false;

	let resolution: number = 1080;
	let currentBitrate: number = 0;

	let shouldCloseUi = false;
	let uiVisible = true;
	$: uiVisible = !shouldCloseUi || seeking || paused || $contextMenu === qualityContextMenuId;

	// --- CC / subtitles state ---
	let ccMenuOpen = false;
	let ccButtonEl: HTMLElement | undefined;
	let bazarrFetchStartedForItem: string | null = null;

	$: subtitleTracks = $playerState.subtitleTracks;
	$: activeSubtitleTrackId = $playerState.activeSubtitleTrackId;
	$: subtitleSize = $playerState.subtitleSize;
	$: subtitleOffsetByLang = $playerState.subtitleOffsetByLang;
	$: subtitleSizePercent = sizePresetToPercent(subtitleSize);
	$: activeSubtitleLang = subtitleTracks.find((t) => t.id === activeSubtitleTrackId)?.language ?? null;
	$: activeSubtitleOffset = activeSubtitleLang
		? subtitleOffsetByLang[activeSubtitleLang] ?? 0
		: 0;
	$: fetchingBazarr = $playerState.fetchingBazarr;
	$: bazarrFetchFailed = $playerState.bazarrFetchFailed;
	$: ccActive = activeSubtitleTrackId !== null;
	$: ccUnavailable = subtitleTracks.length === 0 && !fetchingBazarr && bazarrFetchFailed;

	const fetchPlaybackInfo = (
		itemId: string,
		maxBitrate: number | undefined = undefined,
		starting: boolean = true
	) =>
		getJellyfinItem(itemId).then((item) =>
			getJellyfinPlaybackInfo(
				itemId,
				getDeviceProfile(),
				item?.UserData?.PlaybackPositionTicks || Math.floor(displayedTime * 10_000_000),
				maxBitrate || getQualities(item?.Height || 1080)[0].maxBitrate
			).then(async (playbackInfo) => {
				if (!playbackInfo) return;
				const { playbackUri, playSessionId: sessionId, mediaSourceId, directPlay } = playbackInfo;

				if (!playbackUri || !sessionId) {
					console.log('No playback URL or session ID', playbackUri, sessionId);
					return;
				}

				video.poster = item?.BackdropImageTags?.length
					? `${$settings.jellyfin.baseUrl}/Items/${item?.Id}/Images/Backdrop?quality=100&tag=${item?.BackdropImageTags?.[0]}`
					: '';

				videoLoaded = false;
				if (!directPlay) {
					if (Hls.isSupported()) {
						const hls = new Hls();

						hls.loadSource($settings.jellyfin.baseUrl + playbackUri);
						hls.attachMedia(video);
					} else if (video.canPlayType('application/vnd.apple.mpegurl')) {
						/*
						 * HLS.js does NOT work on iOS on iPhone because Safari on iPhone does not support MSE.
						 * This is not a problem, since HLS is natively supported on iOS. But any other browser
						 * that does not support MSE will not be able to play the video.
						 */
						video.src = $settings.jellyfin.baseUrl + playbackUri;
					} else {
						throw new Error('HLS is not supported');
					}
				} else {
					video.src = $settings.jellyfin.baseUrl + playbackUri;
				}

				resolution = item?.Height || 1080;
				currentBitrate = maxBitrate || getQualities(resolution)[0].maxBitrate;

				// Extract EN/AR subtitle tracks from a raw PlaybackInfo fetch (MediaStreams is not in the typed return).
				if (starting && mediaSourceId) {
					hydrateSubtitleTracks(itemId, mediaSourceId).catch((e) =>
						console.warn('[cc] hydrate failed', e)
					);
				}

				if (item?.UserData?.PlaybackPositionTicks) {
					displayedTime = item?.UserData?.PlaybackPositionTicks / 10_000_000;
				}

				// We should not requestFullscreen automatically, as it's not what
				// the user expects. Moreover, most browsers will deny the request
				// if the video takes a while to load.
				// video.play().then(() => videoWrapper.requestFullscreen());

				// A start report should only be sent when the video starts playing,
				// not every time a playback info request is made
				if (mediaSourceId && starting)
					await reportJellyfinPlaybackStarted(itemId, sessionId, mediaSourceId);

				reportProgress = async () => {
					await reportJellyfinPlaybackProgress(
						itemId,
						sessionId,
						video?.paused == true,
						video?.currentTime * 10_000_000
					);
				};

				if (progressInterval) clearInterval(progressInterval);
				progressInterval = setInterval(() => {
					video && video.readyState === 4 && video?.currentTime > 0 && sessionId && itemId;
					reportProgress();
				}, 5000);

				deleteEncoding = () => {
					deleteActiveEncoding(sessionId);
				};

				stopCallback = () => {
					reportJellyfinPlaybackStopped(itemId, sessionId, video?.currentTime * 10_000_000);
					deleteEncoding();
				};
			})
		);

	async function fetchMediaSourceRaw(
		itemId: string,
		mediaSourceId: string
	): Promise<{ MediaStreams?: any[]; Path?: string | null } | null> {
		const baseUrl = $settings.jellyfin.baseUrl;
		const apiKey = $settings.jellyfin.apiKey;
		const userId = $settings.jellyfin.userId;
		if (!baseUrl || !apiKey || !userId) return null;
		try {
			const r = await fetch(
				`${baseUrl}/Items/${itemId}/PlaybackInfo?userId=${encodeURIComponent(userId)}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `MediaBrowser DeviceId="${JELLYFIN_DEVICE_ID}", Token="${apiKey}"`
					},
					body: JSON.stringify({ DeviceProfile: getDeviceProfile() })
				}
			);
			if (!r.ok) return null;
			const data = await r.json();
			const src = (data?.MediaSources ?? []).find((s: any) => s.Id === mediaSourceId)
				|| data?.MediaSources?.[0];
			return src ?? null;
		} catch (e) {
			console.warn('[cc] fetchMediaSourceRaw failed', e);
			return null;
		}
	}

	function buildSubtitleDeliveryUrl(itemId: string, mediaSourceId: string, streamIndex: number) {
		const baseUrl = $settings.jellyfin.baseUrl;
		const apiKey = $settings.jellyfin.apiKey;
		return `${baseUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${streamIndex}/0/Stream.vtt?api_key=${apiKey}`;
	}

	async function hydrateSubtitleTracks(itemId: string, mediaSourceId: string) {
		const src = await fetchMediaSourceRaw(itemId, mediaSourceId);
		const streams = src?.MediaStreams ?? [];
		const tracks = extractEnArSubtitleTracks(streams, (idx) => {
			const url = buildSubtitleDeliveryUrl(itemId, mediaSourceId, idx);
			return url;
		}).map((t) => ({
			...t,
			// If Jellyfin returns a relative DeliveryUrl, prefix with base URL.
			deliveryUrl: t.deliveryUrl.startsWith('http')
				? t.deliveryUrl
				: `${$settings.jellyfin.baseUrl}${t.deliveryUrl}${
						t.deliveryUrl.includes('?') ? '&' : '?'
				  }api_key=${$settings.jellyfin.apiKey}`
		}));

		playerState.update((s) => ({ ...s, subtitleTracks: tracks }));

		if (tracks.length === 0 && bazarrFetchStartedForItem !== itemId) {
			bazarrFetchStartedForItem = itemId;
			runBazarrFetch(itemId, mediaSourceId, src?.Path ?? null).catch((e) =>
				console.warn('[cc] bazarr fetch failed', e)
			);
		}
	}

	async function refreshJellyfinItem(itemId: string): Promise<void> {
		const baseUrl = $settings.jellyfin.baseUrl;
		const apiKey = $settings.jellyfin.apiKey;
		if (!baseUrl || !apiKey) return;
		await fetch(
			`${baseUrl}/Items/${itemId}/Refresh?MetadataRefreshMode=FullRefresh&ReplaceAllMetadata=false`,
			{
				method: 'POST',
				headers: { 'X-Emby-Token': apiKey }
			}
		);
	}

	async function tryStremioInstall(
		itemId: string,
		ref: import('$lib/apis/bazarr/bazarrApi').BazarrRef,
		filePath: string,
		langs: Array<'en' | 'ar'>
	): Promise<Array<'en' | 'ar'>> {
		const installed: Array<'en' | 'ar'> = [];
		try {
			const item: any = await getJellyfinItem(itemId);
			if (!item) return installed;

			let imdbId: string | null = null;
			let season: number | null = null;
			let episode: number | null = null;
			if (item.Type === 'Episode') {
				season = item.ParentIndexNumber ?? null;
				episode = item.IndexNumber ?? null;
				// Stremio expects the SERIES imdb id (e.g. tt0413573) — never the episode's.
				if (item.SeriesId) {
					const series: any = await getJellyfinItem(item.SeriesId);
					imdbId = series?.ProviderIds?.Imdb ?? null;
				}
			} else {
				imdbId = item?.ProviderIds?.Imdb ?? null;
			}
			if (!imdbId) return installed;

			const basename = filePath.split('/').pop() ?? '';
			const releaseTitle = basename.replace(/\.[^.]+$/, '');

			const subs = await searchStremioSubs(imdbId, season, episode);
			if (subs.length === 0) return installed;

			for (const lang of langs) {
				const best = pickBestMatch(subs, lang, releaseTitle);
				if (!best) continue;
				const blob = await fetchSubContent(best);
				if (!blob) continue;
				try {
					await uploadSubtitleFile(ref, lang, blob, `stremio.${lang}.vtt`);
					installed.push(lang);
					// Run ffsubsync against the video audio — corrects both constant offset
					// and PAL/NTSC framerate stretch that addon's auto-adjustment can't fix.
					syncSubtitle(ref, lang).catch((e) =>
						console.warn('[cc] ffsubsync failed', lang, e)
					);
				} catch (e) {
					console.warn('[cc] stremio upload failed', lang, e);
				}
			}
		} catch (e) {
			console.warn('[cc] stremio install error', e);
		}
		return installed;
	}

	async function runBazarrFetch(
		itemId: string,
		mediaSourceId: string,
		filePath: string | null
	) {
		if (!filePath) {
			playerState.update((s) => ({ ...s, bazarrFetchFailed: true }));
			return;
		}
		const kind: 'episode' | 'movie' = /\/(Series|Shows|TV)\//i.test(filePath)
			|| /S\d{1,2}E\d{1,2}/i.test(filePath)
			? 'episode'
			: 'movie';

		playerState.update((s) => ({ ...s, fetchingBazarr: true, bazarrFetchFailed: false }));
		try {
			const ref = await findBazarrRef(kind, filePath);
			if (ref == null) {
				playerState.update((s) => ({ ...s, fetchingBazarr: false, bazarrFetchFailed: true }));
				return;
			}

			// Try Stremio OpenSubtitles v3 addon first — faster, rate-limit-free, release-matched.
			const wantLangs: Array<'en' | 'ar'> = ['en', 'ar'];
			const stremioGot = await tryStremioInstall(itemId, ref, filePath, wantLangs);
			const missing = wantLangs.filter((l) => !stremioGot.includes(l));
			if (missing.length > 0) {
				await requestBazarrSubtitles(ref, missing);
			}
			if (stremioGot.length > 0) {
				// Nudge Jellyfin to rescan so the new subtitle file appears in MediaStreams.
				refreshJellyfinItem(itemId).catch(() => {});
			}

			// Poll Jellyfin for new subtitle tracks — 10 attempts every 3s.
			for (let i = 0; i < 10; i++) {
				await new Promise((r) => setTimeout(r, 3000));
				const src = await fetchMediaSourceRaw(itemId, mediaSourceId);
				const streams = src?.MediaStreams ?? [];
				const tracks = extractEnArSubtitleTracks(streams, (idx) =>
					buildSubtitleDeliveryUrl(itemId, mediaSourceId, idx)
				).map((t) => ({
					...t,
					deliveryUrl: t.deliveryUrl.startsWith('http')
						? t.deliveryUrl
						: `${$settings.jellyfin.baseUrl}${t.deliveryUrl}${
								t.deliveryUrl.includes('?') ? '&' : '?'
						  }api_key=${$settings.jellyfin.apiKey}`
				}));
				if (tracks.length > 0) {
					playerState.update((s) => ({
						...s,
						subtitleTracks: tracks,
						fetchingBazarr: false,
						bazarrFetchFailed: false
					}));
					return;
				}
			}
			playerState.update((s) => ({ ...s, fetchingBazarr: false, bazarrFetchFailed: true }));
		} catch (e) {
			console.warn('[cc] runBazarrFetch error', e);
			playerState.update((s) => ({ ...s, fetchingBazarr: false, bazarrFetchFailed: true }));
		}
	}

	function applySubtitleTrack(id: string | null) {
		if (!video) return;
		const tracks = video.textTracks;
		for (let i = 0; i < tracks.length; i++) {
			const t = tracks[i];
			const matches = id !== null && (t.id === id || t.label === findLabelForId(id));
			// 'hidden' loads cues without letting the browser render them —
			// the SubtitleOverlay component renders them manually with RTL + font + offset.
			t.mode = matches ? 'hidden' : 'disabled';
		}
		playerState.update((s) => ({ ...s, activeSubtitleTrackId: id }));
	}

	function findLabelForId(id: string): string | undefined {
		return subtitleTracks.find((t) => t.id === id)?.label;
	}

	function applySubtitleSize(preset: SubtitleSizePreset) {
		saveSubtitleSize(preset);
		playerState.update((s) => ({ ...s, subtitleSize: preset }));
	}

	function bumpSubtitleOffset(delta: number) {
		if (!activeSubtitleLang) return;
		const current = subtitleOffsetByLang[activeSubtitleLang] ?? 0;
		const next = Math.max(
			SUBTITLE_OFFSET_MIN,
			Math.min(SUBTITLE_OFFSET_MAX, Math.round((current + delta) * 100) / 100)
		);
		const lang: SubtitleLanguage = activeSubtitleLang;
		saveSubtitleOffset(lang, next);
		playerState.update((s) => ({
			...s,
			subtitleOffsetByLang: { ...s.subtitleOffsetByLang, [lang]: next }
		}));
	}

	function resetSubtitleOffset() {
		if (!activeSubtitleLang) return;
		const lang: SubtitleLanguage = activeSubtitleLang;
		saveSubtitleOffset(lang, 0);
		playerState.update((s) => ({
			...s,
			subtitleOffsetByLang: { ...s.subtitleOffsetByLang, [lang]: 0 }
		}));
	}

	function handleCCButtonClick() {
		if (ccUnavailable) return;
		ccMenuOpen = !ccMenuOpen;
	}

	function handlePickTrack(e: CustomEvent<{ id: string | null }>) {
		applySubtitleTrack(e.detail.id);
	}

	function handlePickSize(e: CustomEvent<{ size: SubtitleSizePreset }>) {
		applySubtitleSize(e.detail.size);
	}

	function handleDocumentClick(e: MouseEvent) {
		if (!ccMenuOpen) return;
		const target = e.target as Node | null;
		if (ccButtonEl && target && ccButtonEl.contains(target)) return;
		ccMenuOpen = false;
	}

	function onSeekStart() {
		if (seeking) return;

		playerStateBeforeSeek = paused;
		seeking = true;
		paused = true;
	}

	function onSeekEnd() {
		if (!seeking) return;

		paused = playerStateBeforeSeek;
		seeking = false;

		video.currentTime = displayedTime;
	}


	function handleBuffer() {
		let timeRanges = video.buffered;
		// Find the first one whose end time is after the current time
		// (the time ranges given by the browser are normalized, which means
		// that they are sorted and non-overlapping)
		for (let i = 0; i < timeRanges.length; i++) {
			if (timeRanges.end(i) > video.currentTime) {
				bufferedTime = timeRanges.end(i);
				break;
			}
		}
	}

	function handleClose() {
		playerState.close();
		video?.pause();
		clearInterval(progressInterval);
		stopCallback?.();
		modalStack.close(modalId);
	}

	function handleUserInteraction(touch: boolean = false) {
		if (touch) shouldCloseUi = !shouldCloseUi;
		else shouldCloseUi = false;

		if (!shouldCloseUi) {
			if (mouseMovementTimeout) clearTimeout(mouseMovementTimeout);
			mouseMovementTimeout = setTimeout(() => {
				shouldCloseUi = true;
			}, 3000);
		} else {
			if (mouseMovementTimeout) clearTimeout(mouseMovementTimeout);
		}
	}

	function handleQualityToggleVisibility() {
		if ($contextMenu === qualityContextMenuId) contextMenu.hide();
		else contextMenu.show(qualityContextMenuId);
	}

	async function handleSelectQuality(bitrate: number) {
		if (!$playerState.jellyfinId || !video || seeking) return;
		if (bitrate === currentBitrate) return;

		currentBitrate = bitrate;
		video.pause();
		let timeBeforeLoad = video.currentTime;
		let stateBeforeLoad = paused;
		await reportProgress?.();
		await deleteEncoding?.();
		await fetchPlaybackInfo?.($playerState.jellyfinId, bitrate, false);
		displayedTime = timeBeforeLoad;
		paused = stateBeforeLoad;
	}

	function secondsToTime(seconds: number, forceHours = false) {
		if (isNaN(seconds)) return '00:00';

		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds - hours * 3600) / 60);
		const secondsLeft = Math.floor(seconds - hours * 3600 - minutes * 60);

		let str = '';
		if (hours > 0 || forceHours) str += `${hours}:`;

		if (minutes >= 10) str += `${minutes}:`;
		else str += `0${minutes}:`;

		if (secondsLeft >= 10) str += `${secondsLeft}`;
		else str += `0${secondsLeft}`;

		return str;
	}

	function handleVideoLoadedMetadata(e: Event) {
		const el = e.currentTarget as HTMLVideoElement;
		// Chrome exposes audioTracks/videoTracks as experimental; TS types don't include them.
		const at = (el as any).audioTracks;
		const vt = (el as any).videoTracks;
		console.info(
			'[video] loadedmetadata duration=',
			el.duration,
			'w=',
			el.videoWidth,
			'h=',
			el.videoHeight,
			'audioTracks=',
			at ? at.length : 'unsupported',
			'videoTracks=',
			vt ? vt.length : 'unsupported',
			'src=',
			el.src
		);
	}

	function handleVideoError(e: Event) {
		const el = e.currentTarget as HTMLVideoElement;
		console.warn('[video] error', el.error?.code, el.error?.message, 'src=', el.src);
	}

	onMount(() => {
		// Workaround because the paused state does not sync
		// with the video element until a change is made
		paused = false;

		if (video && $playerState.externalUrl) {
			if (video.src === '') {
				video.src = $playerState.externalUrl;
				videoLoaded = false;
				console.info('[video] external src=', $playerState.externalUrl);
				fetch('/api/debug/stream-url', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						url: $playerState.externalUrl,
						title: $playerState.title ?? ''
					})
				}).catch(() => {});
			}
		} else if (video && $playerState.jellyfinId) {
			if (video.src === '') fetchPlaybackInfo($playerState.jellyfinId);
		}

		document.addEventListener('click', handleDocumentClick);
	});

	onDestroy(() => {
		clearInterval(progressInterval);
		if (fullscreen) exitFullscreen?.();
		document.removeEventListener('click', handleDocumentClick);
	});

	$: {
		if (fullscreen && !getFullscreenElement?.()) {
			if (reqFullscreenFunc) reqFullscreenFunc(videoWrapper);
		} else if (getFullscreenElement?.()) {
			if (exitFullscreen) exitFullscreen();
		}
	}

	// We add a listener to the fullscreen change event to update the fullscreen variable
	// since it can be changed by the user by other means than the button
	if (fullscreenChangeEvent) {
		document.addEventListener(fullscreenChangeEvent, () => {
			fullscreen = !!getFullscreenElement?.();
		});
	}

	function handleRequestFullscreen() {
		if (reqFullscreenFunc) {
			fullscreen = !fullscreen;
			// @ts-ignore
		} else if (video?.webkitEnterFullScreen) {
			// Edge case to allow fullscreen on iPhone
			// @ts-ignore
			video.webkitEnterFullScreen();
		}
	}

	function handleShortcuts(event: KeyboardEvent) {
		if (event.key === 'f') {
			handleRequestFullscreen();
		} else if (event.key === ' ') {
			paused = !paused;
		} else if (event.key === 'ArrowLeft') {
			video.currentTime -= 10;
		} else if (event.key === 'ArrowRight') {
			video.currentTime += 10;
		} else if (event.key === 'ArrowUp') {
			volume = Math.min(volume + 0.1, 1);
		} else if (event.key === 'ArrowDown') {
			volume = Math.max(volume - 0.1, 0);
		}
	}
</script>

<svelte:window on:keydown={handleShortcuts} />

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class={classNames(
		'bg-black w-screen h-[100dvh] sm:h-screen relative flex items-center justify-center',
		{
			'cursor-none': !uiVisible
		}
	)}
	in:fade|global={{ duration: 300, easing: linear }}
	out:fade|global={{ duration: 200, easing: linear }}
>
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div
		class="w-screen h-screen flex items-center justify-center"
		bind:this={videoWrapper}
		on:mousemove={() => handleUserInteraction(false)}
		on:touchend|preventDefault={() => handleUserInteraction(true)}
		in:fade|global={{ duration: 500, delay: 1200, easing: linear }}
	>
		<!-- svelte-ignore a11y-media-has-caption -->
		<video
			bind:this={video}
			bind:paused
			bind:duration
			on:timeupdate={() =>
				(displayedTime = !seeking && videoLoaded ? video.currentTime : displayedTime)}
			on:progress={() => handleBuffer()}
			on:play={() => {
				if (seeking) video?.pause();
			}}
			on:loadeddata={() => {
				video.currentTime = displayedTime;
				videoLoaded = true;
			}}
			on:loadedmetadata={handleVideoLoadedMetadata}
				bind:volume
			bind:muted={mute}
			class="watcherr-player sm:w-full sm:h-full"
			crossorigin={$playerState.externalUrl ? null : 'anonymous'}
			playsinline={true}
			on:error={handleVideoError}
			on:dblclick|preventDefault={() => (fullscreen = !fullscreen)}
			on:click={() => (paused = !paused)}
		>
			{#each subtitleTracks as track (track.id)}
				<track
					kind="subtitles"
					src={track.deliveryUrl}
					srclang={track.language}
					label={track.label}
					id={track.id}
				/>
			{/each}
		</video>

		<SubtitleOverlay
			{video}
			tracks={subtitleTracks}
			activeTrackId={activeSubtitleTrackId}
			sizePercent={subtitleSizePercent}
			offsetByLang={subtitleOffsetByLang}
		/>

		{#if uiVisible}
			<!-- Video controls -->
			<div
				class="absolute bottom-0 w-screen bg-gradient-to-t from-black/[.8] via-60% via-black-opacity-80 to-transparent"
				on:touchend|stopPropagation
				transition:fade={{ duration: 100 }}
			>
				<div class="flex flex-col items-center p-4 gap-2 w-full">
					<div class="flex items-center text-sm w-full">
						<span class="whitespace-nowrap tabular-nums"
							>{secondsToTime(displayedTime, duration > 3600)}</span
						>
						<div class="flex-grow">
							<Slider
								bind:primaryValue={displayedTime}
								secondaryValue={bufferedTime}
								max={duration}
								on:mousedown={onSeekStart}
								on:mouseup={onSeekEnd}
								on:touchstart={onSeekStart}
								on:touchend={onSeekEnd}
							/>
						</div>
						<span class="whitespace-nowrap tabular-nums">{secondsToTime(duration)}</span>
					</div>

					<div class="flex items-center justify-between mb-2 w-full">
						<IconButton on:click={() => (paused = !paused)}>
							{#if (!seeking && paused) || (seeking && playerStateBeforeSeek)}
								<Play size={20} />
							{:else}
								<Pause size={20} />
							{/if}
						</IconButton>

						<div class="flex items-center space-x-3">
							<div class="cc-wrapper" bind:this={ccButtonEl}>
								<CCButton
									active={ccActive}
									fetching={fetchingBazarr}
									unavailable={ccUnavailable}
									on:click={handleCCButtonClick}
								/>
								{#if ccMenuOpen}
									<div class="cc-menu-anchor">
										<CCMenu
											tracks={subtitleTracks}
											activeTrackId={activeSubtitleTrackId}
											size={subtitleSize}
											offsetSeconds={activeSubtitleOffset}
											fetching={fetchingBazarr}
											on:pickTrack={handlePickTrack}
											on:pickSize={handlePickSize}
											on:bumpOffset={(e) => bumpSubtitleOffset(e.detail.delta)}
											on:resetOffset={resetSubtitleOffset}
											on:close={() => (ccMenuOpen = false)}
										/>
									</div>
								{/if}
							</div>
							<ContextMenuButton heading="Quality">
								<svelte:fragment slot="menu">
									{#each getQualities(resolution) as quality}
										<SelectableContextMenuItem
											selected={quality.maxBitrate === currentBitrate}
											on:click={() => handleSelectQuality(quality.maxBitrate)}
										>
											{quality.name}
										</SelectableContextMenuItem>
									{/each}
								</svelte:fragment>

								<IconButton>
									<Gear size={20} />
								</IconButton>
							</ContextMenuButton>
							<IconButton
								on:click={() => {
									mute = !mute;
								}}
							>
								{#if volume == 0 || mute}
									<SpeakerOff size={20} />
								{:else if volume < 0.25}
									<SpeakerQuiet size={20} />
								{:else if volume < 0.9}
									<SpeakerModerate size={20} />
								{:else}
									<SpeakerLoud size={20} />
								{/if}
							</IconButton>

							<div class="w-32">
								<Slider bind:primaryValue={volume} secondaryValue={0} max={1} />
							</div>

							<IconButton on:click={handleRequestFullscreen}>
								{#if fullscreen}
									<ExitFullScreen size={20} />
								{:else if !fullscreen && exitFullscreen}
									<EnterFullScreen size={20} />
								{/if}
							</IconButton>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>

	{#if uiVisible}
		<div class="absolute top-4 right-8 z-50" transition:fade={{ duration: 100 }}>
			<IconButton on:click={handleClose}>
				<Cross2 size={25} />
			</IconButton>
		</div>
	{/if}
</div>

<style>
	.cc-wrapper {
		position: relative;
		display: inline-flex;
	}
	.cc-menu-anchor {
		position: absolute;
		bottom: calc(100% + 8px);
		right: 0;
		z-index: 50;
	}
</style>
