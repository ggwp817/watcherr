export type Quality = '4k' | '1080p' | '720p' | '480p' | 'unknown';

export type AudioCodec =
	| 'aac'
	| 'opus'
	| 'mp3'
	| 'flac'
	| 'ac3'
	| 'eac3'
	| 'dts'
	| 'truehd'
	| 'atmos'
	| 'unknown';

export type VideoCodec = 'h264' | 'h265' | 'av1' | 'vp9' | 'unknown';

export interface NormalizedStream {
	id: string;
	url: string;
	quality: Quality;
	hdr: boolean;
	title: string;
	size: number | null;
	seeders: number | null;
	source: string;
	audioCodec: AudioCodec;
	videoCodec: VideoCodec;
	browserPlayable: boolean;
	proxyUrl?: string;
}

export interface NormalizedSubtitle {
	id: string;
	url: string;
	lang: string;
	label: string;
	source: string;
}

export interface AddonError {
	addon: string;
	error: string;
}

export interface RawStremioStream {
	name?: string;
	title?: string;
	url?: string;
	infoHash?: string;
	behaviorHints?: {
		bingeGroup?: string;
		videoSize?: number;
		notWebReady?: boolean;
	};
	[key: string]: unknown;
}

export interface RawStremioSubtitle {
	id?: string;
	url?: string;
	lang?: string;
	[key: string]: unknown;
}
