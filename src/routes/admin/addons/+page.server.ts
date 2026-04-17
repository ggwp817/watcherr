import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { Addon } from '$lib/entities/Addon';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user?.isAdmin) throw error(403, 'Admin only');
	const addons = await Addon.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
	return {
		addons: addons.map((a) => ({
			id: a.id,
			name: a.name,
			manifestUrl: a.manifestUrl,
			baseUrl: a.baseUrl,
			resources: a.resources,
			types: a.types,
			enabled: a.enabled,
			sortOrder: a.sortOrder,
			createdAt: a.createdAt.toISOString(),
			lastCheckedAt: a.lastCheckedAt?.toISOString() ?? null,
			logo: (a.manifest as any)?.logo ?? null,
			description: (a.manifest as any)?.description ?? null
		}))
	};
};
