import { json, type RequestHandler } from '@sveltejs/kit';
import { LoginEvent } from '$lib/entities/LoginEvent';
import { requireAdmin } from '$lib/server/auth/requireAdmin';

export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const limit = Math.min(Number(event.url.searchParams.get('limit') ?? 50), 200);
	const rows = await LoginEvent.find({ order: { createdAt: 'DESC' }, take: limit });
	return json(rows);
};
