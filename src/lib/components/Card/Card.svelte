<script lang="ts">
	import {
		createJellyfinItemStore,
		createRadarrMovieStore,
		createSonarrSeriesStore
	} from '$lib/stores/data.store';
	import type { TitleType } from '$lib/types';
	import { formatMinutesToTime } from '$lib/utils';
	import classNames from 'classnames';
	import { Clock, Star } from 'radix-icons-svelte';
	import { openTitleModal } from '../../stores/modal.store';
	import ContextMenu from '../ContextMenu/ContextMenu.svelte';
	import LibraryItemContextItems from '../ContextMenu/LibraryItemContextItems.svelte';
	import ProgressBar from '../ProgressBar.svelte';

	export let tmdbId: number;
	export let type: TitleType = 'movie';
	export let title: string;
	export let genres: string[] = [];
	export let runtimeMinutes = 0;
	export let seasons = 0;
	export let completionTime = '';
	export let backdropUrl: string;
	export let rating: number;

	export let available = true;
	export let progress = 0;
	export let size: 'dynamic' | 'md' | 'lg' = 'md';
	export let openInModal = true;
	export let releaseDate = '';

	let jellyfinItemStore = createJellyfinItemStore(tmdbId);
	let radarrMovieStore = createRadarrMovieStore(tmdbId);
	let sonarrSeriesStore = createSonarrSeriesStore(title);

	$: releaseTs = releaseDate ? new Date(releaseDate).getTime() : 0;
	$: isUpcoming = !!releaseTs && releaseTs > Date.now();
	$: releaseLabel = isUpcoming
		? new Date(releaseTs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
		: '';
</script>

<ContextMenu heading={title}>
	<svelte:fragment slot="menu">
		<LibraryItemContextItems
			jellyfinItem={$jellyfinItemStore.item}
			radarrMovie={$radarrMovieStore.item}
			sonarrSeries={$sonarrSeriesStore.item}
			{type}
			{tmdbId}
		/>
	</svelte:fragment>
	<button
		class={classNames(
			'rounded overflow-hidden relative shadow-lg shrink-0 aspect-video selectable hover:text-inherit flex flex-col justify-between group placeholder-image',
			'p-2 px-3 gap-2',
			{
				'h-40': size === 'md',
				'h-60': size === 'lg',
				'w-full': size === 'dynamic'
			}
		)}
		on:click={() => {
			if (openInModal) {
				openTitleModal({ type, id: tmdbId, provider: 'tmdb' });
			} else {
				window.location.href = `/${type}/${tmdbId}`;
			}
		}}
	>
		<div
			style={"background-image: url('" + backdropUrl + "')"}
			class="absolute inset-0 bg-center bg-cover group-hover:scale-105 group-focus-visible:scale-105 transition-transform"
		/>
		{#if isUpcoming}
			<div
				class="absolute top-2 left-2 z-10 inline-flex items-center gap-1.5 px-2 py-1
				       rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40
				       backdrop-blur-md text-[10px] font-semibold uppercase tracking-wider
				       shadow-lg shadow-black/40"
			>
				<span class="relative flex h-1.5 w-1.5">
					<span
						class="absolute inline-flex h-full w-full rounded-full bg-amber-300/70 animate-ping"
					></span>
					<span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-300"></span>
				</span>
				<span>Coming</span>
				<span class="text-amber-100 font-bold normal-case tabular-nums tracking-normal">
					{releaseLabel}
				</span>
			</div>
		{/if}
		<div
			class={classNames(
				'absolute inset-0 transition-opacity bg-darken sm:bg-opacity-100 bg-opacity-50',
				{
					'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100': available
				}
			)}
		/>
		<div
			class="flex flex-col justify-between flex-1 transition-opacity cursor-pointer relative opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
		>
			<div class="text-left">
				<h1 class="font-bold tracking-wider text-lg">{title}</h1>
				<div class="text-xs text-zinc-300 tracking-wider font-medium">
					{genres.map((genre) => genre.charAt(0).toUpperCase() + genre.slice(1)).join(', ')}
				</div>
			</div>
			<div class="flex justify-between items-end">
				{#if completionTime}
					<div class="text-sm font-medium text-zinc-200 tracking-wide">
						Downloaded in <b
							>{formatMinutesToTime(
								(new Date(completionTime).getTime() - Date.now()) / 1000 / 60
							)}</b
						>
					</div>
				{:else}
					{#if runtimeMinutes}
						<div class="flex gap-1.5 items-center">
							<Clock />
							<div class="text-sm text-zinc-200">
								{progress
									? formatMinutesToTime(runtimeMinutes - runtimeMinutes * (progress / 100)) +
									  ' left'
									: formatMinutesToTime(runtimeMinutes)}
							</div>
						</div>
					{/if}
					{#if seasons}
						<div class="text-sm text-zinc-200">
							{seasons} Season{seasons > 1 ? 's' : ''}
						</div>
					{/if}

					{#if rating}
						<div class="flex gap-1.5 items-center">
							<Star />
							<div class="text-sm text-zinc-200">
								{rating.toFixed(1)}
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</div>
		{#if progress}
			<div class="relative">
				<ProgressBar {progress} />
			</div>
		{/if}
	</button>
</ContextMenu>
