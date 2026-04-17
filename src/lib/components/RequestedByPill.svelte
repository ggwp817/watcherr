<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	export let tmdbId: number;
	export let type: 'movie' | 'series';

	type Requester = { username: string; requestedAt: string };
	type Info = {
		count: number;
		uniqueCount: number;
		latest: Requester | null;
		requesters: Requester[];
	};
	type AdminUser = { id: string; username: string };

	let info: Info | null = null;
	let showTooltip = false;
	let editing = false;
	let users: AdminUser[] = [];
	let pickedUserId = '';
	let saving = false;
	let error = '';

	$: isAdmin = !!$page.data?.user?.isAdmin;

	async function load() {
		try {
			const res = await fetch(`/api/requests/${tmdbId}?type=${type}`);
			if (!res.ok) return;
			info = await res.json();
		} catch {
			info = null;
		}
	}

	async function openEditor() {
		editing = true;
		error = '';
		if (users.length === 0) {
			try {
				const res = await fetch('/api/admin/users');
				if (res.ok) users = await res.json();
			} catch {
				users = [];
			}
		}
	}

	async function linkUser() {
		if (!pickedUserId) return;
		saving = true;
		error = '';
		try {
			const res = await fetch('/api/requests', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ tmdbId, type, asUserId: pickedUserId })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				error = data.error || 'Failed to save';
				return;
			}
			editing = false;
			pickedUserId = '';
			await load();
		} catch {
			error = 'Network error';
		} finally {
			saving = false;
		}
	}

	onMount(load);

	function relative(iso: string): string {
		const diff = (Date.now() - new Date(iso).getTime()) / 1000;
		if (diff < 60) return 'just now';
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
		if (diff < 2_592_000) return `${Math.floor(diff / 86_400)}d ago`;
		return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	$: extras = info ? info.uniqueCount - 1 : 0;
	$: hasAny = !!info?.latest;
</script>

{#if info}
	<div class="relative inline-flex items-center gap-2">
		{#if hasAny}
			<div
				class="relative inline-flex items-center"
				on:mouseenter={() => (showTooltip = true)}
				on:mouseleave={() => (showTooltip = false)}
				role="group"
			>
				<div
					class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
					       bg-zinc-800/60 border border-zinc-700/60 backdrop-blur-sm
					       text-xs font-medium text-zinc-300
					       transition-colors hover:bg-zinc-800/80 hover:border-zinc-600/60 cursor-default"
				>
					<span class="relative flex h-1.5 w-1.5">
						<span
							class="absolute inline-flex h-full w-full rounded-full bg-amber-300/60 animate-ping"
						></span>
						<span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-300"></span>
					</span>
					<span class="text-zinc-400">Requested by</span>
					<span class="text-zinc-100 font-semibold">{info.latest?.username}</span>
					{#if extras > 0}
						<span class="text-zinc-500 font-normal">+{extras}</span>
					{/if}
					<span class="text-zinc-500 font-normal tabular-nums"
						>· {relative(info.latest?.requestedAt ?? '')}</span
					>
				</div>

				{#if showTooltip && info.requesters.length > 1}
					<div
						class="absolute left-0 top-full mt-2 z-20 min-w-[12rem]
						       rounded-lg bg-stone-950/95 border border-zinc-800/80 backdrop-blur-md
						       shadow-lg shadow-black/40 p-2"
					>
						<div class="text-[10px] uppercase tracking-widest text-zinc-500 px-2 pb-1.5">
							All requesters
						</div>
						<ul class="flex flex-col gap-0.5">
							{#each info.requesters as r}
								<li class="flex items-center justify-between gap-3 px-2 py-1 rounded text-xs">
									<span class="text-zinc-200 font-medium">{r.username}</span>
									<span class="text-zinc-500 tabular-nums">{relative(r.requestedAt)}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/if}

		{#if isAdmin}
			<button
				type="button"
				on:click={openEditor}
				class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full
				       bg-zinc-800/40 border border-dashed border-zinc-700/60
				       text-[11px] font-medium text-zinc-500
				       hover:bg-zinc-800/70 hover:text-zinc-200 hover:border-zinc-600
				       transition-all cursor-pointer"
				title={hasAny ? 'Add another requester' : 'Link a requester to this title'}
			>
				<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				<span>{hasAny ? 'Add' : 'Link requester'}</span>
			</button>
		{/if}
	</div>
{/if}

{#if editing}
	<div
		class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
		on:click|self={() => (editing = false)}
		on:keydown={(e) => e.key === 'Escape' && (editing = false)}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="w-full max-w-sm rounded-2xl bg-stone-950 border border-zinc-800 shadow-2xl shadow-black/50 p-6"
		>
			<h3 class="text-lg font-semibold text-zinc-100">Link requester</h3>
			<p class="text-xs text-zinc-500 mt-1">
				Attribute this title's request to a specific user. Useful for backfilling requests made before this feature was enabled.
			</p>

			<label class="block mt-5">
				<span class="block text-[11px] uppercase tracking-wider text-zinc-500 mb-2">User</span>
				<select
					bind:value={pickedUserId}
					class="w-full rounded-lg bg-zinc-900 border border-zinc-800
					       text-zinc-100 px-3 py-2.5 text-sm
					       focus:outline-none focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20
					       cursor-pointer"
				>
					<option value="" disabled>Pick a user…</option>
					{#each users as u}
						<option value={u.id}>{u.username}</option>
					{/each}
				</select>
			</label>

			{#if error}
				<div class="mt-3 text-xs text-red-400">{error}</div>
			{/if}

			<div class="mt-6 flex justify-end gap-2">
				<button
					type="button"
					on:click={() => (editing = false)}
					class="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition cursor-pointer"
				>
					Cancel
				</button>
				<button
					type="button"
					disabled={!pickedUserId || saving}
					on:click={linkUser}
					class="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-300 text-stone-950
					       hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
				>
					{saving ? 'Saving…' : 'Link'}
				</button>
			</div>
		</div>
	</div>
{/if}
