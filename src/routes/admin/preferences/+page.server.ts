import type { PageServerLoad } from './$types';
import { Settings } from '$lib/entities/Settings';

export const load: PageServerLoad = async () => {
	const s = await Settings.get();
	return {
		settings: {
			autoplayTrailers: s.autoplayTrailers,
			language: s.language,
			animationDuration: s.animationDuration,
			discover: s.discover
		}
	};
};
