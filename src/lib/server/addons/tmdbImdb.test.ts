import { describe, it, expect, vi, beforeEach } from 'vitest';

const findOne = vi.fn();
const save = vi.fn();

vi.mock('$lib/entities/TmdbImdbMap', () => {
	class TmdbImdbMap {
		tmdbId!: number;
		type!: 'movie' | 'series';
		imdbId!: string | null;
		static findOne = findOne;
		save = save;
	}
	return { TmdbImdbMap };
});

vi.mock('$lib/entities/Settings', () => ({
	Settings: { get: vi.fn(async () => ({ tmdb: { apiKey: 'TEST_KEY' } })) }
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { resolveImdbId } from './tmdbImdb';

describe('resolveImdbId', () => {
	beforeEach(() => {
		findOne.mockReset();
		save.mockReset();
		fetchMock.mockReset();
	});

	it('returns cached positive hit without hitting TMDB', async () => {
		findOne.mockResolvedValue({ tmdbId: 1, type: 'movie', imdbId: 'tt0001' });
		const r = await resolveImdbId(1, 'movie');
		expect(r).toBe('tt0001');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('returns cached negative hit (null) without hitting TMDB', async () => {
		findOne.mockResolvedValue({ tmdbId: 2, type: 'movie', imdbId: null });
		const r = await resolveImdbId(2, 'movie');
		expect(r).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('fetches from TMDB and caches positive result', async () => {
		findOne.mockResolvedValue(null);
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({ imdb_id: 'tt4242' })
		} as unknown as Response);
		const r = await resolveImdbId(3, 'movie');
		expect(r).toBe('tt4242');
		expect(save).toHaveBeenCalled();
	});

	it('caches negative result when TMDB returns no imdb_id', async () => {
		findOne.mockResolvedValue(null);
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({ imdb_id: null })
		} as unknown as Response);
		const r = await resolveImdbId(4, 'series');
		expect(r).toBeNull();
		expect(save).toHaveBeenCalled();
	});

	it('returns null on TMDB error without caching', async () => {
		findOne.mockResolvedValue(null);
		fetchMock.mockResolvedValue({ ok: false, status: 500 } as unknown as Response);
		const r = await resolveImdbId(5, 'movie');
		expect(r).toBeNull();
		expect(save).not.toHaveBeenCalled();
	});

	it('uses /tv/ path for series', async () => {
		findOne.mockResolvedValue(null);
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({ imdb_id: 'tt0944947' })
		} as unknown as Response);
		await resolveImdbId(6, 'series');
		const url = fetchMock.mock.calls[0][0] as string;
		expect(url).toContain('/tv/6/external_ids');
	});
});
