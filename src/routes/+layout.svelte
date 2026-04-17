<script lang="ts">
	import { page } from '$app/stores';
	import I18n from '$lib/components/Lang/I18n.svelte';
	import DynamicModal from '$lib/components/Modal/DynamicModal.svelte';
	import Navbar from '$lib/components/Navbar/Navbar.svelte';
	import UpdateChecker from '$lib/components/UpdateChecker.svelte';
	import { type SettingsValues, defaultSettings, settings } from '$lib/stores/settings.store';
	import { writable } from 'svelte/store';
	import '../app.css';
	import type { LayoutServerData } from './$types';
	import Notifications from '$lib/components/Notification/Notifications.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';
	import FirstLoginModeModal from '$lib/components/Mode/FirstLoginModeModal.svelte';
	import SplashScreen from '$lib/components/SplashScreen.svelte';

	export let data: LayoutServerData;
	$: showModeModal =
		!!$page.data?.user &&
		$page.data.user.mode === null &&
		$page.url.pathname !== '/login';
	settings.set(data.settings);
</script>

<!-- {#if data.isApplicationSetUp} -->
<I18n />
<div class="app min-h-screen">
	{#if $page.url.pathname !== '/login'}
		<Navbar />
	{/if}
	<main class="pt-safe pb-safe">
		<slot />
	</main>
	{#key $page.url.pathname}
		<DynamicModal />
	{/key}
	<Notifications />
	<PullToRefresh />
	<UpdateChecker />
	{#if $page.url.pathname !== '/login'}
		<InstallPrompt />
	{/if}
	<FirstLoginModeModal visible={showModeModal} />
	<SplashScreen />
</div>
<!-- {:else} -->
<!-- <SetupRequired missingEnvironmentVariables={data.missingEnvironmentVariables} /> -->
<!-- {/if} -->
