<script lang="ts">
	import type { PageData } from './$types';
	import ProfileModeToggle from '$lib/components/Mode/ProfileModeToggle.svelte';
	import { page } from '$app/stores';
	export let data: PageData;

	let current = '';
	let next = '';
	let confirmPw = '';
	let error = '';
	let success = '';
	let pending = false;

	async function changePassword() {
		error = '';
		success = '';
		if (next !== confirmPw) {
			error = 'New passwords do not match.';
			return;
		}
		if (next.length < 8) {
			error = 'Password must be at least 8 characters.';
			return;
		}
		pending = true;
		const r = await fetch('/api/auth/change-password', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ currentPassword: current, newPassword: next })
		});
		pending = false;
		if (r.ok) {
			const body = await r.json();
			success =
				body.jellyfinSynced === false
					? 'Password changed (Jellyfin sync failed — contact admin).'
					: 'Password changed.';
			current = next = confirmPw = '';
		} else {
			const body = await r.json().catch(() => ({}));
			error = body.error ?? 'Change failed.';
		}
	}

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.href = '/login';
	}
</script>

<svelte:head><title>Profile · WATCHERR</title></svelte:head>

<div class="mx-auto max-w-xl p-4 sm:p-8 pt-20 pb-24 text-gray-100">
	<h1 class="text-2xl font-bold">Profile</h1>

	<div class="mt-6">
		<ProfileModeToggle currentMode={$page.data.user?.mode ?? null} />
	</div>

	<section class="mt-6 rounded-lg border border-white/5 bg-gray-900 p-5">
		<h2 class="text-sm font-semibold text-gray-300">Account</h2>
		<dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
			<dt class="text-gray-400">Username</dt>
			<dd>{data.username}</dd>
			<dt class="text-gray-400">Linked Jellyfin user</dt>
			<dd class="text-gray-300">{data.jellyfinUserId ?? 'Not linked — contact admin.'}</dd>
		</dl>
	</section>

	<section class="mt-6 rounded-lg border border-white/5 bg-gray-900 p-5">
		<h2 class="text-sm font-semibold text-gray-300">Change password</h2>
		<form on:submit|preventDefault={changePassword} class="mt-3 space-y-3">
			<input type="password" placeholder="Current password" bind:value={current} class="w-full rounded bg-gray-800 px-3 py-2 text-sm" required />
			<input type="password" placeholder="New password" bind:value={next} class="w-full rounded bg-gray-800 px-3 py-2 text-sm" minlength="8" required />
			<input type="password" placeholder="Confirm new password" bind:value={confirmPw} class="w-full rounded bg-gray-800 px-3 py-2 text-sm" minlength="8" required />
			{#if error}<p class="text-sm text-red-400">{error}</p>{/if}
			{#if success}<p class="text-sm text-emerald-400">{success}</p>{/if}
			<button type="submit" disabled={pending} class="rounded bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-60">
				{pending ? 'Saving…' : 'Change password'}
			</button>
		</form>
	</section>

	<section class="mt-6 rounded-lg border border-white/5 bg-gray-900 p-5">
		<button on:click={logout} class="rounded bg-red-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-red-600">Sign out</button>
	</section>
</div>
