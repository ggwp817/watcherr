import { Settings } from '$lib/entities/Settings';

export type JellyfinUser = {
	Id: string;
	Name: string;
	PrimaryImageTag?: string;
	Policy?: { IsAdministrator?: boolean; IsDisabled?: boolean };
};

async function jellyfinConfig(): Promise<{ baseUrl: string; apiKey: string } | null> {
	const s = await Settings.get();
	if (!s.jellyfin.baseUrl || !s.jellyfin.apiKey) return null;
	return { baseUrl: s.jellyfin.baseUrl.replace(/\/$/, ''), apiKey: s.jellyfin.apiKey };
}

export async function listJellyfinUsers(): Promise<JellyfinUser[]> {
	const cfg = await jellyfinConfig();
	if (!cfg) return [];
	const r = await fetch(`${cfg.baseUrl}/Users`, {
		headers: { 'X-Emby-Token': cfg.apiKey }
	});
	if (!r.ok) return [];
	return (await r.json()) as JellyfinUser[];
}

export async function setJellyfinPassword(jellyfinUserId: string, newPassword: string): Promise<boolean> {
	const cfg = await jellyfinConfig();
	if (!cfg) return false;
	const r = await fetch(`${cfg.baseUrl}/Users/${encodeURIComponent(jellyfinUserId)}/Password`, {
		method: 'POST',
		headers: {
			'X-Emby-Token': cfg.apiKey,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ NewPw: newPassword, ResetPassword: false })
	});
	return r.ok || r.status === 204;
}
