<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ModeCard from './ModeCard.svelte';

	export let visible = false;

	let saving: 'request' | 'online' | null = null;
	let error = '';

	async function pick(mode: 'request' | 'online') {
		saving = mode;
		error = '';
		try {
			const res = await fetch('/api/profile/mode', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ mode })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				error = data.error || 'Could not save your choice';
				saving = null;
				return;
			}
			await invalidateAll();
			visible = false;
		} catch {
			error = 'Network error';
			saving = null;
		}
	}
</script>

{#if visible}
	<div
		class="fixed inset-0 z-[120] flex items-center justify-center p-4 pt-safe pb-safe
		       bg-black/80 backdrop-blur-md"
		role="dialog"
		aria-modal="true"
		aria-labelledby="mode-modal-title"
	>
		<div
			class="w-full max-w-4xl bg-stone-950/90 border border-zinc-800
			       rounded-3xl shadow-2xl shadow-black/70 p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
		>
			<div class="text-center mb-6">
				<h2 id="mode-modal-title" class="text-2xl sm:text-3xl font-bold text-zinc-100">
					Welcome — how do you want to watch?
				</h2>
				<p class="mt-2 text-sm text-zinc-400">
					You can switch anytime from your profile.
				</p>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<ModeCard
					mode="request"
					disabled={!!saving}
					on:click={() => pick('request')}
				/>
				<ModeCard
					mode="online"
					disabled={!!saving}
					on:click={() => pick('online')}
				/>
			</div>

			{#if saving}
				<p class="mt-4 text-center text-xs text-zinc-500">
					Saving your choice…
				</p>
			{/if}
			{#if error}
				<p class="mt-4 text-center text-sm text-red-400">{error}</p>
			{/if}

			<div class="mt-5 flex items-center gap-2 mx-auto max-w-md px-3 py-2 rounded-lg border border-amber-800/40 bg-amber-900/15 text-[11px] text-amber-200/80">
				<svg class="h-4 w-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
				<span>Online Mode works on <strong>phones &amp; tablets</strong> only and requires <strong>VLC</strong> installed.</span>
			</div>
			<p class="mt-3 text-center text-[11px] text-zinc-600">
				Not sure? Pick one — you can switch in Profile anytime.
			</p>
		</div>
	</div>
{/if}
