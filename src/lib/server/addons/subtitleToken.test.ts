import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../auth/sessionSecret', () => ({
	getSessionSecret: vi.fn(async () => 'unit-test-secret-unit-test-secret')
}));

import { signSubtitleToken, verifySubtitleToken } from './subtitleToken';

describe('subtitleToken', () => {
	beforeEach(() => vi.clearAllMocks());

	it('round-trips a valid token', async () => {
		const t = await signSubtitleToken('https://example.com/sub.srt', 60);
		const payload = await verifySubtitleToken(t);
		expect(payload?.upstreamUrl).toBe('https://example.com/sub.srt');
	});

	it('rejects an expired token', async () => {
		const t = await signSubtitleToken('https://x.com/s.srt', -5); // already expired
		expect(await verifySubtitleToken(t)).toBeNull();
	});

	it('rejects a tampered token', async () => {
		const t = await signSubtitleToken('https://x.com/s.srt', 60);
		const bad = t.slice(0, -2) + 'AA';
		expect(await verifySubtitleToken(bad)).toBeNull();
	});

	it('rejects garbage', async () => {
		expect(await verifySubtitleToken('not-a-token')).toBeNull();
		expect(await verifySubtitleToken('')).toBeNull();
	});
});
