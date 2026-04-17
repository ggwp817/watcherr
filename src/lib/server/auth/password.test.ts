import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
	it('hashPassword returns a bcrypt hash starting with $2', async () => {
		const hash = await hashPassword('secret');
		expect(hash.startsWith('$2')).toBe(true);
		expect(hash.length).toBe(60);
	});

	it('verifyPassword accepts the correct password', async () => {
		const hash = await hashPassword('secret');
		expect(await verifyPassword('secret', hash)).toBe(true);
	});

	it('verifyPassword rejects the wrong password', async () => {
		const hash = await hashPassword('secret');
		expect(await verifyPassword('nope', hash)).toBe(false);
	});

	it('verifyPassword returns false on malformed hash (does not throw)', async () => {
		expect(await verifyPassword('secret', 'not-a-hash')).toBe(false);
	});
});
