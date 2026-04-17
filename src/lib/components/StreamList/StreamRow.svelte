<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import StreamExternalMenu from './StreamExternalMenu.svelte';

	export let stream: {
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

	$: audioLabel = stream.audioCodec && stream.audioCodec !== 'unknown'
		? stream.audioCodec.toUpperCase()
		: null;
	$: videoLabel = stream.videoCodec && stream.videoCodec !== 'unknown'
		? stream.videoCodec === 'h264'
			? 'H.264'
			: stream.videoCodec === 'h265'
				? 'HEVC'
				: stream.videoCodec.toUpperCase()
		: null;

	const dispatch = createEventDispatcher<{ pick: { url: string } }>();

	function openInVlc() {
		window.location.href = `vlc://${stream.url}`;
	}

	$: badgeClass =
		stream.quality === '4k'
			? 'bg-purple-500/20 text-purple-200 border-purple-400/40'
			: stream.quality === '1080p'
			  ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
			  : stream.quality === '720p'
			    ? 'bg-zinc-500/20 text-zinc-200 border-zinc-400/40'
			    : 'bg-zinc-700/30 text-zinc-300 border-zinc-600/40';

	$: qualityLabel =
		stream.quality === 'unknown' ? '?' : stream.quality.toUpperCase();

	function formatSize(bytes: number | null) {
		if (!bytes) return null;
		if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
		return `${Math.round(bytes / 1024 ** 2)} MB`;
	}
</script>

<div
	role="button"
	tabindex="0"
	on:click={openInVlc}
	on:keydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openInVlc();
		}
	}}
	class="w-full text-left flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3
	       px-3 py-3 rounded-lg border border-zinc-800
	       bg-zinc-900/60 hover:bg-zinc-800/80 hover:border-zinc-700
	       transition cursor-pointer"
>
	<div class="flex items-center gap-2 shrink-0">
		<span
			class="inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold tabular-nums {badgeClass}"
		>
			{qualityLabel}
		</span>
		{#if stream.hdr}
			<span
				class="inline-flex items-center px-1.5 py-0.5 rounded-md border border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200 text-[10px] font-bold"
				>HDR</span
			>
		{/if}
		{#if videoLabel}
			<span
				class="inline-flex items-center px-1.5 py-0.5 rounded-md border border-sky-400/30 bg-sky-500/10 text-sky-200 text-[10px] font-bold"
				>{videoLabel}</span
			>
		{/if}
		{#if audioLabel}
			<span
				class="inline-flex items-center px-1.5 py-0.5 rounded-md border border-zinc-600/30 bg-zinc-700/10 text-zinc-300 text-[10px] font-bold"
			>
				{audioLabel}
			</span>
		{/if}
	</div>
	<div class="min-w-0 flex-1">
		<div class="text-sm text-zinc-100 truncate">{stream.title}</div>
		<div class="text-[11px] text-zinc-500 flex flex-wrap gap-x-2">
			{#if stream.size}
				<span>{formatSize(stream.size)}</span>
			{/if}
			{#if stream.seeders != null}
				<span>↑ {stream.seeders.toLocaleString()}</span>
			{/if}
			<span>via {stream.source}</span>
		</div>
	</div>
	<div class="shrink-0">
		<StreamExternalMenu
			url={stream.url}
			on:playBrowser={() => dispatch('pick', { url: stream.url })}
		/>
	</div>
</div>
