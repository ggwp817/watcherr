import type { PageServerLoad } from './$types';
import { LoginEvent } from '$lib/entities/LoginEvent';

export const load: PageServerLoad = async () => {
	const rows = await LoginEvent.find({ order: { createdAt: 'DESC' }, take: 50 });
	return {
		events: rows.map((r) => ({
			id: r.id,
			username: r.username,
			ip: r.ip,
			success: r.success,
			createdAt: r.createdAt.toISOString()
		}))
	};
};
