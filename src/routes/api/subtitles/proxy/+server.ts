import { error, type RequestHandler } from '@sveltejs/kit';
import { verifySubtitleToken } from '$lib/server/addons/subtitleToken';

const FETCH_TIMEOUT_MS = 8_000;

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'Unauthenticated');

	const token = event.url.searchParams.get('token');
	if (!token) throw error(400, 'token required');

	const payload = await verifySubtitleToken(token);
	if (!payload) throw error(400, 'Invalid or expired token');

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const upstream = await fetch(payload.upstreamUrl, { signal: controller.signal });
		if (!upstream.ok) throw error(upstream.status as 400, `Upstream ${upstream.status}`);

		const body = await upstream.arrayBuffer();
		const upstreamCt = upstream.headers.get('content-type') ?? '';
		const contentType = upstreamCt.includes('vtt')
			? 'text/vtt; charset=utf-8'
			: 'application/x-subrip; charset=utf-8';

		return new Response(body, {
			status: 200,
			headers: {
				'content-type': contentType,
				'access-control-allow-origin': '*',
				'cache-control': 'private, max-age=3600'
			}
		});
	} finally {
		clearTimeout(timer);
	}
};
