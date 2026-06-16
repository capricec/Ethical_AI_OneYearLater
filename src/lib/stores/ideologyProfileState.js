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

const loaded = loadCustomFromSession();

/** Survey-space slider values keyed by item_id. */
export const customIdeologyResponses = writable(
	/** @type {Record<string, number> | null} */ (loaded?.responses ?? null)
);

/** When false, custom responses are kept for the builder but hidden from the ranking list. */
export const customIdeologyInRanking = writable(loaded?.inRanking ?? false);

/** @type {import('svelte/store').Writable<'quiz' | 'refined' | 'builder' | null>} */
export const customIdeologySource = writable(loaded?.source ?? null);

/** @type {import('svelte/store').Writable<Record<string, 'A' | 'B'> | null>} */
export const customIdeologyQuizAnswers = writable(loaded?.quizAnswers ?? null);

export const ideologyBuilderOpen = writable(false);
export const ideologyQuizOpen = writable(false);

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

/**
 * @returns {{
 *   responses: Record<string, number> | null,
 *   inRanking: boolean,
 *   source: ('quiz' | 'refined' | 'builder') | null,
 *   quizAnswers: Record<string, 'A' | 'B'> | null
 * } | null}
 */
function loadCustomFromSession() {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(CUSTOM_IDEOLOGY_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed?.responses || typeof parsed.responses !== 'object') return null;
		const source = parsed.source;
		const validSource =
			source === 'quiz' || source === 'refined' || source === 'builder' ? source : null;
		const quizAnswers =
			parsed.quiz_answers && typeof parsed.quiz_answers === 'object' ? parsed.quiz_answers : null;
		return {
			responses: parsed.responses,
			inRanking: parsed.in_ranking !== false,
			source: validSource,
			quizAnswers
		};
	} catch {
		return null;
	}
}

/**
 * @param {Record<string, number> | null} responses
 * @param {boolean} inRanking
 * @param {('quiz' | 'refined' | 'builder') | null} [source]
 * @param {Record<string, 'A' | 'B'> | null} [quizAnswers]
 */
function persistCustomToSession(responses, inRanking, source = null, quizAnswers = null) {
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
				source: source ?? undefined,
				quiz_answers: quizAnswers ?? undefined,
				updated_at: new Date().toISOString()
			})
		);
	} catch {
		/* ignore quota / private mode */
	}
}

/**
 * @param {Record<string, number> | null} responses
 * @param {boolean} [inRanking]
 * @param {('quiz' | 'refined' | 'builder') | null} [source]
 * @param {Record<string, 'A' | 'B'> | null} [quizAnswers]
 */
export function setCustomIdeologyResponses(
	responses,
	inRanking = true,
	source = 'builder',
	quizAnswers = null
) {
	const next =
		responses && typeof responses === 'object' && Object.keys(responses).length
			? { ...responses }
			: null;
	const nextInRanking = Boolean(next && inRanking);
	const nextSource = next ? source : null;
	const nextQuizAnswers = next ? quizAnswers : null;

	customIdeologyResponses.set(next);
	customIdeologyInRanking.set(nextInRanking);
	customIdeologySource.set(nextSource);
	customIdeologyQuizAnswers.set(nextQuizAnswers);
	persistCustomToSession(next, nextInRanking, nextSource, nextQuizAnswers);
}

/**
 * @param {Record<string, number>} responses
 * @param {Record<string, 'A' | 'B'>} quizAnswers
 */
export function setCustomIdeologyFromQuiz(responses, quizAnswers) {
	setCustomIdeologyResponses(responses, true, 'quiz', { ...quizAnswers });
}

export function clearIdeologyQuizAnswers() {
	customIdeologyQuizAnswers.set(null);
	persistCustomToSession(
		get(customIdeologyResponses),
		get(customIdeologyInRanking),
		get(customIdeologySource),
		null
	);
}

export function hideCustomIdeologyFromRanking() {
	if (!get(customIdeologyResponses)) return;
	customIdeologyInRanking.set(false);
	persistCustomToSession(
		get(customIdeologyResponses),
		false,
		get(customIdeologySource),
		get(customIdeologyQuizAnswers)
	);
}

export function clearCustomIdeology() {
	customIdeologyResponses.set(null);
	customIdeologyInRanking.set(false);
	customIdeologySource.set(null);
	customIdeologyQuizAnswers.set(null);
	persistCustomToSession(null, false);
}

export function openIdeologyBuilder() {
	ideologyBuilderOpen.set(true);
}

export function closeIdeologyBuilder() {
	ideologyBuilderOpen.set(false);
}

export function openIdeologyQuiz() {
	ideologyQuizOpen.set(true);
}

export function closeIdeologyQuiz() {
	ideologyQuizOpen.set(false);
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
