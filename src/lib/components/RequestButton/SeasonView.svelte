<!-- src/lib/components/RequestButton/SeasonView.svelte -->
<script lang="ts" context="module">
	export type EpisodeViewModel = {
		episodeId: number;
		episodeNumber: number;
		title: string;
		stillPath: string | null;
		runtimeMinutes: number | null;
		airDate: string | null;
		status: 'idle' | 'requesting' | 'downloading' | 'complete' | 'failed';
		downloadPercent: number;
		inJellyfin: boolean;
		jellyfinId?: string;
		watched?: boolean;
		watchProgress?: number;
	};
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import RequestButton from './RequestButton.svelte';
	import EpisodeCard from './EpisodeCard.svelte';

	export let seriesId: number;
	export let seasonNumber: number;
	export let episodeCount: number;
	export let profiles: { id: number; name: string }[] = [];
	export let selectedProfileId: number | null = null;
	export let episodes: EpisodeViewModel[] = [];
	export let upcomingDate: string | null = null;
	export let isOnlineMode = false;

	const dispatch = createEventDispatcher<{
		requestSeasonPack: { profileId: number };
		requestSeasonEpisodes: { profileId: number };
		requestEpisode: { episodeId: number; profileId: number };
		playEpisode: { episodeId: number };
		advancedSeason: void;
		advancedEpisode: { episodeId: number };
		retryEpisode: { episodeId: number };
		streamEpisode: { episodeNumber: number };
	}>();

	let stateKey: string;
	$: stateKey = `season:${seriesId}-${seasonNumber}`;
</script>

<div class="flex flex-col gap-4">
	<div class="flex items-center justify-between gap-3 flex-wrap">
		<div class="flex items-center gap-3 flex-wrap">
			<div class="text-zinc-100 font-semibold">
				Season {seasonNumber} · {episodeCount} episode{episodeCount === 1 ? '' : 's'}
			</div>
			{#if upcomingDate}
				<span
					class="inline-flex items-center gap-1.5 text-xs bg-amber-500/15 text-amber-300
					       rounded-full px-2.5 py-1 font-semibold"
				>
					<span class="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
					Coming Soon — {upcomingDate}
				</span>
			{/if}
		</div>
		{#if !isOnlineMode}
			<RequestButton
				label="Request Season Pack"
				variant="season"
				{stateKey}
				{profiles}
				{selectedProfileId}
				on:request={(e) => dispatch('requestSeasonPack', { profileId: e.detail.profileId })}
				on:advanced={() => dispatch('advancedSeason')}
			/>
		{/if}
	</div>

	<div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each episodes as ep (ep.episodeId)}
			<EpisodeCard
				stillPath={ep.stillPath}
				episodeNumber={ep.episodeNumber}
				title={ep.title}
				runtimeMinutes={ep.runtimeMinutes}
				airDate={ep.airDate}
				status={ep.status}
				downloadPercent={ep.downloadPercent}
				inJellyfin={ep.inJellyfin}
				watched={ep.watched ?? false}
				watchProgress={ep.watchProgress ?? 0}
				{isOnlineMode}
				on:request={() =>
					dispatch('requestEpisode', {
						episodeId: ep.episodeId,
						profileId: selectedProfileId ?? profiles[0]?.id
					})}
				on:overflow={() => dispatch('advancedEpisode', { episodeId: ep.episodeId })}
				on:play={() => dispatch('playEpisode', { episodeId: ep.episodeId })}
				on:retry={() => dispatch('retryEpisode', { episodeId: ep.episodeId })}
				on:stream={() => dispatch('streamEpisode', { episodeNumber: ep.episodeNumber })}
			/>
		{/each}
	</div>
</div>
