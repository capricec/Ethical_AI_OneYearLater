import { MODEL_ORDER } from '$lib/viz/modelColors.js';

export const INTRO_TOOL_DEEP_LINK_KEY = 'ethical-ai:intro-tool-debate';

/** @returns {[string, string]} */
export function pickTwoRandomModels() {
	const pool = [...MODEL_ORDER];
	if (pool.length < 2) return [pool[0] ?? 'ChatGPT', pool[1] ?? 'Claude'];
	const i0 = Math.floor(Math.random() * pool.length);
	let i1 = Math.floor(Math.random() * (pool.length - 1));
	if (i1 >= i0) i1 += 1;
	return [pool[i0], pool[i1]];
}

/**
 * Queue debate + two random models for the tool page to consume on mount.
 * @param {string} debateId
 */
export function queueIntroToolDeepLink(debateId) {
	const id = String(debateId ?? '').trim();
	if (!id) return;
	const models = pickTwoRandomModels();
	sessionStorage.setItem(
		INTRO_TOOL_DEEP_LINK_KEY,
		JSON.stringify({ debateId: id, models })
	);
}

/** @returns {{ debateId: string, models: string[] } | null} */
export function consumeIntroToolDeepLink() {
	const raw = sessionStorage.getItem(INTRO_TOOL_DEEP_LINK_KEY);
	if (!raw) return null;
	sessionStorage.removeItem(INTRO_TOOL_DEEP_LINK_KEY);
	try {
		const parsed = JSON.parse(raw);
		const debateId = String(parsed?.debateId ?? '').trim();
		const models = Array.isArray(parsed?.models)
			? parsed.models.map((m) => String(m ?? '').trim()).filter(Boolean)
			: [];
		if (!debateId || models.length !== 2) return null;
		return { debateId, models };
	} catch {
		return null;
	}
}
