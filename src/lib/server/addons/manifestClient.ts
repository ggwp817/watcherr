export interface StremioManifest {
	id: string;
	name: string;
	description?: string;
	logo?: string;
	version?: string;
	resources: string[];
	types: string[];
	idPrefixes?: string[];
	catalogs?: unknown[];
	[key: string]: unknown;
}

const MANIFEST_SUFFIX = '/manifest.json';
const FETCH_TIMEOUT_MS = 8_000;

export function deriveBaseUrl(manifestUrl: string): string {
	if (!manifestUrl.endsWith(MANIFEST_SUFFIX)) {
		throw new Error(
			`Manifest URL must end with ${MANIFEST_SUFFIX}: ${manifestUrl}`
		);
	}
	return manifestUrl.slice(0, -MANIFEST_SUFFIX.length);
}

export async function fetchAndValidateManifest(
	manifestUrl: string
): Promise<StremioManifest> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	let res: Response;
	try {
		res = await fetch(manifestUrl, { signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}

	if (!res.ok) {
		throw new Error(`Manifest fetch failed: HTTP ${res.status}`);
	}

	const raw = (await res.json()) as Record<string, unknown>;

	if (typeof raw.id !== 'string' || raw.id.length === 0) {
		throw new Error('Manifest missing required field: id');
	}
	if (typeof raw.name !== 'string' || raw.name.length === 0) {
		throw new Error('Manifest missing required field: name');
	}
	if (!Array.isArray(raw.resources) || raw.resources.length === 0) {
		throw new Error('Manifest missing required field: resources');
	}
	if (!Array.isArray(raw.types) || raw.types.length === 0) {
		throw new Error('Manifest missing required field: types');
	}

	const resources: string[] = (raw.resources as unknown[]).map((r) => {
		if (typeof r === 'string') return r;
		if (r && typeof r === 'object' && typeof (r as any).name === 'string') {
			return (r as any).name as string;
		}
		throw new Error('Invalid manifest resource entry');
	});

	return {
		...(raw as Record<string, unknown>),
		id: raw.id as string,
		name: raw.name as string,
		resources,
		types: raw.types as string[]
	} as StremioManifest;
}
