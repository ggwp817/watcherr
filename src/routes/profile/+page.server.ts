import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { User } from '$lib/entities/User';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	const user = await User.findOne({ where: { id: locals.user.id } });
	return {
		username: user?.username ?? '',
		jellyfinUserId: user?.jellyfinUserId ?? null
	};
};
