<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let url: string;

	const dispatch = createEventDispatcher<{ playBrowser: void }>();

	let open = false;
	let rootEl: HTMLDivElement;

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		open = !open;
	}

	function close() {
		open = false;
	}

	async function copy(e: MouseEvent) {
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(url);
		} catch {}
		close();
	}

	function playBrowser(e: MouseEvent) {
		e.stopPropagation();
		dispatch('playBrowser');
		close();
	}

	function launch(scheme: string, e: MouseEvent) {
		e.stopPropagation();
		let target: string;
		if (scheme === 'vlc') target = `vlc://${url}`;
		else if (scheme === 'infuse')
			target = `infuse://x-callback-url/play?url=${encodeURIComponent(url)}`;
		else if (scheme === 'stremio') target = `stremio:///play?video=${encodeURIComponent(url)}`;
		else target = url;
		window.location.href = target;
		close();
	}

	function onDocClick(e: MouseEvent) {
		if (!rootEl) return;
		if (!rootEl.contains(e.target as Node)) close();
	}
</script>

<svelte:window on:click={onDocClick} />

<div class="relative" bind:this={rootEl}>
	<button
		type="button"
		on:click={toggle}
		aria-label="More options"
		class="h-7 w-7 inline-flex items-center justify-center rounded-md
		       text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
	>
		<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
			<circle cx="12" cy="5" r="1.5" />
			<circle cx="12" cy="12" r="1.5" />
			<circle cx="12" cy="19" r="1.5" />
		</svg>
	</button>
	{#if open}
		<div
			class="absolute right-0 top-full mt-1 z-10 w-40 bg-stone-950 border border-zinc-800
			       rounded-md shadow-2xl shadow-black/70 py-1 text-xs text-zinc-200"
		>
			<button
				type="button"
				on:click={playBrowser}
				class="w-full text-left px-3 py-1.5 hover:bg-zinc-800 cursor-pointer"
			>
				Play in Browser
			</button>
			<button
				type="button"
				on:click={copy}
				class="w-full text-left px-3 py-1.5 hover:bg-zinc-800 cursor-pointer"
			>
				Copy URL
			</button>
			<button
				type="button"
				on:click={(e) => launch('vlc', e)}
				class="w-full text-left px-3 py-1.5 hover:bg-zinc-800 cursor-pointer"
			>
				Open in VLC
			</button>
			<button
				type="button"
				on:click={(e) => launch('infuse', e)}
				class="w-full text-left px-3 py-1.5 hover:bg-zinc-800 cursor-pointer"
			>
				Open in Infuse
			</button>
			<button
				type="button"
				on:click={(e) => launch('stremio', e)}
				class="w-full text-left px-3 py-1.5 hover:bg-zinc-800 cursor-pointer"
			>
				Open in Stremio
			</button>
		</div>
	{/if}
</div>
