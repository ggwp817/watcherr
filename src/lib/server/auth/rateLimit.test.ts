import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkLoginRateLimit, _resetRateLimit } from './rateLimit';

describe('rateLimit', () => {
	beforeEach(() => _resetRateLimit());

	it('allows first 5 attempts from same IP', () => {
		for (let i = 0; i < 5; i++) {
			expect(checkLoginRateLimit('1.2.3.4')).toBe(true);
		}
	});

	it('blocks the 6th attempt within the window', () => {
		for (let i = 0; i < 5; i++) checkLoginRateLimit('1.2.3.4');
		expect(checkLoginRateLimit('1.2.3.4')).toBe(false);
	});

	it('tracks different IPs independently', () => {
		for (let i = 0; i < 5; i++) checkLoginRateLimit('1.1.1.1');
		expect(checkLoginRateLimit('2.2.2.2')).toBe(true);
	});

	it('forgets attempts older than the window', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
		for (let i = 0; i < 5; i++) checkLoginRateLimit('3.3.3.3');
		vi.setSystemTime(new Date('2026-01-01T00:01:01Z'));
		expect(checkLoginRateLimit('3.3.3.3')).toBe(true);
		vi.useRealTimers();
	});
});
