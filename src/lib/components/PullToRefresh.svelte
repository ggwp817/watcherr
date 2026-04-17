<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	const THRESHOLD = 80;
	const MAX_PULL = 130;
	const RESISTANCE = 0.4;

	let pullDistance = 0;
	let refreshing = false;
	let startY = 0;
	let pulling = false;
	let visible = false;
	let isTouchDevice = false;

	function onTouchStart(e: TouchEvent) {
		if (refreshing) return;
		if (window.scrollY > 5) return;
		startY = e.touches[0].clientY;
		pulling = true;
	}

	function onTouchMove(e: TouchEvent) {
		if (!pulling || refreshing) return;
		const dy = e.touches[0].clientY - startY;
		if (dy < 0) {
			pullDistance = 0;
			return;
		}
		pullDistance = Math.min(dy * RESISTANCE, MAX_PULL);
		if (pullDistance > 10) visible = true;
	}

	function onTouchEnd() {
		if (!pulling) return;
		pulling = false;
		if (pullDistance >= THRESHOLD && !refreshing) {
			refreshing = true;
			pullDistance = 60;
			window.location.reload();
		} else {
			pullDistance = 0;
			visible = false;
		}
	}

	onMount(() => {
		if (!browser) return;
		isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
		if (!isTouchDevice) return;
		document.addEventListener('touchstart', onTouchStart, { passive: true });
		document.addEventListener('touchmove', onTouchMove, { passive: true });
		document.addEventListener('touchend', onTouchEnd, { passive: true });
	});

	onDestroy(() => {
		if (!browser || !isTouchDevice) return;
		document.removeEventListener('touchstart', onTouchStart);
		document.removeEventListener('touchmove', onTouchMove);
		document.removeEventListener('touchend', onTouchEnd);
	});

	$: progress = Math.min(pullDistance / THRESHOLD, 1);
	$: pastThreshold = pullDistance >= THRESHOLD;
</script>

{#if visible}
	<div
		class="fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-opacity duration-150"
		style="top: calc(env(safe-area-inset-top, 0px) + {pullDistance * 0.6}px);
		       opacity: {refreshing ? 1 : progress};"
	>
		<div
			class="flex items-center justify-center h-10 w-10 rounded-full
			       bg-stone-900/90 backdrop-blur-sm border border-zinc-700/50 shadow-lg shadow-black/30"
		>
			{#if refreshing}
				<svg class="h-5 w-5 animate-spin text-amber-300" viewBox="0 0 24 24" fill="none">
					<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" class="opacity-25" />
					<path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="opacity-90" />
				</svg>
			{:else}
				<svg
					class="h-5 w-5 transition-transform duration-150
					       {pastThreshold ? 'text-amber-300' : 'text-zinc-400'}"
					style="transform: rotate({progress * 180}deg);"
					viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
				>
					<line x1="12" y1="5" x2="12" y2="19" />
					<polyline points="19 12 12 19 5 12" />
				</svg>
			{/if}
		</div>
	</div>
{/if}
