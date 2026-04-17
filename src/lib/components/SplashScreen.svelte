<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	let visible = true;
	let isMobile = false;

	onMount(() => {
		isMobile = window.matchMedia('(max-width: 1024px)').matches;
		const shown = sessionStorage.getItem('splash_shown');
		if (!isMobile || shown) {
			visible = false;
			return;
		}
		sessionStorage.setItem('splash_shown', '1');
		setTimeout(() => {
			visible = false;
		}, 1800);
	});
</script>

{#if visible && isMobile}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center"
		style="background:linear-gradient(135deg,#08080f 0%,#0e0918 50%,#08080f 100%);"
		transition:fade={{ duration: 400 }}
	>
		<div class="flex flex-col items-center gap-5 splash-enter">
			<div
				class="w-16 h-16 rounded-2xl flex items-center justify-center border border-amber-400/15"
				style="background:linear-gradient(145deg,rgba(251,191,36,0.06),rgba(251,191,36,0.02));box-shadow:0 10px 40px rgba(251,191,36,0.04);"
			>
				<span
					class="text-2xl font-semibold"
					style="font-family:Inter,system-ui,sans-serif;color:rgba(251,191,36,0.85);"
				>W</span>
			</div>
			<div class="flex flex-col items-center gap-2">
				<span
					class="text-xl font-light tracking-[0.32em] text-white/80"
					style="font-family:Inter,system-ui,sans-serif;"
				>WATCHERR</span>
				<div
					class="h-[1.5px] w-9 rounded-full"
					style="background:linear-gradient(90deg,rgba(251,191,36,0.4),transparent);"
				/>
			</div>
		</div>
	</div>
{/if}

<style>
	.splash-enter {
		animation: splashIn 0.6s ease-out both;
	}

	@keyframes splashIn {
		0% {
			opacity: 0;
			transform: scale(0.92);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
