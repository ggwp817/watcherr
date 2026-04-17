<!-- src/lib/components/RequestButton/EpisodeCard.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { CheckCircled, DotsHorizontal, Play, Plus } from 'radix-icons-svelte';
	import { TMDB_BACKDROP_SMALL } from '$lib/constants';

	export let stillPath: string | null = null;
	export let episodeNumber: number;
	export let title: string;
	export let runtimeMinutes: number | null = null;
	export let airDate: string | null = null;
	export let status: 'idle' | 'requesting' | 'downloading' | 'complete' | 'failed' = 'idle';
	export let downloadPercent = 0;
	export let inJellyfin = false;
	export let watched = false;
	export let watchProgress = 0;
	export let isOnlineMode = false;

	const dispatch = createEventDispatcher<{
		request: void;
		overflow: { anchor: HTMLElement };
		play: void;
		retry: void;
		stream: void;
	}>();

	$: playable = status === 'complete' && inJellyfin;
	$: upcoming =
		status === 'idle' && !!airDate && new Date(airDate).getTime() > Date.now();
	$: airsLabel = airDate
		? new Date(airDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
		: '';

	function openOverflow(e: MouseEvent) {
		e.stopPropagation();
		dispatch('overflow', { anchor: e.currentTarget as HTMLElement });
	}

	function onCardClick() {
		if (playable) dispatch('play');
	}

	function onCardKey(e: KeyboardEvent) {
		if (!playable) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			dispatch('play');
		}
	}
</script>

<div
	class="group relative flex flex-col rounded-xl overflow-hidden bg-zinc-900
	       border border-zinc-800 transition
	       {playable
		? 'cursor-pointer hover:border-amber-300/70 hover:shadow-lg hover:shadow-amber-300/10 hover:-translate-y-0.5'
		: 'hover:border-zinc-700'}"
	role={playable ? 'button' : undefined}
	tabindex={playable ? 0 : -1}
	aria-label={playable ? `Play episode ${episodeNumber}: ${title}` : undefined}
	on:click={onCardClick}
	on:keydown={onCardKey}
>
	<div class="aspect-video bg-zinc-800 relative overflow-hidden">
		{#if stillPath}
			<img
				src={`${TMDB_BACKDROP_SMALL}${stillPath}`}
				alt={title}
				class="w-full h-full object-cover transition-transform duration-300
				       {playable ? 'group-hover:scale-105' : ''}"
				loading="lazy"
			/>
		{/if}

		{#if playable}
			<div
				class="absolute inset-0 flex items-center justify-center
				       bg-gradient-to-t from-black/70 via-black/20 to-transparent
				       opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100
				       transition-opacity duration-200"
			>
				<div
					class="flex items-center justify-center h-12 w-12 rounded-full
					       bg-white/95 text-black shadow-xl
					       scale-90 group-hover:scale-100 transition-transform"
				>
					<Play size={22} />
				</div>
			</div>
		{/if}

		{#if watched}
			<div
				class="absolute top-2 right-2 flex items-center gap-1 rounded-full
				       bg-black/70 text-green-400 text-[10px] font-semibold px-2 py-0.5"
			>
				<CheckCircled size={12} /> Watched
			</div>
		{/if}

		{#if playable && watchProgress > 0 && watchProgress < 100 && !watched}
			<div class="absolute bottom-0 inset-x-0 h-[3px] bg-black/50">
				<div class="h-full bg-amber-300" style="width: {watchProgress}%"></div>
			</div>
		{/if}
	</div>
	<div class="p-3 flex flex-col gap-1">
		<div class="flex items-center justify-between text-[11px] text-zinc-400">
			<span>
				E{String(episodeNumber).padStart(2, '0')}
				{#if runtimeMinutes}· {runtimeMinutes} min{/if}
			</span>
			{#if airDate}
				<span>{airDate}</span>
			{/if}
		</div>
		<div class="text-sm font-medium text-zinc-100 leading-snug line-clamp-2">
			{title}
		</div>

		<div class="flex items-center justify-between mt-2 gap-2">
			{#if isOnlineMode}
				<button
					class="flex items-center gap-1 text-xs rounded-md px-2 py-1 font-semibold
					       bg-gradient-to-br from-amber-300 to-amber-400 text-stone-950
					       hover:from-amber-200 hover:to-amber-300 shadow-sm shadow-amber-500/20 cursor-pointer transition"
					on:click|stopPropagation={() => dispatch('stream')}
					aria-label="Stream episode {episodeNumber}: {title}"
				>
					<Play size={12} /> Stream
				</button>
			{:else if status === 'complete' && inJellyfin}
				<button
					class="flex items-center gap-1 text-xs bg-white text-black rounded-md px-2 py-1 font-semibold
					       hover:bg-amber-200 transition"
					on:click|stopPropagation={() => dispatch('play')}
				>
					<Play size={12} /> {watchProgress > 0 && !watched ? 'Resume' : 'Play'}
				</button>
			{:else if status === 'complete'}
				<span class="text-xs text-green-400 font-semibold">✓ Downloaded</span>
			{:else if status === 'downloading'}
				<div class="flex-1 flex flex-col gap-1">
					<span class="text-[11px] text-zinc-300">↓ {Math.round(downloadPercent)}%</span>
					<div class="h-[2px] w-full bg-zinc-800 rounded-full overflow-hidden">
						<div class="h-full bg-green-500" style="width: {downloadPercent}%"></div>
					</div>
				</div>
			{:else if status === 'requesting'}
				<span
					class="inline-flex items-center gap-1.5 text-xs bg-amber-500/15 text-amber-300
					       rounded-md px-2 py-1 font-semibold"
				>
					<span
						class="inline-block h-3 w-3 rounded-full border-2 border-amber-300
						       border-t-transparent animate-spin"
					/>
					Requesting…
				</span>
			{:else if status === 'failed'}
				<button
					class="text-xs text-red-400 hover:text-red-300"
					on:click|stopPropagation={() => dispatch('retry')}
				>
					Failed — retry
				</button>
			{:else if upcoming}
				<span
					class="inline-flex items-center gap-1.5 text-xs bg-amber-500/15 text-amber-300
					       rounded-md px-2 py-1 font-semibold"
					title={airDate ?? ''}
				>
					<span class="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
					Releases {airsLabel}
				</span>
			{:else}
				<button
					class="flex items-center gap-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-100
					       rounded-md px-2 py-1"
					on:click|stopPropagation={() => dispatch('request')}
				>
					<Plus size={12} /> Request
				</button>
			{/if}

			{#if !isOnlineMode}
				<button
					class="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800
					       opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition"
					aria-label="More options"
					on:click={openOverflow}
				>
					<DotsHorizontal size={14} />
				</button>
			{/if}
		</div>
	</div>
</div>
