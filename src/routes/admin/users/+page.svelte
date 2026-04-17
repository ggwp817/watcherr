<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import NewUserModal from './NewUserModal.svelte';
	import EditUserModal from './EditUserModal.svelte';
	import ResetPasswordModal from './ResetPasswordModal.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	let showNew = false;
	let editTarget: PageData['users'][number] | null = null;
	let resetTarget: PageData['users'][number] | null = null;

	async function forceLogout(id: string) {
		if (!confirm('Force logout this user? They will need to sign in again.')) return;
		await fetch(`/api/admin/users/${id}/force-logout`, { method: 'POST' });
		await invalidateAll();
	}

	async function remove(id: string, username: string) {
		if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
		const r = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
		if (!r.ok) {
			const body = await r.json().catch(() => ({}));
			alert(body.error ?? 'Delete failed.');
			return;
		}
		await invalidateAll();
	}
</script>

<div class="flex items-center justify-between mb-8">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">Users</h1>
		<p class="mt-1 text-sm text-zinc-500">{data.users.length} registered user{data.users.length === 1 ? '' : 's'}</p>
	</div>
	<button
		class="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-4 py-2.5 text-sm
		       font-semibold text-black hover:bg-amber-200 active:bg-amber-400
		       transition-all shadow-sm shadow-amber-300/20"
		on:click={() => (showNew = true)}
	>
		<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
			stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
		</svg>
		New user
	</button>
</div>

<div class="flex flex-col gap-3">
	{#each data.users as u (u.id)}
		<div
			class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4 sm:p-5
			       hover:border-zinc-700/60 transition-colors"
		>
			<div class="flex flex-col sm:flex-row sm:items-center gap-4">
				<div class="flex items-center gap-3 flex-1 min-w-0">
					<div
						class="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full
						       text-sm font-bold uppercase
						       {u.isAdmin ? 'bg-amber-300/15 text-amber-300' : 'bg-zinc-800 text-zinc-400'}"
					>
						{u.username.charAt(0)}
					</div>
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<span class="font-semibold text-zinc-100 truncate">{u.username}</span>
							{#if u.isAdmin}
								<span
									class="flex-shrink-0 rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px]
									       font-semibold uppercase tracking-wider text-amber-300"
								>Admin</span>
							{/if}
						</div>
						<div class="flex items-center gap-3 mt-0.5 text-xs text-zinc-500">
							{#if u.jellyfinUserId}
								<span class="flex items-center gap-1">
									<span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
									Jellyfin linked
								</span>
							{:else}
								<span class="text-zinc-600">No Jellyfin link</span>
							{/if}
							<span>
								{u.lastLoginAt
									? `Last login ${new Date(u.lastLoginAt).toLocaleDateString()}`
									: 'Never logged in'}
							</span>
						</div>
					</div>
				</div>

				<div class="flex items-center gap-1 flex-shrink-0">
					<button
						class="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400
						       hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
						on:click={() => (editTarget = u)}
					>
						Edit
					</button>
					<button
						class="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400
						       hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
						on:click={() => (resetTarget = u)}
					>
						Reset PW
					</button>
					<button
						class="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400
						       hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
						on:click={() => forceLogout(u.id)}
					>
						Logout
					</button>
					<button
						class="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400/80
						       hover:bg-red-500/10 hover:text-red-400 transition-colors"
						on:click={() => remove(u.id, u.username)}
					>
						Delete
					</button>
				</div>
			</div>
		</div>
	{/each}
</div>

{#if data.users.length === 0}
	<div class="mt-12 text-center">
		<p class="text-zinc-500 text-sm">No users yet. Create one to get started.</p>
	</div>
{/if}

{#if showNew}
	<NewUserModal
		on:close={() => (showNew = false)}
		on:created={() => {
			showNew = false;
			invalidateAll();
		}}
	/>
{/if}
{#if editTarget}
	<EditUserModal
		user={editTarget}
		on:close={() => (editTarget = null)}
		on:saved={() => {
			editTarget = null;
			invalidateAll();
		}}
	/>
{/if}
{#if resetTarget}
	<ResetPasswordModal
		user={resetTarget}
		on:close={() => (resetTarget = null)}
		on:done={() => {
			resetTarget = null;
			invalidateAll();
		}}
	/>
{/if}
