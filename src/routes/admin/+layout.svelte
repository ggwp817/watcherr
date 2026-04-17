<script lang="ts">
	import { page } from '$app/stores';

	const tabs = [
		{ href: '/admin/users', label: 'Users', icon: '👤' },
		{ href: '/admin/system', label: 'System', icon: '⚙' },
		{ href: '/admin/activity', label: 'Activity', icon: '📋' },
		{ href: '/admin/preferences', label: 'Preferences', icon: '🎛' },
		{ href: '/admin/sources', label: 'Sources', icon: '💾' },
		{ href: '/admin/addons', label: 'Addons', icon: '🧩' }
	];

	$: active = (href: string) => $page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<title>Admin · WATCHERR</title>
</svelte:head>

<div class="flex min-h-screen bg-stone-950 text-zinc-100 pt-16">
	<aside
		class="hidden sm:flex w-56 flex-col border-r border-zinc-800/60 bg-stone-950/80
		       backdrop-blur-sm py-8 sticky top-16 h-[calc(100vh-4rem)]"
	>
		<div class="px-6 mb-8">
			<div class="flex items-center gap-2">
				<div class="rounded-full bg-amber-300 h-3 w-3" />
				<h2 class="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Admin Panel</h2>
			</div>
		</div>
		<nav class="flex flex-col gap-1 px-3 flex-1">
			{#each tabs as tab}
				<a
					href={tab.href}
					class="rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
					       {active(tab.href)
						? 'bg-amber-300/10 text-amber-300 shadow-sm shadow-amber-300/5'
						: 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}"
				>
					{tab.label}
				</a>
			{/each}
		</nav>
		<div class="px-3 mt-auto">
			<a
				href="/"
				class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium
				       text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300 transition-all"
			>
				<span class="text-xs">←</span> Back to app
			</a>
		</div>
	</aside>

	<div class="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-zinc-800/60
	            bg-stone-950/90 backdrop-blur-lg px-2 py-2 pb-safe flex justify-around">
		{#each tabs as tab}
			<a
				href={tab.href}
				class="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition
				       {active(tab.href) ? 'text-amber-300' : 'text-zinc-500'}"
			>
				{tab.label}
			</a>
		{/each}
		<a
			href="/"
			class="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500"
		>
			Back
		</a>
	</div>

	<main class="flex-1 p-6 sm:p-10 max-w-5xl pb-24 sm:pb-10"><slot /></main>
</div>
