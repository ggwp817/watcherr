<!-- src/lib/components/RequestButton/RequestButton.svelte -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { Plus, ChevronDown } from 'radix-icons-svelte';
	import { page } from '$app/stores';
	import QualityProfileDropdown from './QualityProfileDropdown.svelte';
	import DownloadProgress from './DownloadProgress.svelte';
	import { requestState } from '$lib/stores/requestState';

	$: isOnlineMode = $page.data?.user?.mode === 'online';

	export let label: string;                    // "Request Movie", "Request Series", ...
	export let variant: 'movie' | 'series' | 'season' | 'episode' = 'movie';
	export let stateKey: string;                 // e.g. "movie:<tmdbId>"
	export let profiles: { id: number; name: string }[] = [];
	export let selectedProfileId: number | null = null;
	export let downloading: { percent: number; label?: string } | null = null;
	export let done: boolean = false;            // e.g. available in library
	export let stalled: boolean = false;
	export let awaiting: { note: string; sub?: string } | null = null; // e.g. upcoming / no releases yet

	const dispatch = createEventDispatcher<{
		request: { profileId: number };
		advanced: void;
		retry: void;
	}>();

	$: requesting = $requestState.requesting.has(stateKey);
	$: failed = $requestState.failed.get(stateKey) ?? null;

	let open = false;
	let rootEl: HTMLDivElement;
	onMount(() => {
		const onDocClick = (e: MouseEvent) => {
			if (rootEl && !rootEl.contains(e.target as Node)) open = false;
		};
		document.addEventListener('click', onDocClick);
		return () => document.removeEventListener('click', onDocClick);
	});

	function fireRequest() {
		const pid = selectedProfileId ?? profiles[0]?.id;
		if (pid == null) return;
		dispatch('request', { profileId: pid });
	}

	function pickProfile(id: number) {
		selectedProfileId = id;
		open = false;
		dispatch('request', { profileId: id });
	}
</script>

{#if !isOnlineMode}
<div class="relative inline-flex items-stretch" bind:this={rootEl}>
	{#if downloading}
		<DownloadProgress label={downloading.label ?? 'Downloading'} percent={downloading.percent} {stalled} />
	{:else if done}
		<div
			class="inline-flex items-center gap-2 px-4 py-2 rounded-xl
			       bg-green-500/15 text-green-400 text-sm font-semibold"
		>
			✓ Available in Library
		</div>
	{:else if awaiting}
		<div
			class="inline-flex flex-col items-start gap-0.5 px-4 py-2 rounded-xl
			       bg-amber-500/15 text-amber-300 text-sm font-semibold"
			title={awaiting.sub ?? ''}
		>
			<span class="flex items-center gap-2">
				<span class="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
				{awaiting.note}
			</span>
			{#if awaiting.sub}
				<span class="text-[11px] font-normal text-amber-200/80">{awaiting.sub}</span>
			{/if}
		</div>
	{:else}
		<!-- split button -->
		<button
			type="button"
			disabled={requesting}
			on:click={fireRequest}
			class="inline-flex items-center gap-2 pl-4 pr-3 py-2 rounded-l-xl
			       text-sm font-semibold transition
			       {failed ? 'bg-red-500/90 text-white hover:bg-red-500'
			                : 'bg-white text-black hover:bg-zinc-200'}
			       disabled:opacity-70 disabled:cursor-wait"
			aria-label={label}
		>
			{#if requesting}
				<span class="inline-block h-3 w-3 rounded-full border-2 border-black/40 border-t-transparent animate-spin" />
				<span>Requesting…</span>
			{:else if failed}
				<span>Failed</span>
			{:else}
				<Plus size={16} />
				<span>{label}</span>
			{/if}
		</button>
		<button
			type="button"
			on:click|stopPropagation={() => (open = !open)}
			aria-label="Options"
			class="inline-flex items-center px-2 py-2 rounded-r-xl border-l
			       border-black/10 transition
			       {failed ? 'bg-red-500/90 text-white hover:bg-red-500'
			                : 'bg-zinc-200 text-black hover:bg-zinc-300'}"
		>
			<ChevronDown size={16} />
		</button>
	{/if}

	{#if open}
		<div class="absolute right-0 top-full mt-2 z-40">
			<QualityProfileDropdown
				{profiles}
				selectedId={selectedProfileId}
				on:pick={(e) => pickProfile(e.detail.id)}
				on:advanced={() => {
					open = false;
					dispatch('advanced');
				}}
			/>
			{#if failed}
				<button
					class="mt-2 w-full text-center text-xs text-zinc-400 hover:text-white
					       bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2"
					on:click={() => {
						requestState.clearFailed(stateKey);
						open = false;
						dispatch('retry');
					}}
				>
					Retry
				</button>
			{/if}
		</div>
	{/if}
</div>
{/if}
