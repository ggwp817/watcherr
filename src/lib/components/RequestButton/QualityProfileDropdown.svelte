<!-- src/lib/components/RequestButton/QualityProfileDropdown.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Check } from 'radix-icons-svelte';

	export let profiles: { id: number; name: string }[] = [];
	export let selectedId: number | null = null;
	export let showAdvanced = true;

	const dispatch = createEventDispatcher<{
		pick: { id: number };
		advanced: void;
	}>();
</script>

<div
	class="min-w-[200px] rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1
	       text-sm text-zinc-100"
>
	<div class="px-3 py-1.5 text-[11px] uppercase tracking-wider text-zinc-500">Quality</div>
	{#each profiles as p (p.id)}
		<button
			class="flex w-full items-center justify-between px-3 py-2 rounded-md
			       hover:bg-zinc-800 transition"
			on:click={() => dispatch('pick', { id: p.id })}
		>
			<span class={p.id === selectedId ? 'font-semibold text-white' : 'text-zinc-200'}>
				{p.name}
			</span>
			{#if p.id === selectedId}
				<Check size={14} />
			{/if}
		</button>
	{/each}
	{#if showAdvanced}
		<div class="my-1 border-t border-zinc-800" />
		<button
			class="flex w-full items-center px-3 py-2 rounded-md text-zinc-400
			       hover:bg-zinc-800 hover:text-zinc-200 transition"
			on:click={() => dispatch('advanced')}
		>
			Pick release manually…
		</button>
	{/if}
</div>
