<script lang="ts">
	import { version } from '$app/environment';
	import { beforeNavigate, goto } from '$app/navigation';
	import FormButton from '$lib/components/forms/FormButton.svelte';
	import { settings, type SettingsValues } from '$lib/stores/settings.store';
	import axios from 'axios';
import { ChevronLeft } from 'radix-icons-svelte';
	import GeneralSettingsPage from './GeneralSettingsPage.svelte';
	import { fade } from 'svelte/transition';
	import { _ } from 'svelte-i18n';

	let values: SettingsValues;
	let initialValues: SettingsValues;
	settings.subscribe(async (v) => {
		values = structuredClone(v);
		initialValues = structuredClone(v);
	});

	let valuesChanged = false;
	$: valuesChanged = JSON.stringify(initialValues) !== JSON.stringify(values);

	let submitLoading = false;
	function handleSubmit() {
		if (submitLoading || !valuesChanged) return;
		submitLoading = true;
		submit().finally(() => (submitLoading = false));
	}

	async function submit() {
		axios.post('/api/settings', values).then(() => {
			settings.set(values);
		});
	}

	beforeNavigate(({ cancel }) => {
		if (valuesChanged) {
			if (!confirm('You have unsaved changes. Are you sure you want to leave?')) cancel();
		}
	});

	function goBack() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			history.back();
		} else {
			goto('/');
		}
	}

	function handleKeybinds(event: KeyboardEvent) {
		if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			handleSubmit();
		}
	}
</script>

<svelte:window on:keydown={handleKeybinds} />

<div
	class="min-h-screen sm:h-screen flex-1 flex flex-col sm:flex-row w-full sm:pt-24"
	in:fade|global={{
		duration: $settings.animationDuration,
		delay: $settings.animationDuration
	}}
	out:fade|global={{ duration: $settings.animationDuration }}
>
	<div
		class="hidden sm:flex flex-col gap-2 border-r border-zinc-800 justify-between w-64 p-8 border-t"
	>
		<div class="flex flex-col gap-2">
			<button
				class="mb-6 text-lg font-medium flex items-center text-zinc-300 hover:text-zinc-200"
				on:click={goBack}
			>
				<ChevronLeft size={22} />
				{$_('settings.navbar.settings')}
			</button>
		</div>
		<div class="flex flex-col gap-2">
			<FormButton
				disabled={!valuesChanged}
				loading={submitLoading}
				on:click={handleSubmit}
				type={valuesChanged ? 'success' : 'base'}
			>
				{$_('settings.misc.saveChanges')}
			</FormButton>
			<FormButton
				disabled={!valuesChanged}
				type="error"
				on:click={() => {
					settings.set(initialValues);
				}}
			>
				{$_('settings.misc.resetToDefaults')}
			</FormButton>
		</div>
	</div>

	<div class="sm:hidden px-8 pt-20 pb-4 flex items-center justify-between">
		<button
			class="text-lg font-medium flex items-center text-zinc-300 hover:text-zinc-200"
			on:click={goBack}
		>
			<ChevronLeft size={22} />
			{$_('settings.navbar.settings')}
		</button>
	</div>

	<div class="flex-1 flex flex-col border-t border-zinc-800 justify-between">
		<div class="overflow-y-scroll overflow-x-hidden px-8">
			<div class="max-w-screen-md mx-auto mb-auto w-full">
				<GeneralSettingsPage bind:values />
			</div>
		</div>
		<div class="flex items-center p-4 gap-8 justify-center text-zinc-500 bg-stone-950">
			<div>Watcherr v{version}</div>
		</div>
	</div>
</div>

<!-- Language settings -->
