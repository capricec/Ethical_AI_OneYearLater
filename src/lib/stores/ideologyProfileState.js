import { writable, derived, get } from 'svelte/store';
import { encoding, archetypeResponseMatrix } from '$lib/data/dataset.js';
import { rankArchetypes } from '$lib/data/archetypeSimilarity.js';
import { selectedModel, setSelectedModel, setSelectedModels } from '$lib/stores/universalState.js';
import { MODEL_ORDER } from '$lib/viz/modelColors.js';
import statementModelAveragesRaw from '../../../data/statement_model_averages.json';

const CUSTOM_IDEOLOGY_STORAGE_KEY = 'ethical-ai-custom-ideology';

/** @type {import('$lib/data/archetypeSimilarity.js').ArchetypeRankingRow[]} */
const EMPTY_RANKINGS = [];

const averagesRows = Array.isArray(statementModelAveragesRaw?.rows)
	? statementModelAveragesRaw.rows
	: [];

/** Survey-space slider values keyed by item_id. */
export const customIdeologyResponses = writable(
	/** @type {Record<string, number> | null} */ (loadCustomFromSession()?.responses ?? null)
);

/** When false, custom responses are kept for the builder but hidden from the ranking list. */
export const customIdeologyInRanking = writable(loadCustomFromSession()?.inRanking ?? false);

export const ideologyBuilderOpen = writable(false);

export const rankedArchetypes = derived(
	[selectedModel, customIdeologyResponses, customIdeologyInRanking],
	([$model, $custom, $customInRanking]) => {
		const model = String($model ?? '').trim();
		if (!model) return EMPTY_RANKINGS;
		return rankArchetypes({
			matrix: archetypeResponseMatrix,
			encoding,
			averagesRows,
			model,
			customSurveyResponses: $customInRanking ? $custom : null
		});
	}
);

/** @returns {{ responses: Record<string, number> | null, inRanking: boolean } | null} */
function loadCustomFromSession() {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(CUSTOM_IDEOLOGY_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed?.responses || typeof parsed.responses !== 'object') return null;
		return {
			responses: parsed.responses,
			inRanking: parsed.in_ranking !== false
		};
	} catch {
		return null;
	}
}

/** @param {Record<string, number> | null} responses @param {boolean} inRanking */
function persistCustomToSession(responses, inRanking) {
	if (typeof sessionStorage === 'undefined') return;
	try {
		if (!responses || !Object.keys(responses).length) {
			sessionStorage.removeItem(CUSTOM_IDEOLOGY_STORAGE_KEY);
			return;
		}
		sessionStorage.setItem(
			CUSTOM_IDEOLOGY_STORAGE_KEY,
			JSON.stringify({
				responses,
				in_ranking: inRanking,
				updated_at: new Date().toISOString()
			})
		);
	} catch {
		/* ignore quota / private mode */
	}
}

/** @param {Record<string, number> | null} responses @param {boolean} [inRanking] */
export function setCustomIdeologyResponses(responses, inRanking = true) {
	const next =
		responses && typeof responses === 'object' && Object.keys(responses).length
			? { ...responses }
			: null;
	customIdeologyResponses.set(next);
	customIdeologyInRanking.set(Boolean(next && inRanking));
	persistCustomToSession(next, Boolean(next && inRanking));
}

export function hideCustomIdeologyFromRanking() {
	if (!get(customIdeologyResponses)) return;
	customIdeologyInRanking.set(false);
	persistCustomToSession(get(customIdeologyResponses), false);
}

export function clearCustomIdeology() {
	customIdeologyResponses.set(null);
	customIdeologyInRanking.set(false);
	persistCustomToSession(null, false);
}

export function openIdeologyBuilder() {
	ideologyBuilderOpen.set(true);
}

export function closeIdeologyBuilder() {
	ideologyBuilderOpen.set(false);
}

/** Ensure a single model is selected for ideology profile views. */
export function ensureIdeologyModelSelected() {
	const available = new Set(
		averagesRows.map((r) => String(r?.fund_model ?? '').trim()).filter(Boolean)
	);
	const ordered = MODEL_ORDER.filter((m) => available.has(m));
	const fallback = ordered[0] ?? MODEL_ORDER[0];
	const current = get(selectedModel);
	if (current && available.has(current)) {
		setSelectedModels([current]);
		return current;
	}
	setSelectedModel(fallback);
	setSelectedModels([fallback]);
	return fallback;
}

/** @param {string} model */
export function selectIdeologyModel(model) {
	const key = String(model ?? '').trim();
	if (!key) return;
	setSelectedModel(key);
	setSelectedModels([key]);
}
