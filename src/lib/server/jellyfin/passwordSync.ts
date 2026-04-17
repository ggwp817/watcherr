import { setJellyfinPassword } from './adminClient';

export async function syncJellyfinPassword(jellyfinUserId: string, newPassword: string): Promise<boolean> {
	try {
		return await setJellyfinPassword(jellyfinUserId, newPassword);
	} catch (e) {
		console.warn('[watcherr] jellyfin password sync failed', e);
		return false;
	}
}
