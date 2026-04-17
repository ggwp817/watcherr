import { User } from '$lib/entities/User';
import { hashPassword } from './password';

const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USER ?? 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASS ?? 'changeme123';

export async function ensureAdminSeeded(): Promise<void> {
	const adminCount = await User.count({ where: { isAdmin: true } });
	if (adminCount > 0) return;

	const hash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
	const admin = new User();
	admin.username = DEFAULT_ADMIN_USERNAME;
	admin.passwordHash = hash;
	admin.isAdmin = true;
	admin.tokenVersion = 0;
	admin.lastLoginAt = null;
	admin.jellyfinUserId = null;
	admin.jellyfinAuthToken = null;
	admin.preferences = null;
	await admin.save();

	console.info('[watcherr] seeded default admin user:', DEFAULT_ADMIN_USERNAME);
}
