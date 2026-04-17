import type { PageServerLoad } from './$types';
import { User } from '$lib/entities/User';

export const load: PageServerLoad = async () => {
	const users = await User.find({ order: { username: 'ASC' } });
	return {
		users: users.map((u) => ({
			id: u.id,
			username: u.username,
			isAdmin: u.isAdmin,
			jellyfinUserId: u.jellyfinUserId,
			lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null
		}))
	};
};
