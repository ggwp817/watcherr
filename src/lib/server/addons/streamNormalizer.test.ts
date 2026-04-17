import { describe, it, expect } from 'vitest';
import { normalizeStream } from './streamNormalizer';

const SOURCE = 'Torrentio';

describe('normalizeStream', () => {
	it('detects 4k + HDR + size + seeders from Torrentio-style fields', () => {
		const raw = {
			name: 'Torrentio\n4k HDR',
			title: 'Dune.Part.Two.2024.2160p.DV.HDR.WEB-DL\n14.2 GB 👤 1203',
			url: 'https://real-debrid.com/d/aaa'
		};
		const s = normalizeStream(raw, SOURCE)!;
		expect(s.quality).toBe('4k');
		expect(s.hdr).toBe(true);
		expect(s.size).toBe(Math.round(14.2 * 1024 * 1024 * 1024));
		expect(s.seeders).toBe(1203);
		expect(s.source).toBe(SOURCE);
		expect(s.url).toBe(raw.url);
	});

	it('detects 1080p, no HDR, size in MB', () => {
		const raw = {
			name: '1080p',
			title: 'Foo.2024.1080p.WEB-DL\n850 MB 👤 42',
			url: 'https://host/a'
		};
		const s = normalizeStream(raw, SOURCE)!;
		expect(s.quality).toBe('1080p');
		expect(s.hdr).toBe(false);
		expect(s.size).toBe(850 * 1024 * 1024);
		expect(s.seeders).toBe(42);
	});

	it('falls back to unknown quality when nothing matches', () => {
		const raw = { title: 'Mystery release', url: 'https://host/z' };
		const s = normalizeStream(raw, SOURCE)!;
		expect(s.quality).toBe('unknown');
		expect(s.hdr).toBe(false);
		expect(s.size).toBeNull();
		expect(s.seeders).toBeNull();
	});

	it('prefers behaviorHints.videoSize over parsed size', () => {
		const raw = {
			title: '720p\n900 MB',
			url: 'https://host/b',
			behaviorHints: { videoSize: 1_500_000_000 }
		};
		const s = normalizeStream(raw, SOURCE)!;
		expect(s.size).toBe(1_500_000_000);
	});

	it('returns null when no url is present', () => {
		const raw = { title: '1080p', name: 'no url' };
		expect(normalizeStream(raw, SOURCE)).toBeNull();
	});

	it('produces a stable id based on url', () => {
		const a = normalizeStream({ url: 'https://x/1', title: 't' }, SOURCE)!;
		const b = normalizeStream({ url: 'https://x/1', title: 't' }, SOURCE)!;
		expect(a.id).toBe(b.id);
	});

	it('detects Dolby Vision tag as HDR', () => {
		const raw = { title: 'Movie.2160p.DV.WEB-DL', url: 'https://x' };
		expect(normalizeStream(raw, SOURCE)!.hdr).toBe(true);
	});

	it('marks H.264 + AAC streams as browser-playable', () => {
		const raw = { title: 'Movie.1080p.WEB-DL.H264.AAC', url: 'https://x' };
		const s = normalizeStream(raw, SOURCE)!;
		expect(s.videoCodec).toBe('h264');
		expect(s.audioCodec).toBe('aac');
		expect(s.browserPlayable).toBe(true);
	});

	it('flags H.264 + AC3 streams as not browser-playable (silent audio)', () => {
		const raw = { title: 'Movie.1080p.BluRay.x264.AC3', url: 'https://x' };
		const s = normalizeStream(raw, SOURCE)!;
		expect(s.videoCodec).toBe('h264');
		expect(s.audioCodec).toBe('ac3');
		expect(s.browserPlayable).toBe(false);
	});

	it('flags HEVC streams as not browser-playable', () => {
		const raw = { title: 'Movie.2160p.UHD.x265.DTS-HD', url: 'https://x' };
		const s = normalizeStream(raw, SOURCE)!;
		expect(s.videoCodec).toBe('h265');
		expect(s.audioCodec).toBe('dts');
		expect(s.browserPlayable).toBe(false);
	});

	it('flags HDR streams as not browser-playable even with H.264 + AAC', () => {
		const raw = { title: 'Movie.2160p.HDR10.AAC', url: 'https://x' };
		expect(normalizeStream(raw, SOURCE)!.browserPlayable).toBe(false);
	});

	it('detects E-AC3/DDP as eac3', () => {
		expect(normalizeStream({ title: 'Movie.DDP5.1', url: 'https://x' }, SOURCE)!.audioCodec).toBe(
			'eac3'
		);
		expect(
			normalizeStream({ title: 'Movie.E-AC-3', url: 'https://x' }, SOURCE)!.audioCodec
		).toBe('eac3');
	});

	it('detects TrueHD and Atmos', () => {
		expect(
			normalizeStream({ title: 'Movie.TrueHD.7.1', url: 'https://x' }, SOURCE)!.audioCodec
		).toBe('truehd');
		expect(
			normalizeStream({ title: 'Movie.Atmos.TrueHD', url: 'https://x' }, SOURCE)!.audioCodec
		).toBe('truehd');
	});
});
