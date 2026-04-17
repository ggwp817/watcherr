<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	export let user: { id: string; username: string; isAdmin: boolean; jellyfinUserId: string | null };
	const dispatch = createEventDispatcher<{ close: void; saved: void }>();

	let username = user.username;
	let isAdmin = user.isAdmin;
	let jellyfinUserId: string | null = user.jellyfinUserId;
	let options: { id: string; name: string }[] = [];
	let error = '';
	let pending = false;

	onMount(async () => {
		try {
			const r = await fetch('/api/admin/jellyfin-users');
			if (r.ok) options = await r.json();
		} catch {
			options = [];
		}
	});

	async function save() {
		pending = true;
		error = '';
		const r = await fetch(`/api/admin/users/${user.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username, isAdmin, jellyfinUserId })
		});
		pending = false;
		if (r.ok) {
			const body = await r.json();
			if (body.note) alert(body.note);
			dispatch('saved');
		} else {
			const body = await r.json().catch(() => ({}));
			error = body.error ?? 'Save failed.';
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
	on:click|self={() => dispatch('close')}
	on:keydown={(e) => e.key === 'Escape' && dispatch('close')}
>
	<div class="w-full max-w-md rounded-2xl bg-stone-900 border border-zinc-800/60 p-6 shadow-2xl">
		<h2 class="text-lg font-bold tracking-tight">Edit user</h2>
		<p class="mt-1 text-sm text-zinc-500">Editing <span class="text-zinc-300 font-medium">{user.username}</span></p>

		<form on:submit|preventDefault={save} class="mt-6 space-y-4">
			<div>
				<label class="mb-1.5 block text-xs font-medium text-zinc-400" for="eu-username">Username</label>
				<input
					id="eu-username"
					type="text"
					autocapitalize="none"
					bind:value={username}
					class="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-sm
					       text-zinc-100 focus:outline-none focus:border-amber-300/50 focus:ring-1
					       focus:ring-amber-300/20 transition-colors"
					required
				/>
			</div>
			<div>
				<label class="mb-1.5 block text-xs font-medium text-zinc-400" for="eu-jf">Jellyfin account</label>
				<select
					id="eu-jf"
					bind:value={jellyfinUserId}
					class="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-sm
					       text-zinc-100 focus:outline-none focus:border-amber-300/50 focus:ring-1
					       focus:ring-amber-300/20 transition-colors"
				>
					<option value={null}>No Jellyfin link</option>
					{#each options as o (o.id)}
						<option value={o.id}>{o.name}</option>
					{/each}
				</select>
			</div>
			<label
				class="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50
				       px-3.5 py-3 cursor-pointer hover:border-zinc-700 transition-colors"
			>
				<input
					type="checkbox"
					bind:checked={isAdmin}
					class="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-amber-300
					       focus:ring-amber-300/30 focus:ring-offset-0"
				/>
				<div>
					<span class="text-sm font-medium text-zinc-200">Admin privileges</span>
					<p class="text-xs text-zinc-500">Full access to admin panel and settings</p>
				</div>
			</label>

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
					{pending ? 'Saving…' : 'Save changes'}
				</button>
			</div>
		</form>
	</div>
</div>
