<script lang="ts">
	export let mode: 'request' | 'online';
	export let active = false;
	export let disabled = false;

	const content = {
		request: {
			title: 'Request Mode',
			tagline: 'Build your personal library',
			bullets: [
				'Request any movie or show — it downloads automatically',
				'Plays instantly from your local library, offline-capable',
				'Best quality, permanent — stays yours forever'
			],
			bestFor: 'Watching at home on TV, keeping favorites long-term',
			accent: 'cyan' as const
		},
		online: {
			title: 'Online Mode',
			tagline: 'Stream instantly, no waiting',
			bullets: [
				'Tap and play — opens directly in VLC on your device',
				'Designed for phones and tablets only',
				'Requires VLC app installed on your device',
				'Nothing downloads to the server'
			],
			bestFor: 'Watching on your phone or tablet with VLC',
			accent: 'amber' as const
		}
	};
	$: c = content[mode];
	$: accent =
		c.accent === 'cyan'
			? {
					border: 'border-cyan-400/40',
					glow: 'hover:border-cyan-300 hover:shadow-cyan-500/20',
					pill: 'bg-cyan-400/15 text-cyan-200 border-cyan-400/30',
					dot: 'bg-cyan-300'
			  }
			: {
					border: 'border-amber-400/40',
					glow: 'hover:border-amber-300 hover:shadow-amber-500/20',
					pill: 'bg-amber-400/15 text-amber-200 border-amber-400/30',
					dot: 'bg-amber-300'
			  };
</script>

<button
	type="button"
	{disabled}
	on:click
	aria-pressed={active}
	class="group relative w-full text-left rounded-2xl p-5
	       bg-gradient-to-br from-stone-900 via-stone-950 to-black
	       border {accent.border} shadow-xl shadow-black/40
	       transition-all duration-200 cursor-pointer
	       {accent.glow}
	       hover:-translate-y-1 hover:shadow-2xl
	       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
	class:ring-2={active}
	class:ring-offset-2={active}
	class:ring-offset-stone-950={active}
	class:ring-amber-300={active && mode === 'online'}
	class:ring-cyan-300={active && mode === 'request'}
>
	<div class="flex items-start justify-between gap-2">
		<div class="flex-1">
			<div
				class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px]
				       font-semibold uppercase tracking-widest {accent.pill} mb-3"
			>
				<span class="h-1.5 w-1.5 rounded-full {accent.dot} animate-pulse"></span>
				<span>{c.tagline}</span>
			</div>
			<h3 class="text-xl font-bold text-zinc-100">{c.title}</h3>
		</div>
		{#if mode === 'request'}
			<svg class="h-8 w-8 text-cyan-300" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect x="6" y="10" width="36" height="28" rx="3" />
				<path d="M14 24h20" class="anim-bar" />
				<path d="M20 30l4 4 8-10" class="anim-tick" />
			</svg>
		{:else}
			<svg class="h-8 w-8 text-amber-300" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect x="14" y="4" width="20" height="40" rx="3" />
				<line x1="22" y1="38" x2="26" y2="38" />
				<polygon points="20,17 20,31 32,24" fill="currentColor" stroke="none" class="anim-bolt" />
			</svg>
		{/if}
	</div>

	<ul class="mt-4 space-y-2">
		{#each c.bullets as b}
			<li class="flex items-start gap-2 text-sm text-zinc-300">
				<span class="shrink-0 mt-1.5 h-1 w-1 rounded-full {accent.dot}"></span>
				<span>{b}</span>
			</li>
		{/each}
	</ul>

	<p class="mt-4 text-xs text-zinc-500 italic">Best for: {c.bestFor}</p>

	{#if active}
		<div class="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-950/80 backdrop-blur border border-zinc-700 text-[10px] font-semibold text-zinc-300">
			<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
			Active
		</div>
	{/if}
</button>

<style>
	@keyframes bar-fill {
		from { stroke-dashoffset: 20; }
		to { stroke-dashoffset: 0; }
	}
	@keyframes tick-pop {
		0%, 40% { opacity: 0; transform: scale(0.7); }
		50%, 100% { opacity: 1; transform: scale(1); }
	}
	@keyframes bolt-glow {
		0%, 100% { opacity: 0.6; }
		50% { opacity: 1; }
	}
	.anim-bar {
		stroke-dasharray: 20;
		animation: bar-fill 1.2s ease-out infinite alternate;
	}
	.anim-tick {
		transform-origin: center;
		animation: tick-pop 2.4s ease-in-out infinite;
	}
	.anim-bolt { animation: bolt-glow 1.5s ease-in-out infinite; }

	@media (prefers-reduced-motion: reduce) {
		.anim-bar, .anim-tick, .anim-bolt, .anim-wave { animation: none; }
	}
</style>
