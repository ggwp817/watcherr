import { json, type RequestHandler } from '@sveltejs/kit';
import { Addon } from '$lib/entities/Addon';
import { fetchAndValidateManifest } from '$lib/server/addons/manifestClient';

export const POST: RequestHandler = async (event) => {
	const caller = event.locals.user;
	if (!caller) return json({ error: 'Unauthenticated' }, { status: 401 });
	if (!caller.isAdmin) return json({ error: 'Admin only' }, { status: 403 });

	const id = event.params.id;
	if (!id) return json({ error: 'id required' }, { status: 400 });
	const row = await Addon.findOne({ where: { id } });
	if (!row) return json({ error: 'Not found' }, { status: 404 });

	try {
		const manifest = await fetchAndValidateManifest(row.manifestUrl);
		row.name = manifest.name;
		row.manifest = manifest as unknown as Record<string, unknown>;
		row.resources = manifest.resources;
		row.types = manifest.types;
		row.lastCheckedAt = new Date();
		await row.save();
		return json(row);
	} catch (err) {
		return json(
			{ error: err instanceof Error ? err.message : 'Refresh failed' },
			{ status: 400 }
		);
	}
};
