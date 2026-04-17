// src/lib/stores/requestState.ts
import { writable, derived } from 'svelte/store';

export type RequestKey = string; // 'movie:123' | 'series:456' | 'season:456-2' | 'episode:789'

type State = {
	requesting: Set<RequestKey>;
	failed: Map<RequestKey, string>; // key -> error message
};

function createRequestState() {
	const { subscribe, update } = writable<State>({
		requesting: new Set(),
		failed: new Map()
	});

	return {
		subscribe,
		markRequesting: (key: RequestKey) =>
			update((s) => {
				s.requesting.add(key);
				s.failed.delete(key);
				return { ...s };
			}),
		markDone: (key: RequestKey) =>
			update((s) => {
				s.requesting.delete(key);
				return { ...s };
			}),
		markFailed: (key: RequestKey, reason: string) =>
			update((s) => {
				s.requesting.delete(key);
				s.failed.set(key, reason);
				return { ...s };
			}),
		clearFailed: (key: RequestKey) =>
			update((s) => {
				s.failed.delete(key);
				return { ...s };
			})
	};
}

export const requestState = createRequestState();

export const isRequesting = (key: RequestKey) =>
	derived(requestState, ($s) => $s.requesting.has(key));

export const failedReason = (key: RequestKey) =>
	derived(requestState, ($s) => $s.failed.get(key) ?? null);
