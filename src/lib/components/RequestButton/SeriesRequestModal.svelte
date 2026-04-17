<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Writable } from 'svelte/store';
	import { modalStack } from '$lib/stores/modal.store';
	import QualityProfileDropdown from './QualityProfileDropdown.svelte';
	import type { RadarrQualityProfile } from '$lib/apis/radarr/radarrApi';
	import type { SonarrSeries } from '$lib/apis/sonarr/sonarrApi';
	import { ChevronDown, ChevronRight, Gear, Play, Cross2 } from 'radix-icons-svelte';

	type QueueItem = {
		episodeId?: number;
		seasonNumber?: number;
		size?: number;
		sizeleft?: number;
		status?: string;
		trackedDownloadState?: string;
		trackedDownloadStatus?: string;
		timeleft?: string;
		downloadClient?: string;
	};

	type EpStatus =
		| { kind: 'have' }
		| { kind: 'missing' }
		| { kind: 'waiting' }
		| { kind: 'queued'; timeleft?: string; client?: string }
		| { kind: 'downloading'; pct: number; timeleft?: string; client?: string }
		| { kind: 'importing' }
		| { kind: 'warning'; message?: string };

	export let modalId: symbol;
	export let seriesName: string;
	export let seasons: Array<{
		seasonNumber: number;
		episodeCount: number;
		episodeFileCount: number;
		episodes?: Array<{ id?: number; episodeNumber: number; name?: string; hasFile: boolean }>;
	}> = [];
	export let existingSonarrSeries: SonarrSeries | undefined = undefined;
	export let queueStore: Writable<QueueItem[]>;
	export let requestedEpisodeIds: Writable<Set<number>>;
	export let requestedSeasons: Writable<Set<number>>;
	export let profiles: RadarrQualityProfile[] = [];
	export let selectedProfileId: number;
	export let onConfirm: (picks: {
		seasonPacks: number[];
		episodeIds: number[];
		profileId: number;
	}) => Promise<void>;
	export let onPlayEpisode: (episodeId: number) => void = () => {};
	export let onClose: () => void = () => {};

	$: queue = $queueStore;
	$: requestedEps = $requestedEpisodeIds;
	$: pendingSeasons = $requestedSeasons;

	$: visibleSeasons = seasons.filter((s) => s.seasonNumber !== 0 || seasons.length === 1);

	function classifyQueueItem(q: QueueItem): EpStatus {
		const state = (q.trackedDownloadState ?? '').toLowerCase();
		const status = (q.status ?? '').toLowerCase();
		const trackedStatus = (q.trackedDownloadStatus ?? '').toLowerCase();
		if (trackedStatus === 'warning') {
			return { kind: 'warning', message: state || status };
		}
		if (state.includes('import')) return { kind: 'importing' };
		if (status === 'completed' || state === 'imported') return { kind: 'importing' };
		const size = q.size ?? 0;
		const sizeleft = q.sizeleft ?? size;
		const done = size > 0 ? ((size - sizeleft) / size) * 100 : 0;
		if (status === 'queued' || status === 'paused' || sizeleft >= size) {
			return { kind: 'queued', timeleft: q.timeleft, client: q.downloadClient };
		}
		return { kind: 'downloading', pct: done, timeleft: q.timeleft, client: q.downloadClient };
	}

	$: queueByEpisode = (() => {
		const m = new Map<number, EpStatus>();
		for (const q of queue ?? []) {
			if (q.episodeId) m.set(q.episodeId, classifyQueueItem(q));
		}
		return m;
	})();

	$: queueBySeason = (() => {
		const m = new Map<number, { total: number; downloading: number; queued: number; importing: number; warning: number }>();
		for (const q of queue ?? []) {
			if (typeof q.seasonNumber !== 'number') continue;
			const bucket = m.get(q.seasonNumber) ?? { total: 0, downloading: 0, queued: 0, importing: 0, warning: 0 };
			bucket.total++;
			const cls = classifyQueueItem(q);
			if (cls.kind === 'downloading') bucket.downloading++;
			else if (cls.kind === 'queued') bucket.queued++;
			else if (cls.kind === 'importing') bucket.importing++;
			else if (cls.kind === 'warning') bucket.warning++;
			m.set(q.seasonNumber, bucket);
		}
		return m;
	})();

	function statusForEpisode(ep: { id?: number; hasFile: boolean }): EpStatus {
		if (ep.hasFile) return { kind: 'have' };
		if (ep.id !== undefined) {
			const live = queueByEpisode.get(ep.id);
			if (live) return live;
			if (requestedEps.has(ep.id)) return { kind: 'waiting' };
		}
		return { kind: 'missing' };
	}

	type RowState = {
		expanded: boolean;
		checked: boolean;
		episodes: Map<number, boolean>;
	};
	let rows = new Map<number, RowState>();
	$: {
		for (const s of visibleSeasons) {
			if (!rows.has(s.seasonNumber)) {
				rows.set(s.seasonNumber, { expanded: false, checked: false, episodes: new Map() });
			}
		}
		rows = rows;
	}

	let showProfilePopover = false;

	function seasonStatus(s: typeof visibleSeasons[number]): 'complete' | 'partial' | 'missing' {
		if (s.episodeFileCount >= s.episodeCount && s.episodeCount > 0) return 'complete';
		if (s.episodeFileCount > 0) return 'partial';
		return 'missing';
	}

	function toggleExpand(n: number) {
		const r = rows.get(n);
		if (!r) return;
		r.expanded = !r.expanded;
		rows = rows;
	}

	function toggleSeason(n: number) {
		const season = visibleSeasons.find((s) => s.seasonNumber === n);
		const r = rows.get(n);
		if (!season || !r) return;
		const status = seasonStatus(season);
		if (status === 'complete') return;
		r.checked = !r.checked;
		if (r.checked && status === 'partial') {
			for (const ep of season.episodes ?? []) {
				if (ep.id !== undefined && !ep.hasFile && !queueByEpisode.has(ep.id)) {
					r.episodes.set(ep.id, true);
				}
			}
		} else if (!r.checked) {
			r.episodes.clear();
		}
		rows = rows;
	}

	function toggleEpisode(seasonNumber: number, episodeId: number) {
		const r = rows.get(seasonNumber);
		if (!r) return;
		const cur = r.episodes.get(episodeId) ?? false;
		r.episodes.set(episodeId, !cur);
		rows = rows;
	}

	function buildSelection(): { seasonPacks: number[]; episodeIds: number[] } {
		const seasonPacks: number[] = [];
		const episodeIds: number[] = [];
		for (const s of visibleSeasons) {
			const r = rows.get(s.seasonNumber);
			if (!r) continue;
			const status = seasonStatus(s);
			if (r.checked && status === 'missing') {
				seasonPacks.push(s.seasonNumber);
				continue;
			}
			for (const [epId, picked] of r.episodes.entries()) {
				if (picked) episodeIds.push(epId);
			}
		}
		return { seasonPacks, episodeIds };
	}

	// @ts-expect-error - comma operator forces reactivity on `rows`
	$: selection = (rows, buildSelection());
	$: totalSelected = selection.seasonPacks.length + selection.episodeIds.length;
	$: summaryText = (() => {
		const parts: string[] = [];
		if (selection.seasonPacks.length)
			parts.push(selection.seasonPacks.length === 1 ? '1 season' : `${selection.seasonPacks.length} seasons`);
		if (selection.episodeIds.length)
			parts.push(selection.episodeIds.length === 1 ? '1 episode' : `${selection.episodeIds.length} episodes`);
		return parts.join(' · ') || 'Nothing selected';
	})();

	async function confirm() {
		if (!totalSelected) return;
		const picks = { ...selection, profileId: selectedProfileId };
		// Mark them as waiting immediately so UI updates before the network call settles.
		requestedEpisodeIds.update((s) => {
			const next = new Set(s);
			for (const id of picks.episodeIds) next.add(id);
			return next;
		});
		requestedSeasons.update((s) => {
			const next = new Set(s);
			for (const n of picks.seasonPacks) next.add(n);
			return next;
		});
		// Clear checkboxes so user sees the pending state, not their selection.
		for (const r of rows.values()) {
			r.checked = false;
			r.episodes.clear();
		}
		rows = rows;
		await onConfirm(picks);
	}

	function pickProfile(id: number) {
		selectedProfileId = id;
		showProfilePopover = false;
	}

	function formatTimeleft(t?: string): string | undefined {
		if (!t) return undefined;
		// Sonarr returns "00:05:23" or "1.00:05:23". Strip days block and leading zeros.
		const m = t.match(/(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})/);
		if (!m) return t;
		const [, d, hh, mm] = m;
		const h = parseInt(hh, 10);
		const min = parseInt(mm, 10);
		if (d) return `${d}d ${h}h`;
		if (h > 0) return `${h}h ${min}m`;
		return `${min}m`;
	}

	onDestroy(() => {
		onClose();
	});
</script>

<div class="contents">
	<div class="w-[min(680px,94vw)] max-h-[86vh] bg-zinc-900/95 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl">
		<!-- Header -->
		<div class="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-3">
			<div class="min-w-0">
				<div class="text-lg font-semibold text-zinc-100 truncate">{seriesName}</div>
				<div class="text-xs text-zinc-400 mt-0.5">
					{visibleSeasons.length} season{visibleSeasons.length === 1 ? '' : 's'} ·
					{visibleSeasons.reduce((a, s) => a + s.episodeCount, 0)} episodes
				</div>
			</div>
			<div class="flex items-center gap-1">
				<div class="relative">
					<button
						class="p-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition"
						on:click={() => (showProfilePopover = !showProfilePopover)}
						aria-label="Quality profile"
					>
						<Gear size={16} />
					</button>
					{#if showProfilePopover}
						<div class="absolute right-0 mt-2 z-10">
							<QualityProfileDropdown
								{profiles}
								selectedId={selectedProfileId}
								showAdvanced={false}
								on:pick={(e) => pickProfile(e.detail.id)}
							/>
						</div>
					{/if}
				</div>
				<button
					class="p-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition"
					on:click={() => modalStack.close(modalId)}
					aria-label="Close"
				>
					<Cross2 size={16} />
				</button>
			</div>
		</div>

		<!-- Body -->
		<div class="flex-1 overflow-auto p-3 space-y-2">
			{#each visibleSeasons as s (s.seasonNumber)}
				{@const status = seasonStatus(s)}
				{@const r = rows.get(s.seasonNumber)}
				{@const seasonQueue = queueBySeason.get(s.seasonNumber)}
				{@const isPending = pendingSeasons.has(s.seasonNumber) && !seasonQueue}
				<div
					class="rounded-xl bg-zinc-800/50 border p-3 transition-colors"
					style="border-color: {status === 'complete'
						? 'rgba(16,185,129,0.35)'
						: status === 'partial'
						? 'rgba(245,158,11,0.35)'
						: isPending
						? 'rgba(139,92,246,0.45)'
						: seasonQueue
						? 'rgba(56,189,248,0.35)'
						: 'rgba(255,255,255,0.08)'};"
				>
					<div class="flex items-center justify-between gap-2">
						<label class="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
							<input
								type="checkbox"
								class="accent-sky-500 w-4 h-4 cursor-pointer"
								checked={r?.checked ?? false}
								disabled={status === 'complete'}
								on:change={() => toggleSeason(s.seasonNumber)}
							/>
							<div class="min-w-0 flex-1">
								<div class="text-sm font-medium text-zinc-100">
									{s.seasonNumber === 0 ? 'Specials' : `Season ${s.seasonNumber}`}
								</div>
								<div class="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
									<span
										class:text-emerald-400={status === 'complete'}
										class:text-amber-400={status === 'partial'}
										class:text-zinc-500={status === 'missing'}
									>
										{status === 'complete'
											? 'complete'
											: status === 'partial'
											? `${s.episodeFileCount} of ${s.episodeCount}`
											: 'missing'}
									</span>
									{#if isPending}
										<span class="text-violet-300 flex items-center gap-1">
											·
											<span class="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></span>
											searching
										</span>
									{:else if seasonQueue}
										<span class="text-sky-300">
											· {seasonQueue.downloading > 0
												? `${seasonQueue.downloading} downloading`
												: seasonQueue.importing > 0
												? `${seasonQueue.importing} importing`
												: seasonQueue.warning > 0
												? `${seasonQueue.warning} stalled`
												: `${seasonQueue.queued} queued`}
										</span>
									{/if}
								</div>
							</div>
						</label>
						<button
							class="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition"
							on:click={() => toggleExpand(s.seasonNumber)}
							aria-label="Toggle episodes"
						>
							{#if r?.expanded}
								<ChevronDown size={16} />
							{:else}
								<ChevronRight size={16} />
							{/if}
						</button>
					</div>

					{#if r?.expanded}
						<div class="mt-3 pl-7 space-y-0.5">
							{#each s.episodes ?? [] as ep (ep.episodeNumber)}
								{@const epStatus = statusForEpisode(ep)}
								{@const epId = ep.id}
								{@const canSelect = !ep.hasFile && epStatus.kind !== 'queued' && epStatus.kind !== 'downloading' && epStatus.kind !== 'importing' && epStatus.kind !== 'waiting' && epId !== undefined}
								<div class="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded-md hover:bg-white/[0.02]">
									<label class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
										<input
											type="checkbox"
											class="accent-sky-500 w-3.5 h-3.5 cursor-pointer"
											checked={ep.hasFile || (epId !== undefined ? r.episodes.get(epId) ?? false : false)}
											disabled={!canSelect}
											on:change={() => epId !== undefined && toggleEpisode(s.seasonNumber, epId)}
										/>
										<span class="truncate text-zinc-200">
											<span class="text-zinc-500 tabular-nums">E{String(ep.episodeNumber).padStart(2, '0')}</span>
											{#if ep.name}
												<span class="ml-1">{ep.name}</span>
											{/if}
										</span>
									</label>
									{#if epStatus.kind === 'have'}
										<button
											class="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition"
											on:click={() => epId !== undefined && onPlayEpisode(epId)}
										>
											<Play size={12} /> Play
										</button>
									{:else if epStatus.kind === 'downloading'}
										<div
											class="px-2.5 py-1 rounded-md bg-sky-500/15 text-sky-300 text-xs font-semibold flex items-center gap-1.5 border border-sky-500/30"
											title={epStatus.client ?? ''}
										>
											<span class="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
											{Math.round(epStatus.pct)}%{#if formatTimeleft(epStatus.timeleft)} · {formatTimeleft(epStatus.timeleft)}{/if}
										</div>
									{:else if epStatus.kind === 'queued'}
										<div class="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 text-xs font-semibold flex items-center gap-1.5 border border-amber-500/30">
											<span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span>
											queued
										</div>
									{:else if epStatus.kind === 'importing'}
										<div class="px-2.5 py-1 rounded-md bg-indigo-500/15 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 border border-indigo-500/30">
											<span class="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
											importing
										</div>
									{:else if epStatus.kind === 'warning'}
										<div class="px-2.5 py-1 rounded-md bg-rose-500/15 text-rose-300 text-xs font-semibold flex items-center gap-1.5 border border-rose-500/30" title={epStatus.message ?? 'Warning'}>
											<span>⚠</span>
											stalled
										</div>
									{:else if epStatus.kind === 'waiting'}
										<div class="px-2.5 py-1 rounded-md bg-violet-500/15 text-violet-300 text-xs font-semibold flex items-center gap-1.5 border border-violet-500/30">
											<span class="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></span>
											searching
										</div>
									{:else}
										<span class="text-[10px] uppercase tracking-wide text-zinc-500">missing</span>
									{/if}
								</div>
							{/each}
							{#if !(s.episodes ?? []).length}
								<div class="text-xs text-zinc-500 italic py-2">
									Episode list loads after the series is added to Sonarr.
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Footer -->
		<div class="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-3 bg-zinc-900/40">
			<div class="text-xs text-zinc-400">{summaryText}</div>
			<div class="flex items-center gap-2">
				<button
					class="px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-white/5 transition"
					on:click={() => modalStack.close(modalId)}
				>
					Cancel
				</button>
				<button
					class="px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition"
					disabled={totalSelected === 0}
					on:click={confirm}
				>
					Request selected
				</button>
			</div>
		</div>
	</div>
</div>
