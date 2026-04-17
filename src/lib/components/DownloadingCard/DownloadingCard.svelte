<script lang="ts">
	import type { TitleType } from '$lib/types';
	import LazyImg from '$lib/components/LazyImg.svelte';
	import { openTitleModal } from '$lib/stores/modal.store';
	import { Download } from 'radix-icons-svelte';

	export let tmdbId: number | undefined = undefined;
	export let tvdbId: number | undefined = undefined;
	export let type: TitleType = 'movie';
	export let title = '';
	export let subtitle = '';
	export let backdropUrl = '';
	export let progress = 0;
	export let status = '';

	$: clamped = Math.max(0, Math.min(100, progress));
	$: pctLabel = `${clamped.toFixed(clamped < 10 ? 1 : 0)}%`;

	function open() {
		if (tmdbId) openTitleModal({ type, id: tmdbId, provider: 'tmdb' });
		else if (tvdbId) openTitleModal({ type, id: tvdbId, provider: 'tvdb' });
	}
</script>

<button
	on:click={open}
	class="group relative flex-shrink-0 w-44 aspect-[2/3] rounded-xl overflow-hidden
	       bg-zinc-900 ring-1 ring-white/5 shadow-lg text-left
	       hover:ring-amber-300/50 hover:shadow-amber-300/10 hover:-translate-y-0.5
	       transition duration-200"
>
	<LazyImg
		src={backdropUrl}
		class="absolute inset-0 group-hover:scale-105 transition-transform duration-500"
	/>

	<div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />

	<div
		class="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full
		       bg-black/60 backdrop-blur-sm text-amber-200 text-[10px] font-semibold
		       uppercase tracking-wider px-2 py-1 ring-1 ring-amber-300/30"
	>
		<Download size={10} />
		<span>{status || 'Downloading'}</span>
	</div>

	<div class="absolute inset-x-0 bottom-0 p-3 flex flex-col gap-2">
		<div>
			<h3 class="text-zinc-100 font-semibold text-sm leading-tight line-clamp-2">
				{title}
			</h3>
			{#if subtitle}
				<p class="text-zinc-400 text-[11px] font-medium mt-0.5 line-clamp-1">
					{subtitle}
				</p>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<div class="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
				<div
					class="h-full bg-gradient-to-r from-amber-300 to-amber-400
					       shadow-[0_0_8px_rgba(252,211,77,0.6)] transition-all duration-500"
					style="width: {clamped}%"
				></div>
			</div>
			<span class="text-amber-200 font-bold text-xs tabular-nums tracking-tight">
				{pctLabel}
			</span>
		</div>
	</div>
</button>
