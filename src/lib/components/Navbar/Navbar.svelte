<script lang="ts">
	import { ChevronLeft, Cross1, HamburgerMenu, MagnifyingGlass, Person } from 'radix-icons-svelte';
	import classNames from 'classnames';
	import { page } from '$app/stores';
	import TitleSearchModal from './TitleSearchModal.svelte';
	import IconButton from '../IconButton.svelte';
	import { fade } from 'svelte/transition';
	import { modalStack } from '../../stores/modal.store';
	import { _ } from 'svelte-i18n';

	let y = 0;
	let transparent = true;
	let baseStyle = '';

	let isMobileMenuVisible = false;

	function getLinkStyle(path: string) {
		return classNames('selectable rounded-sm px-2 -mx-2 sm:text-base text-xl', {
			'text-amber-200': $page.url.pathname === path,
			'hover:text-zinc-50 cursor-pointer': $page.url.pathname !== path
		});
	}

	function openSearchModal() {
		modalStack.create(TitleSearchModal, {});
	}

	function handleShortcuts(event: KeyboardEvent) {
		if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			openSearchModal();
		}
	}

	$: isHome = $page.url.pathname === '/' || $page.url.pathname === '';

	function goBack() {
		if (window.history.length > 1) {
			window.history.back();
		} else {
			window.location.href = '/';
		}
	}

	$: {
		transparent = y <= 0;
		baseStyle = classNames(
			'fixed px-4 sm:px-8 inset-x-0 grid-cols-[min-content_1fr_min-content] items-center z-10',
			'transition-all',
			{
				'bg-stone-900 bg-opacity-50 backdrop-blur-2xl': !isMobileMenuVisible && !transparent,
				'h-16': !transparent,
				'h-16 sm:h-24': transparent
			}
		);
	}
</script>

<svelte:window bind:scrollY={y} on:keydown={handleShortcuts} />

<div class={classNames(baseStyle, 'hidden sm:grid')}>
	<a
		href="/"
		class="hidden sm:flex gap-2 items-center hover:text-inherit selectable rounded-sm px-2 -mx-2"
	>
		<div class="h-8 w-8 rounded-lg flex items-center justify-center border border-amber-400/15" style="background:linear-gradient(145deg,rgba(251,191,36,0.06),rgba(251,191,36,0.02));">
			<span class="text-amber-400/85 text-sm font-semibold" style="font-family:Inter,system-ui,sans-serif;">W</span>
		</div>
		<h1 class="font-light text-xl tracking-[0.32em] text-white/80" style="font-family:Inter,system-ui,sans-serif;">WATCHERR</h1>
	</a>
	<div
		class="flex items-center justify-center gap-4 md:gap-8 font-normal text-sm tracking-wider text-zinc-200"
	>
		<a href="/" class={$page && getLinkStyle('/')}>
			{$_('navbar.home')}
		</a>
		<!-- <a href="/discover" class={$page && getLinkStyle('/discover')}>
			{$_('navbar.discover')}
		</a> -->
		{#if $page.data?.user?.mode !== 'online'}
			<a href="/library" class={$page && getLinkStyle('/library')}>
				{$_('navbar.library')}
			</a>
		{/if}
		{#if $page.data?.user?.isAdmin}
			<a href="/settings" class={$page && getLinkStyle('/settings')}>
				{$_('navbar.settings')}
			</a>
			<a href="/admin" class={$page && getLinkStyle('/admin')}>Admin</a>
		{/if}
	</div>
	<div class="flex gap-2 items-center">
		{#if !$page.url.pathname.startsWith('/admin')}
			<IconButton on:click={openSearchModal}>
				<MagnifyingGlass size={20} />
			</IconButton>
			<a href="/profile" class="flex" aria-label="Profile">
				<IconButton>
					<Person size={20} />
				</IconButton>
			</a>
		{/if}
	</div>
</div>

<div class={classNames(baseStyle, 'grid sm:hidden pt-safe', {
	'bg-stone-950/80 backdrop-blur-xl': !isHome && transparent
})}>
	{#if isHome}
		<a href="/" class="flex gap-2 items-center hover:text-inherit selectable rounded-sm px-2 -mx-2">
			<div class="h-8 w-8 rounded-lg flex items-center justify-center border border-amber-400/15" style="background:linear-gradient(145deg,rgba(251,191,36,0.06),rgba(251,191,36,0.02));">
				<span class="text-amber-400/85 text-sm font-semibold" style="font-family:Inter,system-ui,sans-serif;">W</span>
			</div>
			<h1 class="font-light text-xl tracking-[0.32em] text-white/80" style="font-family:Inter,system-ui,sans-serif;">WATCHERR</h1>
		</a>
	{:else}
		<button
			on:click={goBack}
			class="flex items-center gap-0.5 text-zinc-100 hover:text-white
			       rounded-full pl-1 pr-3 py-1.5
			       bg-black/30 backdrop-blur-md border border-white/10
			       hover:bg-black/50 active:scale-95
			       transition-all duration-150 cursor-pointer"
		>
			<ChevronLeft size={18} />
			<span class="text-[13px] font-medium">Back</span>
		</button>
	{/if}
	<div />
	<div class="flex items-center gap-2">
		{#if !$page.url.pathname.startsWith('/admin')}
			<IconButton on:click={openSearchModal}>
				<MagnifyingGlass size={20} />
			</IconButton>
		{/if}

		{#if isMobileMenuVisible}
			<IconButton on:click={() => (isMobileMenuVisible = false)}>
				<Cross1 size={20} />
			</IconButton>
		{:else}
			<IconButton on:click={() => (isMobileMenuVisible = true)}>
				<HamburgerMenu size={20} />
			</IconButton>
		{/if}
	</div>
</div>

{#if isMobileMenuVisible}
	<div
		class="fixed inset-0 pt-16 bottom-0 bg-stone-900 bg-opacity-50 backdrop-blur-2xl z-[9] grid grid-rows-3 transition-all ease-linear pt-safe pb-safe"
		transition:fade={{ duration: 150 }}
	>
		<div class="row-span-2 flex flex-col gap-4 items-center justify-center">
			<a on:click={() => (isMobileMenuVisible = false)} href="/" class={$page && getLinkStyle('/')}>
				{$_('navbar.home')}
			</a>
			<a
				on:click={() => (isMobileMenuVisible = false)}
				href="/discover"
				class={$page && getLinkStyle('/discover')}
			>
				{$_('navbar.discover')}
			</a>
			{#if $page.data?.user?.mode !== 'online'}
				<a
					on:click={() => (isMobileMenuVisible = false)}
					href="/library"
					class={$page && getLinkStyle('/library')}
				>
					{$_('navbar.library')}
				</a>
			{/if}
			{#if $page.data?.user?.isAdmin}
				<a
					on:click={() => (isMobileMenuVisible = false)}
					href="/settings"
					class={$page && getLinkStyle('/settings')}
				>
					{$_('navbar.settings')}
				</a>
				<a
					on:click={() => (isMobileMenuVisible = false)}
					href="/admin"
					class={$page && getLinkStyle('/admin')}
				>
					Admin
				</a>
			{/if}
			{#if $page.data?.user}
				<a
					on:click={() => (isMobileMenuVisible = false)}
					href="/profile"
					class={$page && getLinkStyle('/profile')}
				>
					Profile
				</a>
			{/if}
		</div>
	</div>
{/if}
