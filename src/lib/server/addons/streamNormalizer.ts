import crypto from 'node:crypto';
import type {
	AudioCodec,
	NormalizedStream,
	Quality,
	RawStremioStream,
	VideoCodec
} from './types';

const QUALITY_PATTERNS: Array<[RegExp, Quality]> = [
	[/\b(2160p|4k|uhd)\b/i, '4k'],
	[/\b1080p\b/i, '1080p'],
	[/\b720p\b/i, '720p'],
	[/\b480p\b/i, '480p']
];
const HDR_PATTERN = /\b(hdr10?\+?|dolby\s*vision|\bdv\b|hdr)\b/i;
const SIZE_PATTERN = /(\d+(?:\.\d+)?)\s*(gb|mb)\b/i;
const SEEDERS_PATTERN = /(?:👤|seeders?:?\s*)\s*(\d+)/i;

// Audio codec patterns — order matters (check container codecs before atmos alias)
const AUDIO_CODEC_PATTERNS: Array<[RegExp, AudioCodec]> = [
	[/\btruehd\b/i, 'truehd'],
	[/\batmos\b/i, 'atmos'],
	[/\b(dts-?hd|dts-?x|dts)\b/i, 'dts'],
	[/\b(e-?ac-?3|eac3|ddp|dd\+|dolby\s*digital\s*plus)/i, 'eac3'],
	[/\b(ac-?3|ac3|dolby\s*digital)/i, 'ac3'],
	[/\bflac\b/i, 'flac'],
	[/\bopus\b/i, 'opus'],
	[/\bmp3\b/i, 'mp3'],
	[/\baac\b/i, 'aac']
];

const VIDEO_CODEC_PATTERNS: Array<[RegExp, VideoCodec]> = [
	[/\b(h\.?265|hevc|x265)\b/i, 'h265'],
	[/\bav1\b/i, 'av1'],
	[/\bvp9\b/i, 'vp9'],
	[/\b(h\.?264|avc|x264)\b/i, 'h264']
];

// Browsers (Chrome/Edge) reliably play h264+aac and h264+opus.
// AC3/E-AC3/DTS/TrueHD audio decoders are not part of the baseline web codec set,
// so we flag those streams so users know their audio will be silent.
function isBrowserPlayable(video: VideoCodec, audio: AudioCodec, hdr: boolean): boolean {
	if (hdr) return false; // HDR10/DV almost always means HEVC Main10 — browsers won't decode
	if (video !== 'h264' && video !== 'unknown') return false;
	return audio === 'aac' || audio === 'opus' || audio === 'mp3' || audio === 'unknown';
}

function detectAudioCodec(text: string): AudioCodec {
	for (const [re, c] of AUDIO_CODEC_PATTERNS) if (re.test(text)) return c;
	return 'unknown';
}

function detectVideoCodec(text: string): VideoCodec {
	for (const [re, c] of VIDEO_CODEC_PATTERNS) if (re.test(text)) return c;
	return 'unknown';
}

function haystack(raw: RawStremioStream): string {
	return `${raw.name ?? ''}\n${raw.title ?? ''}`;
}

function detectQuality(text: string): Quality {
	for (const [re, q] of QUALITY_PATTERNS) {
		if (re.test(text)) return q;
	}
	return 'unknown';
}

function parseSize(text: string): number | null {
	const m = text.match(SIZE_PATTERN);
	if (!m) return null;
	const value = parseFloat(m[1]);
	const unit = m[2].toLowerCase();
	const mult = unit === 'gb' ? 1024 * 1024 * 1024 : 1024 * 1024;
	return Math.round(value * mult);
}

function parseSeeders(text: string): number | null {
	const m = text.match(SEEDERS_PATTERN);
	return m ? parseInt(m[1], 10) : null;
}

function hashId(url: string): string {
	return crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
}

export function normalizeStream(
	raw: RawStremioStream,
	source: string
): NormalizedStream | null {
	if (!raw.url || typeof raw.url !== 'string') return null;
	const text = haystack(raw);
	const hintedSize = raw.behaviorHints?.videoSize;
	const hdr = HDR_PATTERN.test(text);
	const audioCodec = detectAudioCodec(text);
	const videoCodec = detectVideoCodec(text);
	return {
		id: hashId(raw.url),
		url: raw.url,
		quality: detectQuality(text),
		hdr,
		title: (raw.title ?? raw.name ?? 'Stream').toString(),
		size: typeof hintedSize === 'number' ? hintedSize : parseSize(text),
		seeders: parseSeeders(text),
		source,
		audioCodec,
		videoCodec,
		browserPlayable: isBrowserPlayable(videoCodec, audioCodec, hdr)
	};
}
