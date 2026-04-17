<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	export let user: { id: string; username: string };
	const dispatch = createEventDispatcher<{ close: void; done: void }>();
	let newPassword = '';
	let error = '';
	let pending = false;

	async function submit() {
		pending = true;
		error = '';
		const r = await fetch(`/api/admin/users/${user.id}/reset-password`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ newPassword })
		});
		pending = false;
		if (r.ok) {
			const body = await r.json();
			if (body.jellyfinSynced === false) {
				alert('Password reset on WATCHERR, but Jellyfin sync failed. Use "Sync Jellyfin password" later.');
			}
			dispatch('done');
		} else {
			const body = await r.json().catch(() => ({}));
			error = body.error ?? 'Reset failed.';
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
	on:click|self={() => dispatch('close')}
	on:keydown={(e) => e.key === 'Escape' && dispatch('close')}
>
	<div class="w-full max-w-md rounded-2xl bg-stone-900 border border-zinc-800/60 p-6 shadow-2xl">
		<h2 class="text-lg font-bold tracking-tight">Reset password</h2>
		<p class="mt-1 text-sm text-zinc-500">
			Set a new password for <span class="text-zinc-300 font-medium">{user.username}</span>
		</p>

		<form on:submit|preventDefault={submit} class="mt-6 space-y-4">
			<div>
				<label class="mb-1.5 block text-xs font-medium text-zinc-400" for="rpw">New password</label>
				<input
					id="rpw"
					type="password"
					minlength="8"
					bind:value={newPassword}
					placeholder="Min. 8 characters"
					class="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-sm
					       text-zinc-100 placeholder:text-zinc-600
					       focus:outline-none focus:border-amber-300/50 focus:ring-1 focus:ring-amber-300/20
					       transition-colors"
					required
				/>
			</div>

			{#if error}
				<div class="rounded-lg bg-red-500/10 border border-red-500/20 px-3.5 py-2.5">
					<p class="text-sm text-red-400">{error}</p>
				</div>
			{/if}

			<div class="flex justify-end gap-3 pt-2">
				<button
					type="button"
					class="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-400
					       hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
					on:click={() => dispatch('close')}
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={pending}
					class="rounded-lg bg-amber-300 px-5 py-2.5 text-sm font-semibold text-black
					       hover:bg-amber-200 active:bg-amber-400 disabled:opacity-50
					       disabled:cursor-not-allowed transition-all shadow-sm shadow-amber-300/20"
				>
					{pending ? 'Resetting…' : 'Reset password'}
				</button>
			</div>
		</form>
	</div>
</div>
