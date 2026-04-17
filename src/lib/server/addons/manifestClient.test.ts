import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { fetchAndValidateManifest, deriveBaseUrl } from './manifestClient';

describe('deriveBaseUrl', () => {
	it('strips /manifest.json from the end', () => {
		expect(deriveBaseUrl('https://torrentio.strem.fun/rd=xyz/manifest.json'))
			.toBe('https://torrentio.strem.fun/rd=xyz');
	});

	it('throws on url without /manifest.json', () => {
		expect(() => deriveBaseUrl('https://example.com/something'))
			.toThrow();
	});
});

describe('fetchAndValidateManifest', () => {
	beforeEach(() => fetchMock.mockReset());

	it('returns parsed manifest when valid', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				id: 'com.torrentio',
				name: 'Torrentio',
				version: '1.0.0',
				resources: ['stream'],
				types: ['movie', 'series']
			})
		} as unknown as Response);
		const m = await fetchAndValidateManifest('https://x.com/manifest.json');
		expect(m.name).toBe('Torrentio');
		expect(m.resources).toEqual(['stream']);
	});

	it('normalizes resources that are objects with a name field', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				id: 'x',
				name: 'X',
				resources: [
					'catalog',
					{ name: 'stream', types: ['movie'] },
					{ name: 'subtitles' }
				],
				types: ['movie']
			})
		} as unknown as Response);
		const m = await fetchAndValidateManifest('https://x.com/manifest.json');
		expect(m.resources).toEqual(['catalog', 'stream', 'subtitles']);
	});

	it('throws on non-ok HTTP', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
		await expect(fetchAndValidateManifest('https://x.com/manifest.json'))
			.rejects.toThrow(/HTTP 404/);
	});

	it('throws when required fields are missing', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({ id: 'x' })
		} as unknown as Response);
		await expect(fetchAndValidateManifest('https://x.com/manifest.json'))
			.rejects.toThrow(/missing/i);
	});

	it('rejects manifest missing types array', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({ id: 'x', name: 'X', resources: ['stream'] })
		} as unknown as Response);
		await expect(fetchAndValidateManifest('https://x.com/manifest.json'))
			.rejects.toThrow(/types/);
	});
});
