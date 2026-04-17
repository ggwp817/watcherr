<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { SubtitleLanguage, SubtitleTrack } from './subtitles';

	export let video: HTMLVideoElement | null;
	export let tracks: SubtitleTrack[] = [];
	export let activeTrackId: string | null = null;
	export let sizePercent: number = 70;
	export let offsetByLang: Record<SubtitleLanguage, number> = { en: 0, ar: 0 };

	let cueText = '';
	let cueLang: SubtitleLanguage = 'en';
	let raf = 0;

	$: active = tracks.find((t) => t.id === activeTrackId) ?? null;

	// Keep native track rendering disabled (we render manually). 'hidden' still
	// loads cues into TextTrack.cues so we can read them.
	function syncTrackModes() {
		if (!video) return;
		const tt = video.textTracks;
		for (let i = 0; i < tt.length; i++) {
			const trackId = (tt[i] as TextTrack).id;
			tt[i].mode = trackId === activeTrackId && active ? 'hidden' : 'disabled';
		}
	}

	function tick() {
		raf = requestAnimationFrame(tick);
		if (!video || !active) {
			if (cueText) cueText = '';
			return;
		}
		const tt = video.textTracks;
		let texttrack: TextTrack | null = null;
		for (let i = 0; i < tt.length; i++) {
			if ((tt[i] as TextTrack).id === active.id) {
				texttrack = tt[i];
				break;
			}
		}
		if (!texttrack || !texttrack.cues) {
			if (cueText) cueText = '';
			return;
		}
		const offset = offsetByLang[active.language] ?? 0;
		const t = video.currentTime - offset;
		let found = '';
		const cues = texttrack.cues;
		for (let i = 0; i < cues.length; i++) {
			const c = cues[i] as VTTCue;
			if (c.startTime <= t && t <= c.endTime) {
				found = found ? found + '\n' + c.text : c.text;
			} else if (c.startTime > t) {
				break;
			}
		}
		if (found !== cueText) cueText = found;
		if (active.language !== cueLang) cueLang = active.language;
	}

	$: if (video && tracks) syncTrackModes();
	$: if (activeTrackId !== undefined) syncTrackModes();

	onMount(() => {
		raf = requestAnimationFrame(tick);
	});

	onDestroy(() => {
		if (raf) cancelAnimationFrame(raf);
	});

	// VTT cues can embed basic markup (<i>, <b>, <u>) — strip everything else for safety
	// but preserve newlines and allow <i>/<b>/<u>.
	function sanitize(text: string): string {
		return text
			.replace(/<(?!\/?(i|b|u)(>|\s))/gi, '&lt;')
			.replace(/\n/g, '<br/>');
	}

	$: html = sanitize(cueText);
	$: isRtl = cueLang === 'ar';
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@500;700&display=swap"
	/>
</svelte:head>

{#if cueText}
	<div
		class="cue-overlay"
		class:rtl={isRtl}
		dir={isRtl ? 'rtl' : 'ltr'}
		lang={cueLang}
		style:font-size="calc({sizePercent} / 100 * clamp(18px, 2.6vw, 34px))"
	>
		{@html html}
	</div>
{/if}

<style>
	.cue-overlay {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 7%;
		padding: 0 8%;
		text-align: center;
		color: #fff;
		line-height: 1.35;
		font-weight: 600;
		text-shadow:
			0 0 3px rgba(0, 0, 0, 0.95),
			0 0 6px rgba(0, 0, 0, 0.9),
			0 2px 4px rgba(0, 0, 0, 0.9);
		pointer-events: none;
		white-space: pre-line;
		font-family:
			'Segoe UI',
			Roboto,
			system-ui,
			-apple-system,
			sans-serif;
		font-feature-settings: 'kern' 1, 'liga' 1;
		font-variant-ligatures: common-ligatures;
		z-index: 2;
	}
	.cue-overlay.rtl {
		font-family:
			'Noto Naskh Arabic',
			'Amiri',
			'Scheherazade New',
			'Traditional Arabic',
			'Segoe UI',
			sans-serif;
		line-height: 1.6;
		font-weight: 700;
		unicode-bidi: isolate;
	}
	.cue-overlay :global(i) {
		font-style: italic;
	}
	.cue-overlay :global(b) {
		font-weight: 800;
	}
	.cue-overlay :global(u) {
		text-decoration: underline;
	}
</style>
