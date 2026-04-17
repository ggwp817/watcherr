<script lang="ts">
	import type { PageData } from './$types';
	import { settings } from '$lib/stores/settings.store';
	import { ISO_LANGUAGES } from '$lib/utils/iso-languages';
	import { ISO_REGIONS } from '$lib/utils/iso-regions';
	import { _, dictionary } from 'svelte-i18n';
	import axios from 'axios';

	export let data: PageData;

	let values = structuredClone(data.settings);
	let initialValues = structuredClone(data.settings);

	let saving = false;
	let saveResult: 'success' | 'error' | null = null;

	$: changed = JSON.stringify(values) !== JSON.stringify(initialValues);

	async function handleSave() {
		if (saving || !changed) return;
		saving = true;
		saveResult = null;
		try {
			const fullSettings = { ...$settings, ...values };
			await axios.post('/api/settings', fullSettings);
			settings.set(fullSettings);
			initialValues = structuredClone(values);
			saveResult = 'success';
		} catch {
			saveResult = 'error';
		}
		saving = false;
		setTimeout(() => { saveResult = null; }, 3000);
	}
</script>

<div class="mb-6 flex items-end justify-between gap-4 flex-wrap">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">Preferences</h1>
		<p class="mt-1 text-sm text-zinc-500">UI, playback, and discovery settings.</p>
	</div>
	<button
		on:click={handleSave}
		disabled={!changed || saving}
		class="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-all
		       {changed
			? 'bg-amber-400/90 text-stone-950 hover:bg-amber-300 shadow-lg shadow-amber-400/20'
			: 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}"
	>
		{#if saving}
			<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
				<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25" />
				<path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-75" />
			</svg>
			Saving…
		{:else}
			Save Changes
		{/if}
	</button>
</div>

{#if saveResult === 'success'}
	<div class="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
		Preferences saved successfully.
	</div>
{:else if saveResult === 'error'}
	<div class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
		Failed to save preferences.
	</div>
{/if}

<div class="space-y-5">
	<!-- User Interface -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
		<div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/40">
			<div class="flex items-center gap-3">
				<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="3" width="7" height="7" />
						<rect x="14" y="3" width="7" height="7" />
						<rect x="14" y="14" width="7" height="7" />
						<rect x="3" y="14" width="7" height="7" />
					</svg>
				</div>
				<div>
					<h3 class="font-semibold text-zinc-100">User Interface</h3>
					<p class="text-xs text-zinc-500">Language, animations, and playback</p>
				</div>
			</div>
		</div>
		<div class="px-5 py-4 space-y-4">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-medium text-zinc-400 uppercase tracking-wider">Language</label>
					<select
						bind:value={values.language}
						class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
						       focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
						       appearance-none cursor-pointer"
					>
						{#each Object.entries(ISO_LANGUAGES).filter(([c]) => Object.keys($dictionary).includes(c)) as [code, lang]}
							<option value={code}>{lang?.name} — {lang?.nativeName}</option>
						{/each}
					</select>
				</div>
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-medium text-zinc-400 uppercase tracking-wider">Animation Duration (ms)</label>
					<input
						type="number"
						bind:value={values.animationDuration}
						class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
						       focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
						       transition-colors"
					/>
				</div>
			</div>
			<div class="flex items-center justify-between rounded-lg bg-zinc-800/30 px-4 py-3">
				<div>
					<p class="text-sm text-zinc-300">Autoplay Trailers</p>
					<p class="text-xs text-zinc-500">Automatically play trailers on title pages</p>
				</div>
				<label class="relative inline-flex items-center cursor-pointer">
					<input type="checkbox" bind:checked={values.autoplayTrailers} class="sr-only peer" />
					<div
						class="w-10 h-5 rounded-full peer bg-zinc-700 peer-checked:bg-amber-400/50
						       after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all
						       peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px]"
					/>
				</label>
			</div>
		</div>
	</div>

	<!-- Discovery -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
		<div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/40">
			<div class="flex items-center gap-3">
				<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" />
					</svg>
				</div>
				<div>
					<h3 class="font-semibold text-zinc-100">Discovery</h3>
					<p class="text-xs text-zinc-500">Region and language filters for browsing</p>
				</div>
			</div>
		</div>
		<div class="px-5 py-4 space-y-4">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-medium text-zinc-400 uppercase tracking-wider">Region</label>
					<select
						bind:value={values.discover.region}
						class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
						       focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
						       appearance-none cursor-pointer"
					>
						<option value="">None</option>
						{#each Object.entries(ISO_REGIONS) as [code, region]}
							<option value={code}>{region}</option>
						{/each}
					</select>
				</div>
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-medium text-zinc-400 uppercase tracking-wider">Included Languages</label>
					<input
						type="text"
						placeholder="en,fr,de"
						bind:value={values.discover.includedLanguages}
						class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
						       placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
						       transition-colors"
					/>
					<p class="text-[11px] text-zinc-600">Comma-separated ISO language codes</p>
				</div>
			</div>
			<div class="flex items-center justify-between rounded-lg bg-zinc-800/30 px-4 py-3">
				<div>
					<p class="text-sm text-zinc-300">Exclude Library Items</p>
					<p class="text-xs text-zinc-500">Hide items already in your library from discovery</p>
				</div>
				<label class="relative inline-flex items-center cursor-pointer">
					<input type="checkbox" bind:checked={values.discover.excludeLibraryItems} class="sr-only peer" />
					<div
						class="w-10 h-5 rounded-full peer bg-zinc-700 peer-checked:bg-amber-400/50
						       after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all
						       peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px]"
					/>
				</label>
			</div>
		</div>
	</div>
</div>
