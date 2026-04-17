import { settings } from '$lib/stores/settings.store';
import { get } from 'svelte/store';

export function getBazarrBaseUrl(): string {
	const s = get(settings);
	return s.bazarr?.baseUrl || (import.meta.env.VITE_BAZARR_BASE_URL as string | undefined) || '';
}

export function getBazarrApiKey(): string {
	const s = get(settings);
	return s.bazarr?.apiKey || (import.meta.env.VITE_BAZARR_API_KEY as string | undefined) || '';
}
