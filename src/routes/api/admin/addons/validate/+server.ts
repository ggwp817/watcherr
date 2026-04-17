import { json, type RequestHandler } from '@sveltejs/kit';
import { fetchAndValidateManifest } from '$lib/server/addons/manifestClient';

export const POST: RequestHandler = async (event) => {
	const caller = event.locals.user;
	if (!caller) return json({ error: 'Unauthenticated' }, { status: 401 });
	if (!caller.isAdmin) return json({ error: 'Admin only' }, { status: 403 });

	const body = (await event.request.json().catch(() => null)) as
		| { manifestUrl?: string }
		| null;
	if (!body?.manifestUrl) {
		return json({ error: 'manifestUrl required' }, { status: 400 });
	}

	try {
		const manifest = await fetchAndValidateManifest(body.manifestUrl);
		return json({ ok: true, manifest });
	} catch (err) {
		return json(
			{ ok: false, error: err instanceof Error ? err.message : 'Invalid manifest' },
			{ status: 400 }
		);
	}
};
