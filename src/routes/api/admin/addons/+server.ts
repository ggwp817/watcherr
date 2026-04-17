import { json, type RequestHandler } from '@sveltejs/kit';
import { Addon } from '$lib/entities/Addon';
import {
	deriveBaseUrl,
	fetchAndValidateManifest
} from '$lib/server/addons/manifestClient';

function requireAdmin(event: Parameters<RequestHandler>[0]) {
	const u = event.locals.user;
	if (!u) return json({ error: 'Unauthenticated' }, { status: 401 });
	if (!u.isAdmin) return json({ error: 'Admin only' }, { status: 403 });
	return null;
}

export const GET: RequestHandler = async (event) => {
	const block = requireAdmin(event);
	if (block) return block;
	const addons = await Addon.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
	return json(addons);
};

export const POST: RequestHandler = async (event) => {
	const block = requireAdmin(event);
	if (block) return block;

	const body = (await event.request.json().catch(() => null)) as
		| { manifestUrl?: string }
		| null;
	if (!body?.manifestUrl) {
		return json({ error: 'manifestUrl required' }, { status: 400 });
	}

	const existing = await Addon.findOne({ where: { manifestUrl: body.manifestUrl } });
	if (existing) return json({ error: 'Addon already installed' }, { status: 409 });

	let manifest;
	try {
		manifest = await fetchAndValidateManifest(body.manifestUrl);
	} catch (err) {
		return json(
			{ error: err instanceof Error ? err.message : 'Manifest fetch failed' },
			{ status: 400 }
		);
	}

	const row = new Addon();
	row.name = manifest.name;
	row.manifestUrl = body.manifestUrl;
	row.baseUrl = deriveBaseUrl(body.manifestUrl);
	row.manifest = manifest as unknown as Record<string, unknown>;
	row.resources = manifest.resources;
	row.types = manifest.types;
	row.enabled = true;
	row.sortOrder = (await Addon.count()) * 10;
	row.lastCheckedAt = new Date();
	await row.save();

	return json(row, { status: 201 });
};
