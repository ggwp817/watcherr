<script lang="ts">
	import type { PageData } from './$types';
	import {
		getSonarrHealth,
		getSonarrRootFolders,
		getSonarrQualityProfiles,
		getSonarrLanguageProfiles,
		getSonarrMonitors
	} from '$lib/apis/sonarr/sonarrApi';
	import {
		getRadarrHealth,
		getRadarrRootFolders,
		getRadarrQualityProfiles,
		getRadarrMonitors
	} from '$lib/apis/radarr/radarrApi';
	import { getJellyfinHealth, getJellyfinUsers } from '$lib/apis/jellyfin/jellyfinApi';
	import { settings } from '$lib/stores/settings.store';
	import axios from 'axios';

	export let data: PageData;

	let values = structuredClone(data.settings);
	let initialValues = structuredClone(data.settings);

	let sonarrConnected = false;
	let radarrConnected = false;
	let jellyfinConnected = false;

	let sonarrTesting = false;
	let radarrTesting = false;
	let jellyfinTesting = false;

	let sonarrTestResult: boolean | null = null;
	let radarrTestResult: boolean | null = null;
	let jellyfinTestResult: boolean | null = null;

	let sonarrRootFolders: { id: number; path: string }[] | undefined;
	let sonarrQualityProfiles: { id: number; name: string }[] | undefined;
	let sonarrLanguageProfiles: { id: number; name: string }[] | undefined;
	let sonarrMonitorsList: { id: number; type: string }[] | undefined;

	let radarrRootFolders: { id: number; path: string }[] | undefined;
	let radarrQualityProfiles: { id: number; name: string }[] | undefined;
	let radarrMonitorsList: { id: number; type: string }[] | undefined;

	let jellyfinUsersList: { id: string; name: string }[] | undefined;

	let saving = false;
	let saveResult: 'success' | 'error' | null = null;
	let saveError = '';

	$: changed = JSON.stringify(values) !== JSON.stringify(initialValues);

	async function testSonarr() {
		sonarrTesting = true;
		sonarrTestResult = null;
		try {
			const ok = await getSonarrHealth(
				values.sonarr.baseUrl || undefined,
				values.sonarr.apiKey || undefined
			);
			sonarrConnected = ok;
			sonarrTestResult = ok;
			if (ok) loadSonarrOptions();
		} catch {
			sonarrConnected = false;
			sonarrTestResult = false;
		}
		sonarrTesting = false;
		clearTestResult('sonarr');
	}

	async function testRadarr() {
		radarrTesting = true;
		radarrTestResult = null;
		try {
			const ok = await getRadarrHealth(
				values.radarr.baseUrl || undefined,
				values.radarr.apiKey || undefined
			);
			radarrConnected = ok;
			radarrTestResult = ok;
			if (ok) loadRadarrOptions();
		} catch {
			radarrConnected = false;
			radarrTestResult = false;
		}
		radarrTesting = false;
		clearTestResult('radarr');
	}

	async function testJellyfin() {
		jellyfinTesting = true;
		jellyfinTestResult = null;
		try {
			const ok = await getJellyfinHealth(
				values.jellyfin.baseUrl || undefined,
				values.jellyfin.apiKey || undefined
			);
			jellyfinConnected = ok;
			jellyfinTestResult = ok;
			if (ok) loadJellyfinOptions();
		} catch {
			jellyfinConnected = false;
			jellyfinTestResult = false;
		}
		jellyfinTesting = false;
		clearTestResult('jellyfin');
	}

	function clearTestResult(service: 'sonarr' | 'radarr' | 'jellyfin') {
		setTimeout(() => {
			if (service === 'sonarr') sonarrTestResult = null;
			else if (service === 'radarr') radarrTestResult = null;
			else jellyfinTestResult = null;
		}, 3000);
	}

	async function loadSonarrOptions() {
		const [folders, profiles, langs, mons] = await Promise.all([
			getSonarrRootFolders(values.sonarr.baseUrl || undefined, values.sonarr.apiKey || undefined),
			getSonarrQualityProfiles(
				values.sonarr.baseUrl || undefined,
				values.sonarr.apiKey || undefined
			),
			getSonarrLanguageProfiles(
				values.sonarr.baseUrl || undefined,
				values.sonarr.apiKey || undefined
			),
			getSonarrMonitors()
		]);
		sonarrRootFolders = folders.map((f) => ({ id: f.id || 0, path: f.path || '' }));
		sonarrQualityProfiles = profiles.map((p) => ({ id: p.id || 0, name: p.name || '' }));
		sonarrLanguageProfiles = langs.map((p) => ({ id: p.id || 0, name: p.name || '' }));
		sonarrMonitorsList = mons.map((p, i) => ({ id: i, type: p || '' }));
	}

	async function loadRadarrOptions() {
		const [folders, profiles, mons] = await Promise.all([
			getRadarrRootFolders(values.radarr.baseUrl || undefined, values.radarr.apiKey || undefined),
			getRadarrQualityProfiles(
				values.radarr.baseUrl || undefined,
				values.radarr.apiKey || undefined
			),
			getRadarrMonitors()
		]);
		radarrRootFolders = folders.map((f) => ({ id: f.id || 0, path: f.path || '' }));
		radarrQualityProfiles = profiles.map((p) => ({ id: p.id || 0, name: p.name || '' }));
		radarrMonitorsList = mons.map((p, i) => ({ id: i, type: p || '' }));
	}

	async function loadJellyfinOptions() {
		const users = await getJellyfinUsers(
			values.jellyfin.baseUrl || undefined,
			values.jellyfin.apiKey || undefined
		);
		jellyfinUsersList = users.map((u) => ({ id: u.Id || '', name: u.Name || '' }));
	}

	async function handleSave() {
		if (saving || !changed) return;
		saving = true;
		saveResult = null;
		saveError = '';

		try {
			if (values.sonarr.apiKey && values.sonarr.baseUrl) {
				const ok = await getSonarrHealth(values.sonarr.baseUrl, values.sonarr.apiKey);
				if (!ok) {
					saveError = 'Cannot connect to Sonarr. Check URL and API key.';
					saveResult = 'error';
					saving = false;
					return;
				}
			}
			if (values.radarr.apiKey && values.radarr.baseUrl) {
				const ok = await getRadarrHealth(values.radarr.baseUrl, values.radarr.apiKey);
				if (!ok) {
					saveError = 'Cannot connect to Radarr. Check URL and API key.';
					saveResult = 'error';
					saving = false;
					return;
				}
			}
			if (values.jellyfin.apiKey && values.jellyfin.baseUrl) {
				const ok = await getJellyfinHealth(values.jellyfin.baseUrl, values.jellyfin.apiKey);
				if (!ok) {
					saveError = 'Cannot connect to Jellyfin. Check URL and API key.';
					saveResult = 'error';
					saving = false;
					return;
				}
				const users = await getJellyfinUsers(values.jellyfin.baseUrl, values.jellyfin.apiKey);
				if (!users.find((u) => u.Id === values.jellyfin.userId)) values.jellyfin.userId = null;
			}

			const fullSettings = { ...$settings, ...values };
			await axios.post('/api/settings', fullSettings);
			settings.set(fullSettings);
			initialValues = structuredClone(values);
			saveResult = 'success';
		} catch {
			saveError = 'Failed to save settings.';
			saveResult = 'error';
		}
		saving = false;
		setTimeout(() => {
			saveResult = null;
			saveError = '';
		}, 3000);
	}

	function clearIntegration(service: 'sonarr' | 'radarr' | 'jellyfin') {
		if (service === 'sonarr') {
			values.sonarr.baseUrl = '';
			values.sonarr.apiKey = '';
			values.sonarr.rootFolderPath = '';
			values.sonarr.qualityProfileId = 0;
			values.sonarr.languageProfileId = 0;
			values.sonarr.monitor = 0;
			values.sonarr.StartSearch = false;
			sonarrConnected = false;
			sonarrRootFolders = undefined;
			sonarrQualityProfiles = undefined;
			sonarrLanguageProfiles = undefined;
			sonarrMonitorsList = undefined;
		} else if (service === 'radarr') {
			values.radarr.baseUrl = '';
			values.radarr.apiKey = '';
			values.radarr.rootFolderPath = '';
			values.radarr.qualityProfileId = 0;
			values.radarr.monitor = 0;
			values.radarr.StartSearch = false;
			radarrConnected = false;
			radarrRootFolders = undefined;
			radarrQualityProfiles = undefined;
			radarrMonitorsList = undefined;
		} else {
			values.jellyfin.baseUrl = '';
			values.jellyfin.apiKey = '';
			values.jellyfin.userId = '';
			jellyfinConnected = false;
			jellyfinUsersList = undefined;
		}
	}

	// Auto-test on mount if credentials exist
	function init() {
		if (values.sonarr.baseUrl && values.sonarr.apiKey) testSonarr();
		if (values.radarr.baseUrl && values.radarr.apiKey) testRadarr();
		if (values.jellyfin.baseUrl && values.jellyfin.apiKey) testJellyfin();
	}
	init();
</script>

<div class="mb-6 flex items-end justify-between gap-4 flex-wrap">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">System</h1>
		<p class="mt-1 text-sm text-zinc-500">Manage integrations, API keys, and server settings.</p>
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
				<path
					d="M4 12a8 8 0 018-8"
					stroke="currentColor"
					stroke-width="3"
					stroke-linecap="round"
					class="opacity-75"
				/>
			</svg>
			Saving…
		{:else}
			Save Changes
		{/if}
	</button>
</div>

{#if saveResult === 'success'}
	<div class="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
		Settings saved successfully.
	</div>
{:else if saveResult === 'error'}
	<div class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
		{saveError}
	</div>
{/if}

<div class="space-y-5">
	<!-- Sonarr -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
		<div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/40">
			<div class="flex items-center gap-3">
				<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M2 16.1A5 5 0 0115.9 6L21 3v18H8a5 5 0 01-6-4.9z" />
					</svg>
				</div>
				<div>
					<h3 class="font-semibold text-zinc-100">Sonarr</h3>
					<p class="text-xs text-zinc-500">TV series management</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider
					       {sonarrConnected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-700/40 text-zinc-500'}"
				>
					<span
						class="inline-block h-1.5 w-1.5 rounded-full {sonarrConnected
							? 'bg-emerald-500'
							: 'bg-zinc-600'}"
					/>
					{sonarrConnected ? 'Connected' : 'Disconnected'}
				</span>
				{#if values.sonarr.baseUrl || values.sonarr.apiKey}
					<button
						on:click={() => clearIntegration('sonarr')}
						class="rounded-md p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
						title="Remove"
					>
						<svg class="h-4 w-4" viewBox="0 0 15 15" fill="currentColor">
							<path
								d="M5.5 1a.5.5 0 000 1h4a.5.5 0 000-1h-4zM3 3.5a.5.5 0 01.5-.5h8a.5.5 0 010 1H11v8a1 1 0 01-1 1H5a1 1 0 01-1-1V4h-.5a.5.5 0 01-.5-.5zM5 4v8h5V4H5z"
							/>
						</svg>
					</button>
				{/if}
			</div>
		</div>

		<div class="px-5 py-4 space-y-4">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-medium text-zinc-400 uppercase tracking-wider">Base URL</label>
					<input
						type="text"
						placeholder="http://127.0.0.1:8989"
						bind:value={values.sonarr.baseUrl}
						class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
						       placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
						       transition-colors"
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-medium text-zinc-400 uppercase tracking-wider">API Key</label>
					<input
						type="text"
						placeholder="Your Sonarr API key"
						bind:value={values.sonarr.apiKey}
						class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
						       placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
						       transition-colors font-mono text-xs"
					/>
				</div>
			</div>

			<button
				on:click={testSonarr}
				disabled={sonarrTesting || !values.sonarr.baseUrl || !values.sonarr.apiKey}
				class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all
				       {sonarrTestResult === true
					? 'border-emerald-600 bg-emerald-500/15 text-emerald-400'
					: sonarrTestResult === false
						? 'border-red-600 bg-red-500/15 text-red-400'
						: 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:text-zinc-200'}
				       disabled:opacity-40 disabled:cursor-not-allowed"
			>
				{#if sonarrTesting}
					<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
						<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25" />
						<path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-75" />
					</svg>
					Testing…
				{:else if sonarrTestResult === true}
					<svg class="h-3.5 w-3.5" viewBox="0 0 15 15" fill="currentColor">
						<path d="M11.467 3.727a.667.667 0 01.06.94l-4.666 5.333a.667.667 0 01-.981.018L3.547 7.685a.667.667 0 01.94-.943l1.839 1.839 4.2-4.8a.667.667 0 01.94-.054z" />
					</svg>
					Connected
				{:else if sonarrTestResult === false}
					Failed
				{:else}
					Test Connection
				{/if}
			</button>

			{#if sonarrConnected}
				<div class="border-t border-zinc-800/40 pt-4">
					<h4 class="text-xs font-medium text-amber-300/70 uppercase tracking-wider mb-3">Options</h4>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="flex flex-col gap-1.5">
							<label class="text-xs text-zinc-400">Root Folder</label>
							{#if !sonarrRootFolders}
								<div class="h-9 rounded-lg bg-zinc-800/40 animate-pulse" />
							{:else}
								<select
									bind:value={values.sonarr.rootFolderPath}
									class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
									       focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
									       appearance-none cursor-pointer"
								>
									{#each sonarrRootFolders as folder}
										<option value={folder.path}>{folder.path}</option>
									{/each}
								</select>
							{/if}
						</div>
						<div class="flex flex-col gap-1.5">
							<label class="text-xs text-zinc-400">Quality Profile</label>
							{#if !sonarrQualityProfiles}
								<div class="h-9 rounded-lg bg-zinc-800/40 animate-pulse" />
							{:else}
								<select
									bind:value={values.sonarr.qualityProfileId}
									class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
									       focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
									       appearance-none cursor-pointer"
								>
									{#each sonarrQualityProfiles as profile}
										<option value={profile.id}>{profile.name}</option>
									{/each}
								</select>
							{/if}
						</div>
						<div class="flex flex-col gap-1.5">
							<label class="text-xs text-zinc-400">Language Profile</label>
							{#if !sonarrLanguageProfiles}
								<div class="h-9 rounded-lg bg-zinc-800/40 animate-pulse" />
							{:else}
								<select
									bind:value={values.sonarr.languageProfileId}
									class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
									       focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
									       appearance-none cursor-pointer"
								>
									{#each sonarrLanguageProfiles as profile}
										<option value={profile.id}>{profile.name}</option>
									{/each}
								</select>
							{/if}
						</div>
						<div class="flex flex-col gap-1.5">
							<label class="text-xs text-zinc-400">Monitor</label>
							{#if !sonarrMonitorsList}
								<div class="h-9 rounded-lg bg-zinc-800/40 animate-pulse" />
							{:else}
								<select
									bind:value={values.sonarr.monitor}
									class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
									       focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
									       appearance-none cursor-pointer"
								>
									{#each sonarrMonitorsList as mon}
										<option value={mon.id}>{mon.type}</option>
									{/each}
								</select>
							{/if}
						</div>
					</div>
					<div class="mt-4 flex items-center justify-between rounded-lg bg-zinc-800/30 px-4 py-3">
						<div>
							<p class="text-sm text-zinc-300">Search on add</p>
							<p class="text-xs text-zinc-500">Start searching for episodes when a series is added</p>
						</div>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" bind:checked={values.sonarr.StartSearch} class="sr-only peer" />
							<div
								class="w-10 h-5 rounded-full peer bg-zinc-700 peer-checked:bg-amber-400/50
								       after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all
								       peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px]"
							/>
						</label>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Radarr -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
		<div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/40">
			<div class="flex items-center gap-3">
				<div
					class="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
						<line x1="7" y1="2" x2="7" y2="22" />
						<line x1="17" y1="2" x2="17" y2="22" />
						<line x1="2" y1="12" x2="22" y2="12" />
						<line x1="2" y1="7" x2="7" y2="7" />
						<line x1="2" y1="17" x2="7" y2="17" />
						<line x1="17" y1="17" x2="22" y2="17" />
						<line x1="17" y1="7" x2="22" y2="7" />
					</svg>
				</div>
				<div>
					<h3 class="font-semibold text-zinc-100">Radarr</h3>
					<p class="text-xs text-zinc-500">Movie management</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider
					       {radarrConnected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-700/40 text-zinc-500'}"
				>
					<span
						class="inline-block h-1.5 w-1.5 rounded-full {radarrConnected
							? 'bg-emerald-500'
							: 'bg-zinc-600'}"
					/>
					{radarrConnected ? 'Connected' : 'Disconnected'}
				</span>
				{#if values.radarr.baseUrl || values.radarr.apiKey}
					<button
						on:click={() => clearIntegration('radarr')}
						class="rounded-md p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
						title="Remove"
					>
						<svg class="h-4 w-4" viewBox="0 0 15 15" fill="currentColor">
							<path
								d="M5.5 1a.5.5 0 000 1h4a.5.5 0 000-1h-4zM3 3.5a.5.5 0 01.5-.5h8a.5.5 0 010 1H11v8a1 1 0 01-1 1H5a1 1 0 01-1-1V4h-.5a.5.5 0 01-.5-.5zM5 4v8h5V4H5z"
							/>
						</svg>
					</button>
				{/if}
			</div>
		</div>

		<div class="px-5 py-4 space-y-4">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-medium text-zinc-400 uppercase tracking-wider">Base URL</label>
					<input
						type="text"
						placeholder="http://127.0.0.1:7878"
						bind:value={values.radarr.baseUrl}
						class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
						       placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
						       transition-colors"
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-medium text-zinc-400 uppercase tracking-wider">API Key</label>
					<input
						type="text"
						placeholder="Your Radarr API key"
						bind:value={values.radarr.apiKey}
						class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
						       placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
						       transition-colors font-mono text-xs"
					/>
				</div>
			</div>

			<button
				on:click={testRadarr}
				disabled={radarrTesting || !values.radarr.baseUrl || !values.radarr.apiKey}
				class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all
				       {radarrTestResult === true
					? 'border-emerald-600 bg-emerald-500/15 text-emerald-400'
					: radarrTestResult === false
						? 'border-red-600 bg-red-500/15 text-red-400'
						: 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:text-zinc-200'}
				       disabled:opacity-40 disabled:cursor-not-allowed"
			>
				{#if radarrTesting}
					<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
						<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25" />
						<path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-75" />
					</svg>
					Testing…
				{:else if radarrTestResult === true}
					<svg class="h-3.5 w-3.5" viewBox="0 0 15 15" fill="currentColor">
						<path d="M11.467 3.727a.667.667 0 01.06.94l-4.666 5.333a.667.667 0 01-.981.018L3.547 7.685a.667.667 0 01.94-.943l1.839 1.839 4.2-4.8a.667.667 0 01.94-.054z" />
					</svg>
					Connected
				{:else if radarrTestResult === false}
					Failed
				{:else}
					Test Connection
				{/if}
			</button>

			{#if radarrConnected}
				<div class="border-t border-zinc-800/40 pt-4">
					<h4 class="text-xs font-medium text-amber-300/70 uppercase tracking-wider mb-3">Options</h4>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="flex flex-col gap-1.5">
							<label class="text-xs text-zinc-400">Root Folder</label>
							{#if !radarrRootFolders}
								<div class="h-9 rounded-lg bg-zinc-800/40 animate-pulse" />
							{:else}
								<select
									bind:value={values.radarr.rootFolderPath}
									class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
									       focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
									       appearance-none cursor-pointer"
								>
									{#each radarrRootFolders as folder}
										<option value={folder.path}>{folder.path}</option>
									{/each}
								</select>
							{/if}
						</div>
						<div class="flex flex-col gap-1.5">
							<label class="text-xs text-zinc-400">Quality Profile</label>
							{#if !radarrQualityProfiles}
								<div class="h-9 rounded-lg bg-zinc-800/40 animate-pulse" />
							{:else}
								<select
									bind:value={values.radarr.qualityProfileId}
									class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
									       focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
									       appearance-none cursor-pointer"
								>
									{#each radarrQualityProfiles as profile}
										<option value={profile.id}>{profile.name}</option>
									{/each}
								</select>
							{/if}
						</div>
						<div class="flex flex-col gap-1.5">
							<label class="text-xs text-zinc-400">Monitor</label>
							{#if !radarrMonitorsList}
								<div class="h-9 rounded-lg bg-zinc-800/40 animate-pulse" />
							{:else}
								<select
									bind:value={values.radarr.monitor}
									class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
									       focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
									       appearance-none cursor-pointer"
								>
									{#each radarrMonitorsList as mon}
										<option value={mon.id}>{mon.type}</option>
									{/each}
								</select>
							{/if}
						</div>
					</div>
					<div class="mt-4 flex items-center justify-between rounded-lg bg-zinc-800/30 px-4 py-3">
						<div>
							<p class="text-sm text-zinc-300">Search on add</p>
							<p class="text-xs text-zinc-500">Start searching for the movie when added</p>
						</div>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" bind:checked={values.radarr.StartSearch} class="sr-only peer" />
							<div
								class="w-10 h-5 rounded-full peer bg-zinc-700 peer-checked:bg-amber-400/50
								       after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all
								       peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px]"
							/>
						</label>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Jellyfin -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
		<div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/40">
			<div class="flex items-center gap-3">
				<div
					class="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polygon points="23 7 16 12 23 17 23 7" />
						<rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
					</svg>
				</div>
				<div>
					<h3 class="font-semibold text-zinc-100">Jellyfin</h3>
					<p class="text-xs text-zinc-500">Media server</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider
					       {jellyfinConnected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-700/40 text-zinc-500'}"
				>
					<span
						class="inline-block h-1.5 w-1.5 rounded-full {jellyfinConnected
							? 'bg-emerald-500'
							: 'bg-zinc-600'}"
					/>
					{jellyfinConnected ? 'Connected' : 'Disconnected'}
				</span>
				{#if values.jellyfin.baseUrl || values.jellyfin.apiKey}
					<button
						on:click={() => clearIntegration('jellyfin')}
						class="rounded-md p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
						title="Remove"
					>
						<svg class="h-4 w-4" viewBox="0 0 15 15" fill="currentColor">
							<path
								d="M5.5 1a.5.5 0 000 1h4a.5.5 0 000-1h-4zM3 3.5a.5.5 0 01.5-.5h8a.5.5 0 010 1H11v8a1 1 0 01-1 1H5a1 1 0 01-1-1V4h-.5a.5.5 0 01-.5-.5zM5 4v8h5V4H5z"
							/>
						</svg>
					</button>
				{/if}
			</div>
		</div>

		<div class="px-5 py-4 space-y-4">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-medium text-zinc-400 uppercase tracking-wider">Base URL</label>
					<input
						type="text"
						placeholder="http://127.0.0.1:8096"
						bind:value={values.jellyfin.baseUrl}
						class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
						       placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
						       transition-colors"
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-medium text-zinc-400 uppercase tracking-wider">API Key</label>
					<input
						type="text"
						placeholder="Your Jellyfin API key"
						bind:value={values.jellyfin.apiKey}
						class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
						       placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
						       transition-colors font-mono text-xs"
					/>
				</div>
			</div>

			<button
				on:click={testJellyfin}
				disabled={jellyfinTesting || !values.jellyfin.baseUrl || !values.jellyfin.apiKey}
				class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all
				       {jellyfinTestResult === true
					? 'border-emerald-600 bg-emerald-500/15 text-emerald-400'
					: jellyfinTestResult === false
						? 'border-red-600 bg-red-500/15 text-red-400'
						: 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:text-zinc-200'}
				       disabled:opacity-40 disabled:cursor-not-allowed"
			>
				{#if jellyfinTesting}
					<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
						<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25" />
						<path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-75" />
					</svg>
					Testing…
				{:else if jellyfinTestResult === true}
					<svg class="h-3.5 w-3.5" viewBox="0 0 15 15" fill="currentColor">
						<path d="M11.467 3.727a.667.667 0 01.06.94l-4.666 5.333a.667.667 0 01-.981.018L3.547 7.685a.667.667 0 01.94-.943l1.839 1.839 4.2-4.8a.667.667 0 01.94-.054z" />
					</svg>
					Connected
				{:else if jellyfinTestResult === false}
					Failed
				{:else}
					Test Connection
				{/if}
			</button>

			{#if jellyfinConnected}
				<div class="border-t border-zinc-800/40 pt-4">
					<h4 class="text-xs font-medium text-amber-300/70 uppercase tracking-wider mb-3">Options</h4>
					<div class="flex flex-col gap-1.5">
						<label class="text-xs text-zinc-400">Jellyfin User</label>
						{#if !jellyfinUsersList}
							<div class="h-9 rounded-lg bg-zinc-800/40 animate-pulse" />
						{:else}
							<select
								bind:value={values.jellyfin.userId}
								class="w-full sm:w-64 rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
								       focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
								       appearance-none cursor-pointer"
							>
								{#each jellyfinUsersList as user}
									<option value={user.id}>{user.name}</option>
								{/each}
							</select>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- TMDB -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
		<div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/40">
			<div class="flex items-center gap-3">
				<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10" />
						<polygon points="10 8 16 12 10 16 10 8" />
					</svg>
				</div>
				<div>
					<h3 class="font-semibold text-zinc-100">TMDB</h3>
					<p class="text-xs text-zinc-500">Movie & TV metadata, posters, backdrops</p>
				</div>
			</div>
			<span
				class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider
				       {values.tmdb.apiKey ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-700/40 text-zinc-500'}"
			>
				<span class="inline-block h-1.5 w-1.5 rounded-full {values.tmdb.apiKey ? 'bg-emerald-500' : 'bg-zinc-600'}" />
				{values.tmdb.apiKey ? 'Configured' : 'Not set'}
			</span>
		</div>
		<div class="px-5 py-4">
			<div class="flex flex-col gap-1.5">
				<label class="text-xs font-medium text-zinc-400 uppercase tracking-wider">API Key (Bearer Token)</label>
				<input
					type="text"
					placeholder="Your TMDB API read access token"
					bind:value={values.tmdb.apiKey}
					class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
					       placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
					       transition-colors font-mono text-xs"
				/>
				<p class="text-[11px] text-zinc-600 mt-1">Get yours at themoviedb.org → Settings → API</p>
			</div>
		</div>
	</div>

	<!-- Bazarr -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
		<div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/40">
			<div class="flex items-center gap-3">
				<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/15 text-yellow-400">
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M4 7V4h16v3" />
						<path d="M9 20h6" />
						<path d="M12 4v16" />
					</svg>
				</div>
				<div>
					<h3 class="font-semibold text-zinc-100">Bazarr</h3>
					<p class="text-xs text-zinc-500">Subtitle management</p>
				</div>
			</div>
			<span
				class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider
				       {values.bazarr.apiKey && values.bazarr.baseUrl ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-700/40 text-zinc-500'}"
			>
				<span class="inline-block h-1.5 w-1.5 rounded-full {values.bazarr.apiKey && values.bazarr.baseUrl ? 'bg-emerald-500' : 'bg-zinc-600'}" />
				{values.bazarr.apiKey && values.bazarr.baseUrl ? 'Configured' : 'Not set'}
			</span>
		</div>
		<div class="px-5 py-4 space-y-4">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-medium text-zinc-400 uppercase tracking-wider">Base URL</label>
					<input
						type="text"
						placeholder="https://bazarr.example.com"
						bind:value={values.bazarr.baseUrl}
						class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
						       placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
						       transition-colors"
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-medium text-zinc-400 uppercase tracking-wider">API Key</label>
					<input
						type="text"
						placeholder="Your Bazarr API key"
						bind:value={values.bazarr.apiKey}
						class="w-full rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-200
						       placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30
						       transition-colors font-mono text-xs"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Server Info -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
		<h3 class="font-semibold text-zinc-100">Server</h3>
		<dl class="mt-3 grid grid-cols-2 gap-3 text-sm">
			<dt class="text-zinc-500">Users</dt>
			<dd class="text-zinc-200 font-medium">{data.userCount}</dd>
			<dt class="text-zinc-500">App</dt>
			<dd class="text-zinc-200 font-medium">WATCHERR</dd>
		</dl>
	</div>
</div>
