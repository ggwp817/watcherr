export type SubtitleLanguage = 'en' | 'ar';

export type SubtitleSizePreset = 'S' | 'M' | 'L' | 'XL';

export type SubtitleTrack = {
	id: string;
	language: SubtitleLanguage;
	label: string;
	deliveryUrl: string;
	isDefault: boolean;
	isForced: boolean;
};

const EN_CODES = new Set(['en', 'eng', 'english']);
const AR_CODES = new Set(['ar', 'ara', 'arabic']);

const SIZE_PERCENT: Record<SubtitleSizePreset, number> = {
	S: 50,
	M: 70,
	L: 90,
	XL: 120
};

export function normalizeLanguage(code: string | null | undefined): SubtitleLanguage | null {
	if (!code) return null;
	const c = code.toLowerCase();
	if (EN_CODES.has(c)) return 'en';
	if (AR_CODES.has(c)) return 'ar';
	return null;
}

export function buildLabel(
	lang: SubtitleLanguage,
	stream: { DisplayTitle?: string | null; IsForced?: boolean; Title?: string | null }
): string {
	const base = lang === 'ar' ? 'العربية' : 'English';
	const forced = stream.IsForced ? ' (Forced)' : '';
	const sdh = (stream.DisplayTitle ?? stream.Title ?? '').toLowerCase().includes('sdh')
		? ' (SDH)'
		: '';
	return base + sdh + forced;
}

/**
 * Extract EN/AR subtitle tracks from a Jellyfin PlaybackInfo MediaSource.
 */
export function extractEnArSubtitleTracks(
	mediaStreams: Array<{
		Type?: string;
		Index?: number;
		Language?: string | null;
		DisplayTitle?: string | null;
		Title?: string | null;
		IsForced?: boolean;
		IsDefault?: boolean;
		DeliveryUrl?: string | null;
	}>,
	buildUrl: (streamIndex: number) => string
): SubtitleTrack[] {
	const tracks: SubtitleTrack[] = [];
	for (const s of mediaStreams) {
		if (s.Type !== 'Subtitle') continue;
		const lang = normalizeLanguage(s.Language);
		if (!lang) continue;
		if (typeof s.Index !== 'number') continue;
		tracks.push({
			id: String(s.Index),
			language: lang,
			label: buildLabel(lang, s),
			deliveryUrl: s.DeliveryUrl || buildUrl(s.Index),
			isDefault: !!s.IsDefault,
			isForced: !!s.IsForced
		});
	}
	return tracks;
}

export function sizePresetToPercent(preset: SubtitleSizePreset): number {
	return SIZE_PERCENT[preset];
}

const STORAGE_KEY = 'watcherr.subtitleSize';
const OFFSET_KEY_PREFIX = 'watcherr.subtitleOffset.';

export const SUBTITLE_OFFSET_MIN = -10;
export const SUBTITLE_OFFSET_MAX = 10;
export const SUBTITLE_OFFSET_STEP = 0.25;

export function loadSubtitleSize(): SubtitleSizePreset {
	try {
		const v = localStorage.getItem(STORAGE_KEY);
		if (v === 'S' || v === 'M' || v === 'L' || v === 'XL') return v;
	} catch {}
	return 'M';
}

export function saveSubtitleSize(preset: SubtitleSizePreset): void {
	try {
		localStorage.setItem(STORAGE_KEY, preset);
	} catch {}
}

export function loadSubtitleOffset(lang: SubtitleLanguage): number {
	try {
		const v = parseFloat(localStorage.getItem(OFFSET_KEY_PREFIX + lang) ?? '');
		if (Number.isFinite(v)) return Math.max(SUBTITLE_OFFSET_MIN, Math.min(SUBTITLE_OFFSET_MAX, v));
	} catch {}
	return 0;
}

export function saveSubtitleOffset(lang: SubtitleLanguage, value: number): void {
	try {
		localStorage.setItem(OFFSET_KEY_PREFIX + lang, String(value));
	} catch {}
}
