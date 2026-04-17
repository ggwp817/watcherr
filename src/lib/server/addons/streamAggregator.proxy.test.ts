import { describe, it, expect, beforeAll } from 'vitest';
import type { NormalizedStream } from './types';
import { attachProxyUrls } from './streamAggregator';

beforeAll(() => {
	process.env.TRANSCODE_HMAC_SECRET = 'a'.repeat(32);
});

function makeStream(over: Partial<NormalizedStream>): NormalizedStream {
	return {
		id: 'x',
		url: 'https://fjr1-4.download.real-debrid.com/d/ABC/file.mkv',
		quality: '1080p',
		hdr: false,
		title: 't',
		size: 1_000_000_000,
		seeders: 10,
		source: 'Torrentio',
		audioCodec: 'aac',
		videoCodec: 'h264',
		browserPlayable: true,
		...over
	};
}

describe('attachProxyUrls', () => {
	it('attaches proxyUrl to h264 + non-playable-audio + non-hdr', async () => {
		const input = [
			makeStream({
				id: 'a',
				audioCodec: 'ac3',
				browserPlayable: false
			})
		];
		const out = await attachProxyUrls(input);
		expect(out[0].proxyUrl).toBeDefined();
		expect(out[0].proxyUrl).toMatch(/^\/api\/stream\/transcode\//);
	});

	it('does not attach proxyUrl to already-playable streams', async () => {
		const input = [makeStream({ id: 'a' })];
		const out = await attachProxyUrls(input);
		expect(out[0].proxyUrl).toBeUndefined();
	});

	it('does not attach proxyUrl to HEVC streams', async () => {
		const input = [
			makeStream({
				id: 'a',
				videoCodec: 'h265',
				audioCodec: 'dts',
				browserPlayable: false
			})
		];
		const out = await attachProxyUrls(input);
		expect(out[0].proxyUrl).toBeUndefined();
	});

	it('does not attach proxyUrl to HDR streams', async () => {
		const input = [
			makeStream({
				id: 'a',
				hdr: true,
				audioCodec: 'ac3',
				browserPlayable: false
			})
		];
		const out = await attachProxyUrls(input);
		expect(out[0].proxyUrl).toBeUndefined();
	});

	it('skips streams with non-allowlisted upstream hosts', async () => {
		const input = [
			makeStream({
				id: 'a',
				url: 'https://evil.example.com/file.mkv',
				audioCodec: 'ac3',
				browserPlayable: false
			})
		];
		const out = await attachProxyUrls(input);
		expect(out[0].proxyUrl).toBeUndefined();
	});
});
