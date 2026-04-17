<!-- src/lib/components/RequestButton/SeasonTabs.svelte -->
<script lang="ts" context="module">
	export type SeasonTab = {
		seasonNumber: number;
		label: string;
		badge: 'complete' | 'downloading' | 'upcoming' | null;
		downloadingPercent?: number;
		upcomingDate?: string | null;
	};
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let tabs: SeasonTab[] = [];
	export let activeSeason: number;

	const dispatch = createEventDispatcher<{ pick: { seasonNumber: number } }>();
</script>

<div class="flex gap-1 border-b border-zinc-800 overflow-x-auto scrollbar-hide">
	{#each tabs as t (t.seasonNumber)}
		<button
			class="flex items-center gap-2 px-4 py-2 text-sm transition whitespace-nowrap
			       border-b-2 {t.seasonNumber === activeSeason
				? 'border-white text-white font-semibold'
				: 'border-transparent text-zinc-400 hover:text-zinc-200'}"
			on:click={() => dispatch('pick', { seasonNumber: t.seasonNumber })}
		>
			<span>{t.label}</span>
			{#if t.badge === 'complete'}
				<span class="text-[10px] bg-green-500/20 text-green-400 rounded px-1.5 py-0.5">✓</span>
			{:else if t.badge === 'downloading'}
				<span class="text-[10px] bg-blue-500/20 text-blue-400 rounded px-1.5 py-0.5">
					↓ {Math.round(t.downloadingPercent ?? 0)}%
				</span>
			{:else if t.badge === 'upcoming'}
				<span
					class="inline-flex items-center gap-1 text-[10px] bg-amber-500/15 text-amber-300
					       rounded px-1.5 py-0.5"
					title={t.upcomingDate ?? ''}
				>
					<span class="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
					Soon
				</span>
			{/if}
		</button>
	{/each}
</div>
