import { error, type RequestEvent } from '@sveltejs/kit';

export function requireAdmin(event: RequestEvent): void {
	if (!event.locals.user) throw error(401, 'Unauthorized');
	if (!event.locals.user.isAdmin) throw error(403, 'Forbidden');
}
