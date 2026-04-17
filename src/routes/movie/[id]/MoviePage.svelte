<script lang="ts">
	import {
		listRadarrQualityProfiles,
		getRadarrDownloadsByTmdbId,
		type RadarrQualityProfile
	} from '$lib/apis/radarr/radarrApi';
	import {
		getTmdbMovie,
		getTmdbMovieRecommendations,
		getTmdbMovieSimilar
	} from '$lib/apis/tmdb/tmdbApi';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card/Card.svelte';
	import { fetchCardTmdbProps } from '$lib/components/Card/card';
	import Carousel from '$lib/components/Carousel/Carousel.svelte';
	import CarouselPlaceholderItems from '$lib/components/Carousel/CarouselPlaceholderItems.svelte';
	import PersonCard from '$lib/components/PersonCard/PersonCard.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import RequestButton from '$lib/components/RequestButton/RequestButton.svelte';
	import RequestedByPill from '$lib/components/RequestedByPill.svelte';
	import {
		handleRequestMovie,
		scheduleNoReleasesCheck
	} from '$lib/components/RequestButton/requestActions';
	import RequestModal from '$lib/components/RequestModal/RequestModal.svelte';
	import OpenInButton from '$lib/components/TitlePageLayout/OpenInButton.svelte';
	import TitlePageLayout from '$lib/components/TitlePageLayout/TitlePageLayout.svelte';
	import { playerState } from '$lib/components/VideoPlayer/VideoPlayer';
	import StreamButton from '$lib/components/StreamButton/StreamButton.svelte';
	import StreamListModal from '$lib/components/StreamList/StreamListModal.svelte';
	import { page } from '$app/stores';
	import {
		createJellyfinItemStore,
		createRadarrDownloadStore,
		createRadarrMovieStore
	} from '$lib/stores/data.store';
	import { modalStack } from '$lib/stores/modal.store';
	import {
		sessionQualityProfile,
		setRadarrProfile
	} from '$lib/stores/sessionQualityProfile';
	import { settings } from '$lib/stores/settings.store';
	import { formatMinutesToTime, formatSize } from '$lib/utils';
	import classNames from 'classnames';
	import { Archive, ChevronRight, DotFilled } from 'radix-icons-svelte';
	import { onDestroy, onMount, type ComponentProps } from 'svelte';
	import { writable } from 'svelte/store';
	import { _ } from 'svelte-i18n';

	export let tmdbId: number;
	export let isModal = false;
	export let handleCloseModal: () => void = () => {};

	const tmdbUrl = 'https://www.themoviedb.org/movie/' + tmdbId;
	const data = getTmdbMovie(tmdbId);
	const recommendationData = preloadRecommendationData();

	const jellyfinItemStore = createJellyfinItemStore(tmdbId);
	const radarrMovieStore = createRadarrMovieStore(tmdbId);
	const radarrDownloadStore = createRadarrDownloadStore(radarrMovieStore);

	async function preloadRecommendationData() {
		const tmdbRecommendationProps = getTmdbMovieRecommendations(tmdbId)
			.then((r) => Promise.all(r.map(fetchCardTmdbProps)))
			.then((r) => r.filter((p) => p.backdropUrl));
		const tmdbSimilarProps = getTmdbMovieSimilar(tmdbId)
			.then((r) => Promise.all(r.map(fetchCardTmdbProps)))
			.then((r) => r.filter((p) => p.backdropUrl));

		const castPropsPromise: Promise<ComponentProps<PersonCard>[]> = data.then((m) =>
			Promise.all(
				m?.credits?.cast?.slice(0, 20).map((m) => ({
					tmdbId: m.id || 0,
					backdropUri: m.profile_path || '',
					name: m.name || '',
					subtitle: m.character || m.known_for_department || ''
				})) || []
			)
		);

		return {
			tmdbRecommendationProps: await tmdbRecommendationProps,
			tmdbSimilarProps: await tmdbSimilarProps,
			castProps: await castPropsPromise,	
		};
	}

	function play() {
		if ($jellyfinItemStore.item?.Id) playerState.streamJellyfinId($jellyfinItemStore.item?.Id);
	}

	async function refreshRadarr() {
		await radarrMovieStore.refreshIn();
	}

	const radarrQualityProfiles = writable<RadarrQualityProfile[]>([]);
	listRadarrQualityProfiles().then((p) => radarrQualityProfiles.set(p));

	let movieProgress: { percent: number; label?: string } | null = null;
	let movieStalled = false;
	let showStreamModal = false;
	$: isOnlineMode = $page.data?.user?.mode === 'online';

	$: movieAwaiting = (() => {
		const rm: any = $radarrMovieStore.item;
		if (!rm?.id || rm.hasFile || movieProgress) return null;
		const releaseRaw = rm.digitalRelease || rm.physicalRelease || rm.inCinemas || null;
		const release = releaseRaw ? new Date(releaseRaw) : null;
		if (release && release.getTime() > Date.now()) {
			return {
				note: `Releases ${release.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
				sub: rm.status === 'announced' ? 'Announced — not in cinemas yet' : 'Not yet available digitally'
			};
		}
		if (rm.status === 'announced' || rm.status === 'inCinemas') {
			return { note: 'Not yet released digitally', sub: 'Will grab automatically once a release surfaces' };
		}
		return { note: 'Searching for release…', sub: 'No matching releases on indexers yet' };
	})();
	let progressTimer: ReturnType<typeof setInterval> | null = null;
	let lastPct: number | null = null;
	let lastPctAt: number = 0;
	const STALL_MS = 10 * 60 * 1000; // 10 minutes
	let cancelNoReleasesCheck: (() => void) | null = null;

	async function refreshProgress() {
		try {
			const q = await getRadarrDownloadsByTmdbId(tmdbId);
			if (q && q.length) {
				const d: any = q[0];
				const size = d.size || 1;
				const sizeleft = d.sizeleft || 0;
				const pct = Math.round(((size - sizeleft) / size) * 100);
				const profName =
					($radarrQualityProfiles.find((p) => p.id === d.movie?.qualityProfileId) || {}).name ??
					'';
				movieProgress = {
					percent: pct,
					label: profName ? `Downloading ${profName}` : 'Downloading'
				};

				// A real download appeared — cancel any pending no-releases warning.
				if (cancelNoReleasesCheck) {
					cancelNoReleasesCheck();
					cancelNoReleasesCheck = null;
				}

				// Stalled detection: pct hasn't changed for STALL_MS and < 100.
				const now = Date.now();
				if (lastPct === null || pct !== lastPct) {
					lastPct = pct;
					lastPctAt = now;
					movieStalled = false;
				} else if (pct < 100 && now - lastPctAt >= STALL_MS) {
					movieStalled = true;
				}
			} else {
				movieProgress = null;
				movieStalled = false;
				lastPct = null;
				lastPctAt = 0;
			}
		} catch {
			movieProgress = null;
			movieStalled = false;
		}
	}

	async function handleMovieRequest(profileId: number) {
		setRadarrProfile(profileId);
		await handleRequestMovie(tmdbId, profileId);
		await refreshRadarr();
		await refreshProgress();
		startPolling();

		// Schedule a "no releases found" check 60s after requesting. If by then the
		// queue is still empty AND the movie has no file, mark as failed with a warning.
		if (cancelNoReleasesCheck) cancelNoReleasesCheck();
		cancelNoReleasesCheck = scheduleNoReleasesCheck(
			`movie:${tmdbId}`,
			'Movie',
			async () => {
				try {
					const q = await getRadarrDownloadsByTmdbId(tmdbId);
					const hasQueue = !!(q && q.length);
					const hasFile = !!$radarrMovieStore.item?.hasFile;
					return !hasQueue && !hasFile;
				} catch {
					return false;
				}
			}
		);
	}

	function startPolling() {
		if (progressTimer) return;
		progressTimer = setInterval(refreshProgress, 5000);
	}

	onMount(() => {
		refreshProgress();
		startPolling();
	});
	onDestroy(() => {
		if (progressTimer) clearInterval(progressTimer);
		if (cancelNoReleasesCheck) cancelNoReleasesCheck();
	});

	function openAdvancedRelease() {
		if (!$radarrMovieStore.item?.id) {
			// Movie not yet in Radarr — add it first with the current profile, then open the picker.
			handleMovieRequest(
				$sessionQualityProfile.radarr ?? $settings.radarr.qualityProfileId
			).then(() => {
				setTimeout(openAdvancedRelease, 500);
			});
			return;
		}
		modalStack.create(RequestModal, { radarrId: $radarrMovieStore.item.id });
	}
</script>

{#await data}
	<TitlePageLayout {isModal} {handleCloseModal} />
{:then movie }
	<TitlePageLayout
		titleInformation={{
			tmdbId,
			type: 'movie',
			title: movie?.title || 'Movie',
			backdropUriCandidates: movie?.images?.backdrops?.map((b) => b.file_path || '') || [],
			posterPath: movie?.poster_path || '',
			tagline: movie?.tagline || movie?.title || '',
			overview: movie?.overview || ''
		}}
		{isModal}
		{handleCloseModal}
	>
		<svelte:fragment slot="title-info">
			{new Date(movie?.release_date || Date.now()).getFullYear()}
			<DotFilled />
			{@const progress = $jellyfinItemStore.item?.UserData?.PlayedPercentage}
			{#if progress}
				{progress.toFixed()} {$_('library.content.minLeft')}
			{:else}
				{movie?.runtime} min
			{/if}
			<DotFilled />
			<a href={tmdbUrl} target="_blank">{movie?.vote_average?.toFixed(1)} TMDB</a>
		</svelte:fragment>
		<svelte:fragment slot="episodes-carousel">
			{@const progress = $jellyfinItemStore.item?.UserData?.PlayedPercentage}
			{#if progress}
				<div
					class={classNames('px-2 sm:px-4 lg:px-8', {
						'2xl:px-0': !isModal
					})}
				>
					<ProgressBar {progress} />
				</div>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="title-right">
			<div class="flex flex-col gap-3 items-end lg:items-start">
				<RequestedByPill {tmdbId} type="movie" />
			<div
				class="flex gap-2 items-center flex-row-reverse justify-end lg:flex-row lg:justify-start"
			>
				{#if $jellyfinItemStore.loading || $radarrMovieStore.loading}
					<div class="placeholder h-10 w-48 rounded-xl" />
				{:else}
					{@const jellyfinItem = $jellyfinItemStore.item}
					{@const radarrMovie = $radarrMovieStore.item}
					<OpenInButton title={movie?.title} {jellyfinItem} {radarrMovie} type="movie" {tmdbId} />
					{#if jellyfinItem}
						<Button type="primary" on:click={play}>
							<span>{$_('library.content.play')}</span><ChevronRight size={20} />
						</Button>
					{:else if isOnlineMode}
						<StreamButton
							label="Stream"
							on:click={() => (showStreamModal = true)}
						/>
					{:else if $settings.radarr.baseUrl && $settings.radarr.apiKey}
						{@const tmdbReleaseTs = movie?.release_date ? new Date(movie.release_date).getTime() : 0}
						{@const tmdbUpcoming = !!tmdbReleaseTs && tmdbReleaseTs > Date.now()}
						{@const tmdbAwaiting = tmdbUpcoming
							? {
									note: `Releases ${new Date(tmdbReleaseTs).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
									sub: 'Not yet released'
							  }
							: null}
						<RequestButton
							label={$_('library.content.requestMovie') ?? 'Request Movie'}
							variant="movie"
							stateKey={`movie:${tmdbId}`}
							profiles={$radarrQualityProfiles}
							selectedProfileId={$sessionQualityProfile.radarr ?? $settings.radarr.qualityProfileId}
							downloading={movieProgress}
							stalled={movieStalled}
							done={!!radarrMovie?.hasFile}
							awaiting={movieAwaiting ?? tmdbAwaiting}

							on:request={(e) => handleMovieRequest(e.detail.profileId)}
							on:advanced={openAdvancedRelease}
							on:retry={() =>
								handleMovieRequest(
									$sessionQualityProfile.radarr ?? $settings.radarr.qualityProfileId
								)}
						/>
					{/if}
				{/if}
			</div>
			</div>
		</svelte:fragment>

		<svelte:fragment slot="info-components">
			<div class="col-span-2 lg:col-span-1">
				<p class="text-zinc-400 text-sm">{$_('library.content.directedBy')}</p>
				<h2 class="font-medium">
					{movie?.credits.crew
						?.filter((c) => c.job == 'Director')
						.map((p) => p.name)
						.join(', ')}
				</h2>
			</div>
			<div class="col-span-2 lg:col-span-1">
				<p class="text-zinc-400 text-sm">{$_('library.content.releaseDate')}</p>
				<h2 class="font-medium">
					{new Date(movie?.release_date || Date.now()).toLocaleDateString($settings.language, {
						year: 'numeric',
						month: 'short',
						day: 'numeric'
					})}
				</h2>
			</div>
			{#if movie?.budget}
				<div class="col-span-2 lg:col-span-1">
					<p class="text-zinc-400 text-sm">{$_('library.content.budget')}</p>
					<h2 class="font-medium">
						{movie?.budget?.toLocaleString('en-US', {
							style: 'currency',
							currency: 'USD'
						})}
					</h2>
				</div>
			{/if}
			{#if movie?.revenue}
				<div class="col-span-2 lg:col-span-1">
					<p class="text-zinc-400 text-sm">{$_('library.content.revenue')}</p>
					<h2 class="font-medium">
						{movie?.revenue?.toLocaleString('en-US', {
							style: 'currency',
							currency: 'USD'
						})}
					</h2>
				</div>
			{/if}
			<div class="col-span-2 lg:col-span-1">
				<p class="text-zinc-400 text-sm">{$_('library.content.status')}</p>
				<h2 class="font-medium">
					{movie?.status}
				</h2>
			</div>
			<div class="col-span-2 lg:col-span-1">
				<p class="text-zinc-400 text-sm">{$_('library.content.runtime')}</p>
				<h2 class="font-medium">
					{movie?.runtime} Minutes
				</h2>
			</div>
		</svelte:fragment>

		<svelte:fragment slot="servarr-components">
			{@const radarrMovie = $radarrMovieStore.item}
			{#if radarrMovie}
				{#if radarrMovie?.movieFile?.quality}
					<div class="col-span-2 lg:col-span-1">
						<p class="text-zinc-400 text-sm">Video</p>
						<h2 class="font-medium">
							{radarrMovie?.movieFile?.quality.quality?.name}
						</h2>
					</div>
				{/if}
				{#if radarrMovie?.movieFile?.size}
					<div class="col-span-2 lg:col-span-1">
						<p class="text-zinc-400 text-sm">{$_('library.content.sizeDisk')}</p>
						<h2 class="font-medium">
							{formatSize(radarrMovie?.movieFile?.size || 0)}
						</h2>
					</div>
				{/if}
				{#if $radarrDownloadStore.downloads?.length}
					{@const download = $radarrDownloadStore.downloads[0]}
					<div class="col-span-2 lg:col-span-1">
						<p class="text-zinc-400 text-sm">{$_('library.content.downloadedIn')}</p>
						<h2 class="font-medium">
							{download?.estimatedCompletionTime
								? formatMinutesToTime(
										(new Date(download.estimatedCompletionTime).getTime() - Date.now()) / 1000 / 60
								  )
								: 'Stalled'}
						</h2>
					</div>
				{/if}

				{#if !isOnlineMode}
					<div class="flex gap-4 flex-wrap col-span-4 sm:col-span-6 mt-4">
						<RequestButton
							label={$_('library.content.requestMovie') ?? 'Request Movie'}
							variant="movie"
							stateKey={`movie:${tmdbId}`}
							profiles={$radarrQualityProfiles}
							selectedProfileId={$sessionQualityProfile.radarr ?? $settings.radarr.qualityProfileId}
							downloading={movieProgress}
							done={!!radarrMovie?.hasFile}
							on:request={(e) => handleMovieRequest(e.detail.profileId)}
							on:advanced={openAdvancedRelease}
							on:retry={() =>
								handleMovieRequest(
									$sessionQualityProfile.radarr ?? $settings.radarr.qualityProfileId
								)}
						/>
						<Button>
							<span class="mr-2">{$_('library.content.manage')}</span><Archive size={20} />
						</Button>
					</div>
				{/if}
			{:else if $radarrMovieStore.loading}
				<div class="flex gap-4 flex-wrap col-span-4 sm:col-span-6 mt-4">
					<div class="placeholder h-10 w-40 rounded-xl" />
					<div class="placeholder h-10 w-40 rounded-xl" />
				</div>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="carousels">
			{#await recommendationData}
				<Carousel gradientFromColor="from-stone-950">
					<div slot="title" class="font-medium text-lg">{$_('library.content.castAndCrew')}</div>
					<CarouselPlaceholderItems />
				</Carousel>

				<Carousel gradientFromColor="from-stone-950">
					<div slot="title" class="font-medium text-lg">{$_('library.content.recommendations')}</div>
					<CarouselPlaceholderItems />
				</Carousel>

				<Carousel gradientFromColor="from-stone-950">
					<div slot="title" class="font-medium text-lg">{$_('library.content.similarSeries')}</div>
					<CarouselPlaceholderItems />
				</Carousel>
			{:then { castProps, tmdbRecommendationProps, tmdbSimilarProps }}
				{#if castProps?.length}
					<Carousel gradientFromColor="from-stone-950">
						<div slot="title" class="font-medium text-lg">{$_('library.content.castAndCrew')}</div>
						{#each castProps as prop}
							<PersonCard {...prop} />
						{/each}
					</Carousel>
				{/if}

				{#if tmdbRecommendationProps?.length}
					<Carousel gradientFromColor="from-stone-950">
						<div slot="title" class="font-medium text-lg">{$_('library.content.recommendations')}</div>
						{#each tmdbRecommendationProps as prop}
							<Card {...prop} openInModal={isModal} />
						{/each}
					</Carousel>
				{/if}

				{#if tmdbSimilarProps?.length}
					<Carousel gradientFromColor="from-stone-950">
						<div slot="title" class="font-medium text-lg">{$_('library.content.similarSeries')}</div>
						{#each tmdbSimilarProps as prop}
							<Card {...prop} openInModal={isModal} />
						{/each}
					</Carousel>
				{/if}
			{/await}
		</svelte:fragment>
	</TitlePageLayout>
{/await}

{#await data then movie}
	{#if showStreamModal && movie}
		<StreamListModal
			bind:visible={showStreamModal}
			title={movie.title ?? ''}
			posterUrl={movie.poster_path ? `https://image.tmdb.org/t/p/w92${movie.poster_path}` : null}
			streamsUrl={`/api/stream/movie/${tmdbId}`}
			subtitlesUrl={`/api/subtitles/movie/${tmdbId}`}
		/>
	{/if}
{/await}
