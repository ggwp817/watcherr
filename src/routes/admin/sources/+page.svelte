<script lang="ts">
	import RadarrStats from '$lib/components/SourceStats/RadarrStats.svelte';
	import SonarrStats from '$lib/components/SourceStats/SonarrStats.svelte';
</script>

<div class="mb-6">
	<h1 class="text-2xl font-bold tracking-tight">Sources</h1>
	<p class="mt-1 text-sm text-zinc-500">Media provider stats and disk usage.</p>
</div>

<div class="flex flex-col gap-4">
	<RadarrStats large />
	<SonarrStats large />
</div>
