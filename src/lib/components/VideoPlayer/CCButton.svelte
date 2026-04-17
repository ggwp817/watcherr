<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let active = false;
	export let fetching = false;
	export let unavailable = false;

	const dispatch = createEventDispatcher<{ click: void }>();

	$: disabled = unavailable || fetching;
	$: title = unavailable
		? 'No English or Arabic subtitles found'
		: fetching
		? 'Searching subtitles…'
		: active
		? 'Subtitles on'
		: 'Subtitles';
</script>

<button
	class="cc-btn"
	class:active
	class:fetching
	class:unavailable
	{disabled}
	{title}
	aria-label={title}
	on:click={() => dispatch('click')}
	type="button"
>
	{#if fetching}
		<span class="spinner" aria-hidden="true" />
	{:else}
		<span class="cc-label" aria-hidden="true">CC</span>
	{/if}
	{#if active}<span class="dot" aria-hidden="true" />{/if}
</button>

<style>
	.cc-btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		padding: 0 10px;
		background: transparent;
		color: rgba(255, 255, 255, 0.6);
		border: none;
		border-radius: 6px;
		font: inherit;
		cursor: pointer;
		transition: color 150ms ease, background 150ms ease, opacity 150ms ease;
	}
	.cc-btn:hover:not(:disabled) {
		color: #fff;
		background: rgba(255, 255, 255, 0.08);
	}
	.cc-btn.active {
		color: #38bdf8;
	}
	.cc-btn.unavailable {
		opacity: 0.3;
		cursor: not-allowed;
	}
	.cc-btn:disabled {
		cursor: default;
	}
	.cc-label {
		font-weight: 700;
		font-size: 13px;
		letter-spacing: 0.5px;
		border: 1.5px solid currentColor;
		padding: 2px 5px;
		border-radius: 3px;
		line-height: 1;
	}
	.dot {
		position: absolute;
		bottom: 6px;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: #38bdf8;
	}
	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.25);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 700ms linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
