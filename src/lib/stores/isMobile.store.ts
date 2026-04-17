import { readable } from 'svelte/store';
import { browser } from '$app/environment';

const MOBILE_BREAKPOINT = '(max-width: 1024px)';

export const isMobile = readable(false, (set) => {
	if (!browser) return;
	const mql = window.matchMedia(MOBILE_BREAKPOINT);
	set(mql.matches);
	const onChange = (e: MediaQueryListEvent) => set(e.matches);
	mql.addEventListener('change', onChange);
	return () => mql.removeEventListener('change', onChange);
});
