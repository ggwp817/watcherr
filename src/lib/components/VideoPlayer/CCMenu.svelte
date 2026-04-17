<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SubtitleSizePreset, SubtitleTrack } from './subtitles';

	export let tracks: SubtitleTrack[] = [];
	export let activeTrackId: string | null = null;
	export let size: SubtitleSizePreset = 'M';
	export let fetching = false;
	export let offsetSeconds = 0;

	const SIZES: SubtitleSizePreset[] = ['S', 'M', 'L', 'XL'];

	$: offsetLabel = (() => {
		if (offsetSeconds === 0) return '0.00s';
		const sign = offsetSeconds > 0 ? '+' : '−';
		return sign + Math.abs(offsetSeconds).toFixed(2) + 's';
	})();
	$: hasActiveTrack = activeTrackId !== null;

	const dispatch = createEventDispatcher<{
		pickTrack: { id: string | null };
		pickSize: { size: SubtitleSizePreset };
		bumpOffset: { delta: number };
		resetOffset: void;
		close: void;
	}>();
</script>

<div
	class="menu"
	role="menu"
	tabindex="-1"
	aria-label="Subtitles"
	on:click|stopPropagation
	on:keydown={(e) => e.key === 'Escape' && dispatch('close')}
>
	<div class="header">Subtitles</div>

	<button
		class="row"
		class:active={activeTrackId === null}
		role="menuitemradio"
		aria-checked={activeTrackId === null}
		on:click={() => dispatch('pickTrack', { id: null })}
		type="button"
	>
		<span class="check">{activeTrackId === null ? '✓' : ''}</span>
		<span class="label">Off</span>
	</button>

	{#each tracks as t (t.id)}
		<button
			class="row"
			class:active={activeTrackId === t.id}
			role="menuitemradio"
			aria-checked={activeTrackId === t.id}
			on:click={() => dispatch('pickTrack', { id: t.id })}
			type="button"
		>
			<span class="check">{activeTrackId === t.id ? '✓' : ''}</span>
			<span class="label">{t.label}</span>
		</button>
	{/each}

	{#if fetching}
		<div class="row searching" aria-live="polite">
			<span class="spinner" aria-hidden="true" />
			<span class="label">Searching Bazarr…</span>
		</div>
	{/if}

	<div class="divider" />

	{#if hasActiveTrack}
		<div class="size-row">
			<div class="size-label">Sync offset</div>
			<div class="offset-row">
				<button
					class="offset-btn"
					type="button"
					aria-label="Subtitles earlier"
					on:click={() => dispatch('bumpOffset', { delta: -0.25 })}
				>
					−
				</button>
				<button
					class="offset-value"
					type="button"
					aria-label="Reset offset"
					title="Tap to reset"
					on:click={() => dispatch('resetOffset')}
				>
					{offsetLabel}
				</button>
				<button
					class="offset-btn"
					type="button"
					aria-label="Subtitles later"
					on:click={() => dispatch('bumpOffset', { delta: 0.25 })}
				>
					+
				</button>
			</div>
			<div class="offset-hint">Positive delays subtitles · negative advances them</div>
		</div>

		<div class="divider" />
	{/if}

	<div class="size-row">
		<div class="size-label">Size</div>
		<div class="size-pills" role="radiogroup" aria-label="Subtitle size">
			{#each SIZES as s}
				<button
					class="pill"
					class:active={size === s}
					role="radio"
					aria-checked={size === s}
					on:click={() => dispatch('pickSize', { size: s })}
					type="button"
				>
					{s}
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.menu {
		min-width: 240px;
		background: rgba(17, 24, 39, 0.98);
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 8px 0;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(8px);
		font-family: inherit;
	}
	.header {
		padding: 8px 14px 6px;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		color: rgba(255, 255, 255, 0.45);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 40px;
		padding: 0 14px;
		background: transparent;
		border: none;
		color: #fff;
		font: inherit;
		font-size: 14px;
		cursor: pointer;
		text-align: left;
	}
	.row:hover:not(.searching) {
		background: rgba(255, 255, 255, 0.06);
	}
	.row.active {
		color: #38bdf8;
	}
	.row .check {
		width: 14px;
		text-align: center;
		color: #38bdf8;
	}
	.row.searching {
		color: rgba(255, 255, 255, 0.6);
		cursor: default;
	}
	.divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.08);
		margin: 6px 0;
	}
	.size-row {
		padding: 6px 14px 10px;
	}
	.size-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		color: rgba(255, 255, 255, 0.45);
		margin-bottom: 6px;
	}
	.size-pills {
		display: flex;
		gap: 4px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 8px;
		padding: 3px;
	}
	.pill {
		flex: 1;
		min-height: 32px;
		background: transparent;
		border: none;
		color: rgba(255, 255, 255, 0.75);
		font: inherit;
		font-size: 12px;
		font-weight: 600;
		border-radius: 6px;
		cursor: pointer;
		transition: background 120ms, color 120ms;
	}
	.pill:hover {
		color: #fff;
	}
	.pill.active {
		background: rgba(56, 189, 248, 0.18);
		color: #38bdf8;
	}
	.offset-row {
		display: flex;
		align-items: center;
		gap: 6px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 8px;
		padding: 3px;
	}
	.offset-btn {
		width: 36px;
		min-height: 32px;
		background: transparent;
		border: none;
		color: rgba(255, 255, 255, 0.85);
		font: inherit;
		font-size: 18px;
		font-weight: 700;
		border-radius: 6px;
		cursor: pointer;
		transition: background 120ms, color 120ms;
	}
	.offset-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: #fff;
	}
	.offset-value {
		flex: 1;
		min-height: 32px;
		background: transparent;
		border: none;
		color: #38bdf8;
		font: inherit;
		font-size: 13px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		border-radius: 6px;
		cursor: pointer;
		transition: background 120ms;
	}
	.offset-value:hover {
		background: rgba(255, 255, 255, 0.05);
	}
	.offset-hint {
		font-size: 10px;
		color: rgba(255, 255, 255, 0.4);
		margin-top: 6px;
		line-height: 1.3;
	}
	.spinner {
		width: 12px;
		height: 12px;
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
