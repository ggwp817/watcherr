<script lang="ts">
	import { goto } from '$app/navigation';
	import BackgroundSlideshow from './BackgroundSlideshow.svelte';

	let username = '';
	let password = '';
	let pending = false;
	let error = '';

	async function submit() {
		if (pending) return;
		pending = true;
		error = '';
		try {
			const r = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});
			if (r.ok) {
				await goto('/', { invalidateAll: true });
			} else {
				const body = await r.json().catch(() => ({}));
				error = body.error ?? 'Login failed.';
			}
		} catch {
			error = 'Network error.';
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in · WATCHERR</title>
	<meta name="theme-color" content="#1f2937" />
</svelte:head>

<BackgroundSlideshow />

<div class="relative z-10 flex min-h-screen flex-col items-center justify-center px-4">
	<img src="/logo_stacked.svg" alt="WATCHERR" class="mb-8 h-32 w-auto sm:h-40" />

	<form
		class="w-full max-w-md rounded-lg bg-gray-800/50 px-6 py-8 shadow-xl sm:px-10"
		style="backdrop-filter: blur(5px);"
		on:submit|preventDefault={submit}
	>
		<label class="mb-1 block text-sm font-medium text-gray-200" for="username">Username</label>
		<input
			id="username"
			name="username"
			type="text"
			autocapitalize="none"
			autocomplete="username"
			required
			bind:value={username}
			class="mb-4 w-full rounded-md bg-gray-700/80 px-3 py-2 text-base text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
		/>

		<label class="mb-1 block text-sm font-medium text-gray-200" for="password">Password</label>
		<input
			id="password"
			name="password"
			type="password"
			autocomplete="current-password"
			required
			bind:value={password}
			class="mb-4 w-full rounded-md bg-gray-700/80 px-3 py-2 text-base text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
		/>

		{#if error}
			<p class="mb-3 text-sm text-red-400" role="alert">{error}</p>
		{/if}

		<button
			type="submit"
			disabled={pending}
			class="w-full rounded-md border border-indigo-500 bg-indigo-600/80 py-2 font-medium text-white transition hover:bg-indigo-600 disabled:opacity-60"
		>
			{pending ? 'Signing in…' : 'Sign In'}
		</button>
	</form>

	<p class="mt-6 text-xs text-gray-400">WATCHERR · sign in to continue</p>
</div>
