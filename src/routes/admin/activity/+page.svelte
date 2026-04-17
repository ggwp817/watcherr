<script lang="ts">
	import type { PageData } from './$types';
	export let data: PageData;
</script>

<div class="mb-8">
	<h1 class="text-2xl font-bold tracking-tight">Activity</h1>
	<p class="mt-1 text-sm text-zinc-500">Last 50 login attempts, newest first.</p>
</div>

{#if data.events.length === 0}
	<div class="mt-12 text-center">
		<p class="text-zinc-500 text-sm">No login activity recorded yet.</p>
	</div>
{:else}
	<div class="rounded-xl border border-zinc-800/60 overflow-hidden">
		<div class="hidden sm:grid grid-cols-[1fr_1fr_1fr_80px] gap-4
		            bg-zinc-900/80 px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
			<span>Time</span>
			<span>Username</span>
			<span>IP Address</span>
			<span class="text-center">Result</span>
		</div>
		{#each data.events as e, i (e.id)}
			<div
				class="flex flex-col sm:grid sm:grid-cols-[1fr_1fr_1fr_80px] gap-1 sm:gap-4
				       px-5 py-3.5 text-sm
				       {i % 2 === 0 ? 'bg-zinc-900/30' : 'bg-zinc-900/10'}
				       border-t border-zinc-800/30 first:border-t-0"
			>
				<span class="text-zinc-400 text-xs sm:text-sm">
					{new Date(e.createdAt).toLocaleString()}
				</span>
				<span class="font-medium text-zinc-200">{e.username}</span>
				<span class="text-zinc-500 font-mono text-xs sm:text-sm">{e.ip}</span>
				<span class="sm:text-center">
					{#if e.success}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-emerald-500/15
							       px-2 py-0.5 text-[10px] font-semibold text-emerald-400"
						>
							<span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
							OK
						</span>
					{:else}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-red-500/15
							       px-2 py-0.5 text-[10px] font-semibold text-red-400"
						>
							<span class="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
							Failed
						</span>
					{/if}
				</span>
			</div>
		{/each}
	</div>
{/if}
