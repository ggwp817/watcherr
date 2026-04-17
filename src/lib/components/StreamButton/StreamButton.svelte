<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let label = 'Stream';
	export let loading = false;
	export let disabled = false;

	const dispatch = createEventDispatcher<{ click: void }>();
</script>

<button
	type="button"
	{disabled}
	on:click={() => dispatch('click')}
	class="inline-flex items-center gap-2 px-4 py-2 rounded-xl
	       bg-gradient-to-br from-amber-300 to-amber-400 text-stone-950
	       text-sm font-semibold shadow-lg shadow-amber-500/20
	       hover:from-amber-200 hover:to-amber-300
	       disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer"
>
	{#if loading}
		<span class="inline-block h-3 w-3 rounded-full border-2 border-stone-950/40 border-t-transparent animate-spin"></span>
		<span>Loading…</span>
	{:else}
		<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
			<path d="M8 5v14l11-7z" />
		</svg>
		<span>{label}</span>
	{/if}
</button>
