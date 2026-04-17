<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ModeCard from './ModeCard.svelte';

	export let currentMode: 'request' | 'online' | null = null;

	let saving: 'request' | 'online' | null = null;
	let toast = '';

	async function pick(mode: 'request' | 'online') {
		if (mode === currentMode) return;
		saving = mode;
		toast = '';
		try {
			const res = await fetch('/api/profile/mode', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ mode })
			});
			if (res.ok) {
				await invalidateAll();
				toast = `Switched to ${mode === 'online' ? 'Online Mode' : 'Request Mode'}`;
				setTimeout(() => (toast = ''), 2500);
			}
		} finally {
			saving = null;
		}
	}
</script>

<section class="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5 sm:p-6">
	<header class="mb-4">
		<h2 class="text-lg font-semibold text-zinc-100">Watching Mode</h2>
		<p class="text-xs text-zinc-500 mt-1">
			Choose how you want to browse and play. You can change this anytime.
		</p>
	</header>
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
		<ModeCard
			mode="request"
			active={currentMode === 'request'}
			disabled={!!saving}
			on:click={() => pick('request')}
		/>
		<ModeCard
			mode="online"
			active={currentMode === 'online'}
			disabled={!!saving}
			on:click={() => pick('online')}
		/>
	</div>
	<div class="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-800/40 bg-amber-900/15 text-[11px] text-amber-200/80">
		<svg class="h-4 w-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
		<span>Online Mode works on <strong>phones &amp; tablets</strong> only and requires <strong>VLC</strong> installed.</span>
	</div>
	{#if toast}
		<p class="mt-4 text-xs text-amber-300">{toast}</p>
	{/if}
</section>
