import { jellyfinItemsStore } from '$lib/stores/data.store';
import { writable } from 'svelte/store';
import { modalStack } from '../../stores/modal.store';
import VideoPlayer from './VideoPlayer.svelte';
import type { SubtitleLanguage, SubtitleSizePreset, SubtitleTrack } from './subtitles';
import { loadSubtitleOffset, loadSubtitleSize } from './subtitles';

export type PlayerStateValue = {
	visible: boolean;
	jellyfinId: string;
	externalUrl: string | null;
	externalTitle: string | null;
	subtitleTracks: SubtitleTrack[];
	activeSubtitleTrackId: string | null;
	subtitleSize: SubtitleSizePreset;
	subtitleOffsetByLang: Record<SubtitleLanguage, number>;
	fetchingBazarr: boolean;
	bazarrFetchFailed: boolean;
};

function loadAllOffsets(): Record<SubtitleLanguage, number> {
	return { en: loadSubtitleOffset('en'), ar: loadSubtitleOffset('ar') };
}

const initialValue: PlayerStateValue = {
	visible: false,
	jellyfinId: '',
	externalUrl: null,
	externalTitle: null,
	subtitleTracks: [],
	activeSubtitleTrackId: null,
	subtitleSize: loadSubtitleSize(),
	subtitleOffsetByLang: loadAllOffsets(),
	fetchingBazarr: false,
	bazarrFetchFailed: false
};

function normalizeExternalLang(code: string): SubtitleLanguage | null {
	const c = (code ?? '').toLowerCase();
	if (c === 'en' || c === 'eng' || c === 'english') return 'en';
	if (c === 'ar' || c === 'ara' || c === 'arabic') return 'ar';
	return null;
}

function createPlayerState() {
	const store = writable<PlayerStateValue>(initialValue);

	return {
		...store,
		streamJellyfinId: (id: string) => {
			store.set({
				...initialValue,
				visible: true,
				jellyfinId: id,
				subtitleSize: loadSubtitleSize(),
				subtitleOffsetByLang: loadAllOffsets()
			});
			modalStack.create(VideoPlayer, {}); // FIXME
		},
		streamExternal: (opts: {
			url: string;
			title: string;
			subtitles?: Array<{ lang: string; label: string; url: string }>;
		}) => {
			const tracks: SubtitleTrack[] = [];
			let trackIdx = 0;
			for (const s of opts.subtitles ?? []) {
				const lang = normalizeExternalLang(s.lang);
				if (!lang) continue;
				tracks.push({
					id: `ext-${trackIdx++}`,
					language: lang,
					label: s.label || (lang === 'ar' ? 'العربية' : 'English'),
					deliveryUrl: s.url,
					isDefault: trackIdx === 1,
					isForced: false
				});
			}
			store.set({
				...initialValue,
				visible: true,
				jellyfinId: '',
				externalUrl: opts.url,
				externalTitle: opts.title,
				subtitleTracks: tracks,
				activeSubtitleTrackId: tracks[0]?.id ?? null,
				subtitleSize: loadSubtitleSize(),
				subtitleOffsetByLang: loadAllOffsets()
			});
			modalStack.create(VideoPlayer, {});
		},
		close: () => {
			store.set(initialValue);
			jellyfinItemsStore.refresh();
		}
	};
}

export const playerState = createPlayerState();
