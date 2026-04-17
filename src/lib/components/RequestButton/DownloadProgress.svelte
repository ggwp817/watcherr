<!-- src/lib/components/RequestButton/DownloadProgress.svelte -->
<script lang="ts">
	// Minimal button + thin bar below (variant B from the design).
	export let label: string;       // e.g. "Downloading 1080p"
	export let percent: number;     // 0..100
	export let stalled = false;
	$: clamped = Math.max(0, Math.min(100, Math.round(percent)));
</script>

<div class="flex flex-col items-stretch gap-1 min-w-[220px]">
	<div
		class="flex items-center justify-between gap-3 px-4 py-2
		       rounded-xl bg-zinc-800/70 text-zinc-100 text-sm font-medium"
	>
		<span class="flex items-center gap-2">
			<span class="inline-block h-3 w-3 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
			{label}
		</span>
		<span class="tabular-nums text-zinc-300">{clamped}%</span>
	</div>
	<div class="h-[2px] w-full bg-zinc-800 rounded-full overflow-hidden">
		<div
			class="h-full rounded-full transition-all duration-500"
			class:bg-green-500={!stalled}
			class:bg-orange-400={stalled}
			style="width: {clamped}%"
		/>
	</div>
</div>
