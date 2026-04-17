<script lang="ts">
	import { onMount } from 'svelte';
	import StreamRow from './StreamRow.svelte';
	import { playerState } from '$lib/components/VideoPlayer/VideoPlayer';

	import { createEventDispatcher } from 'svelte';

	export let visible = false;
	export let title: string;
	export let episodeLabel: string | null = null;
	export let posterUrl: string | null = null;
	export let streamsUrl: string;
	export let subtitlesUrl: string | null = null;
	export let showBack = false;

	const dispatch = createEventDispatcher<{ back: void }>();

	type Stream = {
		id: string;
		url: string;
		quality: '4k' | '1080p' | '720p' | '480p' | 'unknown';
		hdr: boolean;
		title: string;
		size: number | null;
		seeders: number | null;
		source: string;
		audioCodec?: string;
		videoCodec?: string;
	};

	let streams: Stream[] = [];
	let errors: Array<{ addon: string; error: string }> = [];
	let loading = false;
	let sort: 'quality' | 'size' | 'seeders' = 'seeders';
	let qualityFilter = new Set<string>();
	let search = '';

	$: filtered = streams
		.filter((s) => (qualityFilter.size === 0 ? true : qualityFilter.has(s.quality)))
		.filter((s) =>
			search.trim() === ''
				? true
				: s.title.toLowerCase().includes(search.trim().toLowerCase())
		)
		.slice()
		.sort((a, b) => {
			if (sort === 'size') return (b.size ?? 0) - (a.size ?? 0);
			if (sort === 'seeders') return (b.seeders ?? 0) - (a.seeders ?? 0);
			const rank = { '4k': 4, '1080p': 3, '720p': 2, '480p': 1, unknown: 0 };
			return rank[b.quality] - rank[a.quality];
		});

	function toggleQuality(q: string) {
		if (qualityFilter.has(q)) qualityFilter.delete(q);
		else qualityFilter.add(q);
		qualityFilter = new Set(qualityFilter);
	}

	async function load() {
		loading = true;
		try {
			const res = await fetch(streamsUrl);
			if (!res.ok) throw new Error('Failed');
			const data = await res.json();
			streams = data.streams ?? [];
			errors = data.errors ?? [];
		} catch {
			streams = [];
			errors = [{ addon: 'network', error: 'Could not load streams' }];
		} finally {
			loading = false;
		}
	}

	async function handlePick(e: CustomEvent<{ url: string }>) {
		let subs: Array<{ lang: string; label: string; url: string }> = [];
		if (subtitlesUrl) {
			try {
				const r = await fetch(subtitlesUrl);
				if (r.ok) {
					const d = await r.json();
					subs = (d.subtitles ?? []).map((s: any) => ({
						lang: s.lang,
						label: s.label,
						url: s.url
					}));
				}
			} catch {
				subs = [];
			}
		}
		playerState.streamExternal({
			url: e.detail.url,
			title,
			subtitles: subs
		});
		visible = false;
	}

	function close() {
		visible = false;
	}

	$: if (visible) load();
	onMount(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

{#if visible}
	<div
		class="fixed inset-0 z-[110] flex items-end sm:items-center justify-center
		       bg-black/70 backdrop-blur-md"
		on:click|self={close}
		role="dialog"
		aria-modal="true"
	>
		<div
			class="w-full sm:w-[560px] max-h-[85vh] sm:max-h-[80vh]
			       bg-stone-950 border-t sm:border border-zinc-800 sm:rounded-2xl
			       shadow-2xl shadow-black/60 flex flex-col overflow-hidden pb-safe"
		>
			<div class="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-zinc-800">
				{#if showBack}
					<button
						on:click={() => { visible = false; dispatch('back'); }}
						aria-label="Back to episodes"
						class="h-8 w-8 inline-flex items-center justify-center rounded-full
						       text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer shrink-0"
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6" /></svg>
					</button>
				{/if}
				{#if posterUrl}
					<img src={posterUrl} alt="" class="h-10 w-10 rounded object-cover" />
				{/if}
				<div class="flex-1 min-w-0">
					<div class="text-sm font-semibold text-zinc-100 truncate">{title}</div>
					{#if episodeLabel}
						<div class="text-[11px] text-amber-300 font-mono">{episodeLabel}</div>
					{/if}
				</div>
				<button
					on:click={close}
					aria-label="Close"
					class="h-8 w-8 inline-flex items-center justify-center rounded-full
					       text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
				</button>
			</div>

			<div class="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center gap-2 text-xs">
				<select
					bind:value={sort}
					class="bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 text-zinc-200 cursor-pointer"
				>
					<option value="quality">Sort: Quality</option>
					<option value="size">Sort: Size</option>
					<option value="seeders">Sort: Seeders</option>
				</select>
				{#each ['4k', '1080p', '720p'] as q}
					<button
						type="button"
						on:click={() => toggleQuality(q)}
						class="px-2 py-1 rounded-md border text-[11px] font-semibold uppercase cursor-pointer
						       {qualityFilter.has(q)
							? 'bg-amber-400 text-stone-950 border-amber-400'
							: 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'}"
					>
						{q}
					</button>
				{/each}
				<input
					type="text"
					bind:value={search}
					placeholder="Filter…"
					class="flex-1 min-w-[8rem] bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 text-zinc-200 placeholder-zinc-500"
				/>
			</div>

			<div class="flex-1 overflow-y-auto px-4 py-3 space-y-2">
				<div class="flex items-center gap-2 px-3 py-2 rounded-lg border border-sky-800/40 bg-sky-900/20 text-[11px] text-sky-200">
					<svg class="h-4 w-4 shrink-0 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
					<span>Tap a stream to open in <strong>VLC</strong>. Make sure VLC is installed on your device.</span>
				</div>
				{#if loading}
					{#each Array(5) as _}
						<div class="h-14 rounded-lg bg-zinc-900/50 animate-pulse" />
					{/each}
				{:else if filtered.length === 0}
					<div class="text-center text-sm text-zinc-500 py-10">
						No streams found from your installed sources.
					</div>
				{:else}
					{#each filtered as s (s.id)}
						<StreamRow stream={s} on:pick={handlePick} />
					{/each}
				{/if}
				{#if errors.length > 0}
					<div class="text-[11px] text-amber-300/80 mt-2">
						{errors.length} source{errors.length > 1 ? 's' : ''} failed.
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
