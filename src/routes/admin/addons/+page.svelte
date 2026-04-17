<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	export let data: PageData;

	let showInstall = false;
	let installUrl = '';
	let validating = false;
	let preview: any = null;
	let installError = '';
	let installing = false;

	async function validate() {
		validating = true;
		installError = '';
		preview = null;
		try {
			const res = await fetch('/api/admin/addons/validate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ manifestUrl: installUrl })
			});
			const payload = await res.json();
			if (!res.ok || !payload.ok) {
				installError = payload.error || 'Invalid manifest';
				return;
			}
			preview = payload.manifest;
		} catch {
			installError = 'Network error';
		} finally {
			validating = false;
		}
	}

	async function install() {
		installing = true;
		installError = '';
		try {
			const res = await fetch('/api/admin/addons', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ manifestUrl: installUrl })
			});
			const payload = await res.json();
			if (!res.ok) {
				installError = payload.error || 'Install failed';
				return;
			}
			showInstall = false;
			installUrl = '';
			preview = null;
			await invalidateAll();
		} catch {
			installError = 'Network error';
		} finally {
			installing = false;
		}
	}

	async function toggle(id: string, enabled: boolean) {
		await fetch(`/api/admin/addons/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ enabled })
		});
		await invalidateAll();
	}

	async function refresh(id: string) {
		await fetch(`/api/admin/addons/${id}/refresh`, { method: 'POST' });
		await invalidateAll();
	}

	async function remove(id: string, name: string) {
		if (!confirm(`Remove "${name}"?`)) return;
		await fetch(`/api/admin/addons/${id}`, { method: 'DELETE' });
		await invalidateAll();
	}

	function copy(s: string) {
		navigator.clipboard.writeText(s).catch(() => {});
	}
</script>

<div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
	<div class="flex flex-wrap items-center justify-between gap-3 mb-6">
		<div>
			<h1 class="text-2xl font-bold text-zinc-100">Addons</h1>
			<p class="text-sm text-zinc-400 mt-1">
				Install Stremio-compatible addon manifests. Users in Online Mode will see their streams.
			</p>
		</div>
		<button
			on:click={() => (showInstall = true)}
			class="inline-flex items-center gap-2 px-4 py-2 rounded-xl
			       bg-amber-300 text-stone-950 text-sm font-semibold
			       hover:bg-amber-200 transition cursor-pointer"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
			Install Addon
		</button>
	</div>

	{#if data.addons.length === 0}
		<div class="text-center py-16 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40">
			<p class="text-zinc-300 font-medium">No addons installed yet</p>
			<p class="text-xs text-zinc-500 mt-2">
				Try pasting a Torrentio manifest URL — e.g.<br />
				<code class="text-amber-300">https://torrentio.strem.fun/realdebrid=&lt;key&gt;/manifest.json</code>
			</p>
		</div>
	{:else}
		<div class="grid gap-3">
			{#each data.addons as a (a.id)}
				<div class="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
					<div class="flex items-start gap-3">
						{#if a.logo}
							<img src={a.logo} alt="" class="h-10 w-10 rounded object-cover shrink-0" />
						{:else}
							<div class="h-10 w-10 rounded bg-zinc-900 shrink-0" />
						{/if}
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 flex-wrap">
								<h3 class="text-sm font-semibold text-zinc-100">{a.name}</h3>
								{#each a.types as t}
									<span class="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 uppercase">{t}</span>
								{/each}
								{#each a.resources as r}
									<span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200 text-[10px] uppercase">{r}</span>
								{/each}
							</div>
							{#if a.description}
								<p class="text-xs text-zinc-400 mt-1 line-clamp-2">{a.description}</p>
							{/if}
							<p class="text-[11px] text-zinc-600 mt-1 break-all">{a.manifestUrl}</p>
						</div>
						<label class="inline-flex items-center gap-2 text-xs cursor-pointer shrink-0">
							<input
								type="checkbox"
								checked={a.enabled}
								on:change={(e) => toggle(a.id, e.currentTarget.checked)}
							/>
							<span class="text-zinc-300">Enabled</span>
						</label>
					</div>
					<div class="mt-3 flex flex-wrap gap-2 text-xs">
						<button
							on:click={() => refresh(a.id)}
							class="px-3 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
						>Refresh</button>
						<button
							on:click={() => copy(a.manifestUrl)}
							class="px-3 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
						>Copy URL</button>
						<button
							on:click={() => remove(a.id, a.name)}
							class="px-3 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 cursor-pointer"
						>Delete</button>
						<span class="ml-auto text-[11px] text-zinc-500 self-center">
							{a.lastCheckedAt ? `Last checked ${new Date(a.lastCheckedAt).toLocaleString()}` : 'Never refreshed'}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showInstall}
	<div
		class="fixed inset-0 z-[115] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
		on:click|self={() => (showInstall = false)}
		role="dialog"
		aria-modal="true"
	>
		<div class="w-full max-w-lg bg-stone-950 border border-zinc-800 rounded-2xl shadow-2xl p-6">
			<h3 class="text-lg font-semibold text-zinc-100">Install addon</h3>
			<p class="text-xs text-zinc-500 mt-1">
				Paste a Stremio-compatible manifest URL. For Torrentio, embed your Real-Debrid key in the URL.
			</p>
			<input
				type="text"
				bind:value={installUrl}
				placeholder="https://torrentio.strem.fun/realdebrid=KEY/manifest.json"
				class="mt-4 w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100"
			/>
			{#if preview}
				<div class="mt-4 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
					<div class="flex items-center gap-2">
						{#if preview.logo}
							<img src={preview.logo} alt="" class="h-8 w-8 rounded" />
						{/if}
						<div>
							<div class="text-sm font-semibold text-zinc-100">{preview.name}</div>
							<div class="text-[11px] text-zinc-500">{preview.resources?.join(', ')}</div>
						</div>
					</div>
					{#if preview.description}
						<p class="mt-2 text-xs text-zinc-400">{preview.description}</p>
					{/if}
				</div>
			{/if}
			{#if installError}
				<p class="mt-3 text-xs text-red-400">{installError}</p>
			{/if}
			<div class="mt-5 flex justify-end gap-2">
				<button
					on:click={() => (showInstall = false)}
					class="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
				>Cancel</button>
				{#if !preview}
					<button
						disabled={!installUrl || validating}
						on:click={validate}
						class="px-4 py-2 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-100 hover:bg-zinc-700 disabled:opacity-60 cursor-pointer"
					>{validating ? 'Checking…' : 'Validate'}</button>
				{:else}
					<button
						disabled={installing}
						on:click={install}
						class="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-300 text-stone-950 hover:bg-amber-200 disabled:opacity-60 cursor-pointer"
					>{installing ? 'Installing…' : 'Install'}</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
