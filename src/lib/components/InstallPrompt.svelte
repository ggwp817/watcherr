<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	const STORAGE_KEY = 'watcherr.installPrompt.dismissed.v1';

	type BeforeInstallPromptEvent = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	};

	let visible = false;
	let platform: 'ios' | 'android' | null = null;
	let deferredPrompt: BeforeInstallPromptEvent | null = null;
	let installing = false;

	function isMobileOrTablet(): boolean {
		if (typeof window === 'undefined') return false;
		const ua = navigator.userAgent || '';
		const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
		const widthOk = window.innerWidth <= 1024;
		const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua);
		return (coarse && widthOk) || uaMobile;
	}

	function isStandalone(): boolean {
		if (typeof window === 'undefined') return false;
		const iosStandalone = (window.navigator as any).standalone === true;
		const matchStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
		return iosStandalone || matchStandalone;
	}

	function detectPlatform(): 'ios' | 'android' | null {
		const ua = navigator.userAgent || '';
		if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
		if (/Android/i.test(ua)) return 'android';
		return null;
	}

	function dismiss() {
		visible = false;
		try {
			localStorage.setItem(STORAGE_KEY, String(Date.now()));
		} catch {
			/* ignore */
		}
	}

	async function install() {
		if (!deferredPrompt) return;
		installing = true;
		try {
			await deferredPrompt.prompt();
			const choice = await deferredPrompt.userChoice;
			if (choice.outcome === 'accepted') dismiss();
		} catch {
			/* ignore */
		} finally {
			installing = false;
			deferredPrompt = null;
		}
	}

	onMount(() => {
		if (typeof window === 'undefined') return;
		if (isStandalone()) return;
		if (!isMobileOrTablet()) return;

		try {
			if (localStorage.getItem(STORAGE_KEY)) return;
		} catch {
			return;
		}

		platform = detectPlatform();
		if (!platform) return;

		const onBeforeInstall = (e: Event) => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
		};
		window.addEventListener('beforeinstallprompt', onBeforeInstall);

		const timer = window.setTimeout(() => {
			visible = true;
		}, 2500);

		return () => {
			window.removeEventListener('beforeinstallprompt', onBeforeInstall);
			window.clearTimeout(timer);
		};
	});

	$: if (visible && $page.url.pathname === '/login') visible = false;
</script>

{#if visible}
	<div
		class="fixed inset-x-3 bottom-3 mb-safe z-[100] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm
		       animate-slide-up"
		role="dialog"
		aria-modal="false"
		aria-labelledby="install-prompt-title"
	>
		<div
			class="relative overflow-hidden rounded-2xl
			       bg-gradient-to-br from-stone-900 via-stone-950 to-black
			       border border-amber-300/20 shadow-2xl shadow-black/60 backdrop-blur-xl
			       p-5"
		>
			<div
				class="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-amber-300/10 blur-2xl pointer-events-none"
			/>

			<button
				type="button"
				on:click={dismiss}
				aria-label="Dismiss install prompt"
				class="absolute top-3 right-3 h-7 w-7 inline-flex items-center justify-center
				       rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60
				       transition cursor-pointer"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
					<line x1="6" y1="6" x2="18" y2="18" />
					<line x1="18" y1="6" x2="6" y2="18" />
				</svg>
			</button>

			<div class="flex items-start gap-3 relative">
				<div
					class="shrink-0 h-11 w-11 rounded-xl bg-amber-300/15 border border-amber-300/30
					       flex items-center justify-center"
				>
					<img src="/icons/icon-192.png" alt="" class="h-8 w-8 rounded-md" />
				</div>
				<div class="min-w-0 flex-1">
					<h3 id="install-prompt-title" class="text-sm font-semibold text-zinc-100">
						Install WATCHERR
					</h3>
					<p class="text-xs text-zinc-400 mt-0.5 leading-relaxed">
						{#if platform === 'ios'}
							Add to your Home Screen for a full-screen, app-like experience.
						{:else}
							Install as an app for faster access and offline support.
						{/if}
					</p>
				</div>
			</div>

			{#if platform === 'ios'}
				<ol class="mt-4 space-y-2 text-xs text-zinc-300 relative">
					<li class="flex items-center gap-2.5">
						<span
							class="shrink-0 h-5 w-5 rounded-full bg-amber-300/15 border border-amber-300/30 text-amber-200 text-[10px] font-bold flex items-center justify-center"
							>1</span
						>
						<span class="flex items-center gap-1.5">
							Tap the
							<svg class="inline h-4 w-4 text-amber-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 2v13" />
								<path d="m7 7 5-5 5 5" />
								<rect x="4" y="9" width="16" height="13" rx="2" />
							</svg>
							Share button
						</span>
					</li>
					<li class="flex items-center gap-2.5">
						<span
							class="shrink-0 h-5 w-5 rounded-full bg-amber-300/15 border border-amber-300/30 text-amber-200 text-[10px] font-bold flex items-center justify-center"
							>2</span
						>
						<span>Scroll and tap <strong class="text-zinc-100">Add to Home Screen</strong></span>
					</li>
					<li class="flex items-center gap-2.5">
						<span
							class="shrink-0 h-5 w-5 rounded-full bg-amber-300/15 border border-amber-300/30 text-amber-200 text-[10px] font-bold flex items-center justify-center"
							>3</span
						>
						<span>Turn on <strong class="text-zinc-100">Open as Web App</strong></span>
					</li>
					<li class="flex items-center gap-2.5">
						<span
							class="shrink-0 h-5 w-5 rounded-full bg-amber-300/15 border border-amber-300/30 text-amber-200 text-[10px] font-bold flex items-center justify-center"
							>4</span
						>
						<span>Tap <strong class="text-zinc-100">Add</strong> in the top right</span>
					</li>
				</ol>
				<div class="mt-5 flex justify-end relative">
					<button
						type="button"
						on:click={dismiss}
						class="px-4 py-2 rounded-lg text-xs font-semibold
						       bg-amber-300 text-stone-950 hover:bg-amber-200
						       transition cursor-pointer"
					>
						Got it
					</button>
				</div>
			{:else}
				<div class="mt-5 flex items-center justify-end gap-2 relative">
					<button
						type="button"
						on:click={dismiss}
						class="px-3 py-2 rounded-lg text-xs font-medium text-zinc-400
						       hover:text-zinc-200 hover:bg-zinc-800/50 transition cursor-pointer"
					>
						Not now
					</button>
					{#if deferredPrompt}
						<button
							type="button"
							disabled={installing}
							on:click={install}
							class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold
							       bg-amber-300 text-stone-950 hover:bg-amber-200
							       disabled:opacity-60 transition cursor-pointer"
						>
							<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 3v12" />
								<path d="m7 10 5 5 5-5" />
								<path d="M5 21h14" />
							</svg>
							{installing ? 'Installing…' : 'Install'}
						</button>
					{:else}
						<button
							type="button"
							on:click={dismiss}
							class="px-4 py-2 rounded-lg text-xs font-semibold
							       bg-amber-300 text-stone-950 hover:bg-amber-200
							       transition cursor-pointer"
						>
							Got it
						</button>
					{/if}
				</div>
				{#if !deferredPrompt}
					<p class="mt-3 text-[11px] text-zinc-500 relative">
						In Chrome, open the menu (⋮) and tap <strong class="text-zinc-300">Install app</strong>.
					</p>
				{/if}
			{/if}
		</div>
	</div>
{/if}

<style>
	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(24px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-slide-up {
		animation: slide-up 260ms ease-out;
	}
</style>
