<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let urls: string[] = [];
	let index = 0;
	let loaded = false;
	let timer: ReturnType<typeof setInterval> | null = null;
	let reducedMotion = false;

	onMount(async () => {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		try {
			const r = await fetch('/api/auth/backdrops');
			const body = await r.json();
			urls = Array.isArray(body.backdrops) ? body.backdrops : [];
		} catch {
			urls = [];
		}

		if (urls.length === 0) {
			loaded = true;
			return;
		}

		const first = new Image();
		first.src = urls[0];
		first.onload = () => {
			loaded = true;
		};
		first.onerror = () => {
			loaded = true;
		};

		if (!reducedMotion && urls.length > 1) {
			timer = setInterval(() => {
				index = (index + 1) % urls.length;
			}, 10_000);
		}
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});
</script>

<div class="fixed inset-0 z-0 bg-gray-900" aria-hidden="true">
	{#if urls.length > 0}
		{#each urls as url, i}
			<div
				class="absolute inset-0 transition-opacity duration-1000 ease-in-out"
				style="opacity: {loaded && i === index ? 1 : 0};"
			>
				<img
					src={url}
					alt=""
					loading="lazy"
					decoding="async"
					class="absolute inset-0 h-full w-full object-cover"
				/>
				<div
					class="absolute inset-0"
					style="background-image: linear-gradient(rgba(45, 55, 72, 0.47) 0%, rgb(26, 32, 46) 100%);"
				/>
			</div>
		{/each}
	{/if}
</div>
