// src/lib/stores/sessionQualityProfile.ts
import { writable } from 'svelte/store';

export type SessionQualityProfile = {
	radarr: number | null;
	sonarr: number | null;
};

export const sessionQualityProfile = writable<SessionQualityProfile>({
	radarr: null,
	sonarr: null
});

export function setRadarrProfile(id: number) {
	sessionQualityProfile.update((s) => ({ ...s, radarr: id }));
}

export function setSonarrProfile(id: number) {
	sessionQualityProfile.update((s) => ({ ...s, sonarr: id }));
}
