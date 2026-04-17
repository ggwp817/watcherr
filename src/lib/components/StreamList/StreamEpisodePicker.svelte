<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { onMount } from 'svelte';
	import { getTmdbSeriesSeason } from '$lib/apis/tmdb/tmdbApi';
	import { TMDB_BACKDROP_SMALL } from '$lib/constants';

	export let visible = false;
	export let tmdbId: number;
	export let seriesName: string;
	export let posterUrl: string | null = null;
	export let seasonNumbers: number[] = [];

	type Episode = {
		episodeNumber: number;
		name: string;
		stillPath: string | null;
		airDate: string | null;
		runtime: number | null;
	};

	const dispatch = createEventDispatcher<{
		pick: { seasonNumber: number; episodeNumber: number };
	}>();

	let activeSeason = seasonNumbers[0] ?? 1;
	let episodes: Episode[] = [];
	let loading = false;

	async function loadSeason(n: number) {
		activeSeason = n;
		loading = true;
		episodes = [];
		try {
			const data = await getTmdbSeriesSeason(tmdbId, n) as any;
			episodes = (data?.episodes ?? []).map((ep: any) => ({
				episodeNumber: ep.episode_number,
				name: ep.name ?? `Episode ${ep.episode_number}`,
				stillPath: ep.still_path ?? null,
				airDate: ep.air_date ?? null,
				runtime: ep.runtime ?? null
			}));
		} catch {
			episodes = [];
		} finally {
			loading = false;
		}
	}

	function pickEpisode(ep: Episode) {
		dispatch('pick', { seasonNumber: activeSeason, episodeNumber: ep.episodeNumber });
	}

	function close() {
		visible = false;
	}

	$: if (visible && seasonNumbers.length) loadSeason(activeSeason);

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
			class="w-full sm:w-[520px] max-h-[85vh] sm:max-h-[80vh]
			       bg-stone-950 border-t sm:border border-zinc-800 sm:rounded-2xl
			       shadow-2xl shadow-black/60 flex flex-col overflow-hidden pb-safe"
		>
			<div class="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-zinc-800">
				{#if posterUrl}
					<img src={posterUrl} alt="" class="h-10 w-10 rounded object-cover" />
				{/if}
				<div class="flex-1 min-w-0">
					<div class="text-sm font-semibold text-zinc-100 truncate">{seriesName}</div>
					<div class="text-[11px] text-zinc-500">Pick an episode to stream</div>
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

			<div class="px-4 py-3 border-b border-zinc-800 flex flex-wrap gap-2">
				{#each seasonNumbers as sn}
					<button
						type="button"
						on:click={() => loadSeason(sn)}
						class="px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer
						       {activeSeason === sn
							? 'bg-amber-400 text-stone-950'
							: 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-600'}"
					>
						S{String(sn).padStart(2, '0')}
					</button>
				{/each}
			</div>

			<div class="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
				{#if loading}
					{#each Array(6) as _}
						<div class="h-16 rounded-lg bg-zinc-900/50 animate-pulse" />
					{/each}
				{:else if episodes.length === 0}
					<div class="text-center text-sm text-zinc-500 py-10">
						No episodes found.
					</div>
				{:else}
					{#each episodes as ep (ep.episodeNumber)}
						<button
							type="button"
							on:click={() => pickEpisode(ep)}
							class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
							       bg-zinc-900/60 border border-zinc-800
							       hover:bg-zinc-800/80 hover:border-zinc-700
							       transition cursor-pointer text-left"
						>
							<div class="w-20 h-12 rounded-md overflow-hidden bg-zinc-800 shrink-0">
								{#if ep.stillPath}
									<img
										src={`${TMDB_BACKDROP_SMALL}${ep.stillPath}`}
										alt=""
										class="w-full h-full object-cover"
										loading="lazy"
									/>
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<div class="text-sm text-zinc-100 truncate">
									<span class="text-zinc-500 font-mono text-xs">E{String(ep.episodeNumber).padStart(2, '0')}</span>
									{ep.name}
								</div>
								<div class="text-[11px] text-zinc-500 flex gap-2">
									{#if ep.runtime}
										<span>{ep.runtime} min</span>
									{/if}
									{#if ep.airDate}
										<span>{new Date(ep.airDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
									{/if}
								</div>
							</div>
							<svg class="h-4 w-4 text-zinc-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6" /></svg>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
