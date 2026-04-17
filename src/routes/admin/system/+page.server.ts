import type { PageServerLoad } from './$types';
import { Settings } from '$lib/entities/Settings';
import { User } from '$lib/entities/User';

export const load: PageServerLoad = async () => {
	const s = await Settings.get();
	const userCount = await User.count();
	return {
		settings: {
			sonarr: s.sonarr,
			radarr: s.radarr,
			jellyfin: s.jellyfin,
			tmdb: s.tmdb,
			bazarr: s.bazarr,
			stremio: s.stremio,
			autoplayTrailers: s.autoplayTrailers,
			language: s.language,
			animationDuration: s.animationDuration,
			discover: s.discover
		},
		userCount
	};
};
