import { settings } from '$lib/stores/settings.store';
import { get } from 'svelte/store';

export function getStremioAddonUrl(): string {
	const s = get(settings);
	return s.stremio?.addonUrl || (import.meta.env.VITE_STREMIO_ADDON_URL as string | undefined) || '';
}
