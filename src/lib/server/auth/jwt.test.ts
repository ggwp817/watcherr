import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./sessionSecret', () => ({
	getSessionSecret: vi.fn(async () => 'test-secret-test-secret-test-secret')
}));

import { signJwt, verifyJwt } from './jwt';

describe('jwt', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('signs and verifies a valid token', async () => {
		const token = await signJwt({ sub: 'u1', v: 0 });
		const claims = await verifyJwt(token);
		expect(claims?.sub).toBe('u1');
		expect(claims?.v).toBe(0);
	});

	it('rejects tampered tokens', async () => {
		const token = await signJwt({ sub: 'u1', v: 0 });
		const tampered = token.slice(0, -4) + 'xxxx';
		expect(await verifyJwt(tampered)).toBeNull();
	});

	it('rejects empty/garbage tokens without throwing', async () => {
		expect(await verifyJwt('')).toBeNull();
		expect(await verifyJwt('not.a.jwt')).toBeNull();
	});
});
