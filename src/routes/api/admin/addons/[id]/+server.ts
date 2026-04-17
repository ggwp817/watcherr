import { json, type RequestHandler } from '@sveltejs/kit';
import { Addon } from '$lib/entities/Addon';

function guard(event: Parameters<RequestHandler>[0]) {
	const u = event.locals.user;
	if (!u) return json({ error: 'Unauthenticated' }, { status: 401 });
	if (!u.isAdmin) return json({ error: 'Admin only' }, { status: 403 });
	return null;
}

export const PATCH: RequestHandler = async (event) => {
	const block = guard(event);
	if (block) return block;

	const id = event.params.id;
	if (!id) return json({ error: 'id required' }, { status: 400 });

	const row = await Addon.findOne({ where: { id } });
	if (!row) return json({ error: 'Not found' }, { status: 404 });

	const body = (await event.request.json().catch(() => null)) as
		| { enabled?: boolean; sortOrder?: number }
		| null;
	if (!body) return json({ error: 'body required' }, { status: 400 });

	if (typeof body.enabled === 'boolean') row.enabled = body.enabled;
	if (typeof body.sortOrder === 'number') row.sortOrder = body.sortOrder;
	await row.save();
	return json(row);
};

export const DELETE: RequestHandler = async (event) => {
	const block = guard(event);
	if (block) return block;

	const id = event.params.id;
	if (!id) return json({ error: 'id required' }, { status: 400 });
	const row = await Addon.findOne({ where: { id } });
	if (!row) return json({ error: 'Not found' }, { status: 404 });
	await row.remove();
	return new Response(null, { status: 204 });
};
