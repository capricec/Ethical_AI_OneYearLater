import quizMapping from '../../../data/quiz_mapping.json';
import {
	IDEOLOGY_DISCRIMINATING_ITEM_IDS,
	buildCustomDisplayProfile,
	buildItemScaleMeta,
	buildModelDisplayProfile,
	buildIdeologyUnitVector,
	buildIdeologyWeightVector,
	weightedCosineSimilarity,
	completeIdeologySurveyResponses,
	rankModelsByCustomSurveySimilarity,
	displayToSurveyValue,
	roundToNearestStep
} from '$lib/data/archetypeSimilarity.js';
import {
	buildEncodingItemById,
	builderStatementLabelForStatement
} from '$lib/data/fullSurveyQuestion.js';

/** Map quiz signal strength into inner band of each item scale (not full lo–hi). */
const QUIZ_VALUE_FLOOR = 0.2;
const QUIZ_VALUE_CEILING = 0.8;

/**
 * @typedef {'A' | 'B'} QuizChoice
 * @typedef {Record<string, QuizChoice>} QuizAnswers
 * @typedef {{ model: string, similarityPct: number }} QuizModelRankingRow
 * @typedef {{ model: string, similarityPct: number }} QuizModelMatch
 * @typedef {{
 *   id: string,
 *   prompt: string,
 *   userChoiceLabel?: string | null,
 *   agreementPct: number
 * }} IdeologyInsight
 * @typedef {{
 *   completeSurveyResponses: Record<string, number>,
 *   discriminatingSurveyResponses: Record<string, number>,
 *   topMatch: QuizModelMatch,
 *   runnerUp: QuizModelMatch | null,
 *   strongestAgreement: IdeologyInsight[],
 *   strongestDisagreement: IdeologyInsight[]
 * }} QuizResults
 */

/** @returns {string[]} */
export function getQuizSurveyItemIds() {
	const fromMapping = quizMapping?.survey_items;
	if (Array.isArray(fromMapping) && fromMapping.length) {
		return fromMapping.map((id) => String(id).trim()).filter(Boolean);
	}
	return [...IDEOLOGY_DISCRIMINATING_ITEM_IDS];
}

/** @returns {typeof quizMapping.questions} */
export function getQuizQuestions() {
	return Array.isArray(quizMapping?.questions) ? quizMapping.questions : [];
}

/** @returns {{ id: string, label: string, items: string[] }[]} */
export function getQuizIdeologyThemes() {
	const themes = quizMapping?.ideology_themes;
	if (!Array.isArray(themes)) return [];
	return themes
		.map((t) => ({
			id: String(t?.id ?? '').trim(),
			label: String(t?.label ?? '').trim(),
			items: Array.isArray(t?.items)
				? t.items.map((id) => String(id).trim()).filter(Boolean)
				: []
		}))
		.filter((t) => t.id && t.label && t.items.length);
}

/** @param {QuizAnswers | null | undefined} answers */
export function isCompleteQuizAnswers(answers) {
	const questions = getQuizQuestions();
	if (!answers || !questions.length) return false;
	return questions.every((q) => answers[q.id] === 'A' || answers[q.id] === 'B');
}

/**
 * @param {Map<string, number>} profileA
 * @param {Map<string, number>} profileB
 * @param {string} itemId
 * @param {Map<string, import('$lib/data/archetypeSimilarity.js').ItemScaleMeta>} scaleMeta
 */
function itemAgreementPct(profileA, profileB, itemId, scaleMeta) {
	const meta = scaleMeta.get(itemId);
	const a = profileA.get(itemId);
	const b = profileB.get(itemId);
	if (!meta || !Number.isFinite(a) || !Number.isFinite(b)) return null;
	const range = meta.hi - meta.lo;
	if (range <= 0) return null;
	return Math.round(Math.max(0, 1 - Math.abs(a - b) / range) * 100);
}

/**
 * @param {IdeologyInsight[]} insights
 * @returns {{ strongestAgreement: IdeologyInsight[], strongestDisagreement: IdeologyInsight[] }}
 */
function splitTopAgreementDisagreement(insights) {
	const strongestAgreement = insights.slice(0, 2);
	const agreeIds = new Set(strongestAgreement.map((item) => item.id));
	const strongestDisagreement = [...insights]
		.filter((item) => !agreeIds.has(item.id))
		.sort((a, b) => a.agreementPct - b.agreementPct || a.prompt.localeCompare(b.prompt))
		.slice(0, 2);
	return { strongestAgreement, strongestDisagreement };
}

/**
 * @param {string[]} dimensions
 */
function itemIndexByDimension(dimensions) {
	/** @type {Map<string, number>} */
	const map = new Map();
	dimensions.forEach((id, i) => map.set(id, i));
	return map;
}

/**
 * @param {Float64Array | number[]} vec
 */
function l2Normalize(vec) {
	const n = vec.length;
	const out = new Float64Array(n);
	let sumSq = 0;
	for (let i = 0; i < n; i++) sumSq += vec[i] * vec[i];
	const norm = Math.sqrt(sumSq);
	if (norm <= 1e-12) return out;
	for (let i = 0; i < n; i++) out[i] = vec[i] / norm;
	return out;
}

/**
 * Normalized model vector over quiz survey dimensions (display space → [0,1] → L2 unit).
 *
 * @param {string} model
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {Map<string, import('$lib/data/archetypeSimilarity.js').ItemScaleMeta>} scaleMeta
 * @param {string[]} [dimensions]
 */
export function buildModelQuizVector(model, averagesRows, scaleMeta, dimensions = getQuizSurveyItemIds()) {
	const profile = buildModelDisplayProfile(model, averagesRows, scaleMeta);
	return buildIdeologyUnitVector(profile, scaleMeta, dimensions);
}

/**
 * Accumulate quiz choice mappings into a vector, then L2-normalize.
 *
 * @param {QuizAnswers} answers
 * @param {typeof quizMapping} [quiz]
 */
export function buildUserQuizVector(answers, quiz = quizMapping) {
	const dimensions = getQuizSurveyItemIds();
	const indexByItem = itemIndexByDimension(dimensions);
	const raw = new Float64Array(dimensions.length);
	const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];

	for (const question of questions) {
		const choice = answers[String(question?.id ?? '').trim()];
		if (choice !== 'A' && choice !== 'B') continue;
		const mapping = question?.mapping?.[choice];
		if (!mapping || typeof mapping !== 'object') continue;
		for (const [itemId, weight] of Object.entries(mapping)) {
			const idx = indexByItem.get(String(itemId).trim());
			if (idx === undefined) continue;
			const w = Number(weight);
			if (Number.isFinite(w) && w > 0) raw[idx] += w;
		}
	}
	return l2Normalize(raw);
}

/**
 * Max total mapping weight achievable per survey item across all quiz choices.
 *
 * @param {typeof quizMapping} [quiz]
 * @returns {Map<string, number>}
 */
function buildQuizItemMaxWeights(quiz = quizMapping) {
	const dimensions = getQuizSurveyItemIds();
	/** @type {Map<string, number>} */
	const maxWeights = new Map(dimensions.map((id) => [id, 0]));
	const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];

	for (const question of questions) {
		for (const itemId of dimensions) {
			const wA = Number(question?.mapping?.A?.[itemId] ?? 0);
			const wB = Number(question?.mapping?.B?.[itemId] ?? 0);
			const best = Math.max(Number.isFinite(wA) ? wA : 0, Number.isFinite(wB) ? wB : 0);
			if (best > 0) {
				maxWeights.set(itemId, (maxWeights.get(itemId) ?? 0) + best);
			}
		}
	}
	return maxWeights;
}

/**
 * Accumulate mapping weights from quiz answers (unnormalized).
 *
 * @param {QuizAnswers} answers
 * @param {typeof quizMapping} [quiz]
 * @returns {Map<string, number>}
 */
function buildQuizItemWeightsFromAnswers(answers, quiz = quizMapping) {
	const dimensions = getQuizSurveyItemIds();
	/** @type {Map<string, number>} */
	const weights = new Map(dimensions.map((id) => [id, 0]));
	const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];

	for (const question of questions) {
		const choice = answers[String(question?.id ?? '').trim()];
		if (choice !== 'A' && choice !== 'B') continue;
		const mapping = question?.mapping?.[choice];
		if (!mapping || typeof mapping !== 'object') continue;
		for (const [itemId, weight] of Object.entries(mapping)) {
			const id = String(itemId).trim();
			if (!weights.has(id)) continue;
			const w = Number(weight);
			if (Number.isFinite(w) && w > 0) {
				weights.set(id, (weights.get(id) ?? 0) + w);
			}
		}
	}
	return weights;
}

/**
 * Map accumulated quiz weights to Likert values on discriminating survey items.
 * Items with no mapping weight are omitted (cross-model consensus applied later).
 * Signaled items map into [floor, ceiling] of each item's display axis, then are
 * stored in survey space via displayToSurveyValue (reverse-aware).
 *
 * @param {QuizAnswers} answers
 * @param {Map<string, import('$lib/data/archetypeSimilarity.js').ItemScaleMeta>} scaleMeta
 * @param {string[]} [dimensions]
 * @param {typeof quizMapping} [quiz]
 */
export function deriveDiscriminatingSurveyFromQuizMappings(
	answers,
	scaleMeta,
	dimensions = getQuizSurveyItemIds(),
	quiz = quizMapping
) {
	const maxWeights = buildQuizItemMaxWeights(quiz);
	const userWeights = buildQuizItemWeightsFromAnswers(answers, quiz);
	/** @type {Record<string, number>} */
	const out = {};

	for (const itemId of dimensions) {
		const meta = scaleMeta.get(itemId);
		if (!meta) continue;
		const maxW = Number(maxWeights.get(itemId) ?? 0);
		const userW = Number(userWeights.get(itemId) ?? 0);
		if (!Number.isFinite(maxW) || maxW <= 0) continue;
		// No quiz signal: leave item out so completeIdeologySurveyResponses keeps cross-model consensus.
		if (!Number.isFinite(userW) || userW <= 0) continue;

		const t = Math.max(0, Math.min(1, userW / maxW));
		const range = meta.hi - meta.lo;
		const displayInnerLo = meta.lo + QUIZ_VALUE_FLOOR * range;
		const displayInnerHi = meta.lo + QUIZ_VALUE_CEILING * range;
		const displayTarget = displayInnerLo + t * (displayInnerHi - displayInnerLo);
		out[itemId] = roundToNearestStep(displayToSurveyValue(displayTarget, meta), meta.lo, meta.hi);
	}
	return out;
}

/**
 * Derive discriminating survey values from quiz answer mappings.
 *
 * @param {QuizAnswers} answers
 * @param {unknown} matrix
 * @param {unknown} encoding
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 */
export function deriveDiscriminatingSurveyFromQuiz(answers, matrix, encoding, averagesRows) {
	const scaleMeta = buildItemScaleMeta(encoding);
	const dimensions = getQuizSurveyItemIds();
	return deriveDiscriminatingSurveyFromQuizMappings(answers, scaleMeta, dimensions);
}

/**
 * Full survey profile (25 derived + consensus fill) from quiz answers.
 *
 * @param {QuizAnswers} answers
 * @param {unknown} matrix
 * @param {unknown} encoding
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 */
export function deriveCompleteSurveyFromQuiz(answers, matrix, encoding, averagesRows) {
	const scaleMeta = buildItemScaleMeta(encoding);
	const dimensions = getQuizSurveyItemIds();
	const discriminating = deriveDiscriminatingSurveyFromQuizMappings(answers, scaleMeta, dimensions);
	return completeIdeologySurveyResponses(discriminating, averagesRows, scaleMeta);
}

/**
 * Model match results for a completed custom survey profile.
 *
 * @param {Record<string, number>} completeSurvey
 * @param {unknown} encoding
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {string[]} models
 * @param {{ quizAnswers?: QuizAnswers | null, insightMode?: 'quiz' | 'builder' }} [options]
 * @returns {QuizResults | null}
 */
export function computeCustomSurveyResults(
	completeSurvey,
	encoding,
	averagesRows,
	models,
	options = {}
) {
	const scaleMeta = buildItemScaleMeta(encoding);
	const modelRankings = rankModelsByCustomSurveySimilarity(
		completeSurvey,
		models,
		encoding,
		averagesRows
	);
	const topMatch = modelRankings[0];
	if (!topMatch) return null;

	const runnerUp = modelRankings[1] ?? null;
	const quizAnswers = options.quizAnswers ?? null;
	const insightMode = options.insightMode ?? 'builder';
	/** @type {IdeologyInsight[]} */
	let insights = [];

	if (insightMode === 'quiz' && isCompleteQuizAnswers(quizAnswers)) {
		insights = rankQuizQuestionInsights(quizAnswers, topMatch.model, averagesRows, scaleMeta);
	} else {
		insights = rankBuilderItemInsights(completeSurvey, topMatch.model, encoding, averagesRows, scaleMeta);
	}

	const { strongestAgreement, strongestDisagreement } = splitTopAgreementDisagreement(insights);
	const discriminating = Object.fromEntries(
		IDEOLOGY_DISCRIMINATING_ITEM_IDS.filter((itemId) =>
			Number.isFinite(Number(completeSurvey[itemId]))
		).map((itemId) => [itemId, completeSurvey[itemId]])
	);

	return {
		completeSurveyResponses: { ...completeSurvey },
		discriminatingSurveyResponses: discriminating,
		topMatch,
		runnerUp,
		strongestAgreement,
		strongestDisagreement
	};
}

/**
 * Quiz results for display: agreement-scored matches and item insights.
 *
 * @param {QuizAnswers} answers
 * @param {unknown} matrix
 * @param {unknown} encoding
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {string[]} models
 * @returns {QuizResults | null}
 */
export function computeQuizResults(answers, matrix, encoding, averagesRows, models) {
	const scaleMeta = buildItemScaleMeta(encoding);

	const discriminating = deriveDiscriminatingSurveyFromQuizMappings(
		answers,
		scaleMeta,
		getQuizSurveyItemIds()
	);
	const completeSurvey = completeIdeologySurveyResponses(discriminating, averagesRows, scaleMeta);

	return computeCustomSurveyResults(completeSurvey, encoding, averagesRows, models, {
		quizAnswers: answers,
		insightMode: 'quiz'
	});
}

/**
 * Per-question model vector: normalized unit vector over that question's mapped items.
 *
 * @param {string} model
 * @param {string} questionId
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {Map<string, import('$lib/data/archetypeSimilarity.js').ItemScaleMeta>} scaleMeta
 * @param {typeof quizMapping} [quiz]
 */
export function buildModelQuizVectorForQuestion(
	model,
	questionId,
	averagesRows,
	scaleMeta,
	quiz = quizMapping
) {
	const question = (quiz?.questions ?? []).find((q) => String(q?.id ?? '') === questionId);
	if (!question) return new Float64Array(0);

	const dimensions = getQuestionMappedItemIds(question);
	if (!dimensions.length) return new Float64Array(0);
	const profile = buildModelDisplayProfile(model, averagesRows, scaleMeta);
	return buildIdeologyUnitVector(profile, scaleMeta, dimensions);
}

/**
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {Map<string, import('$lib/data/archetypeSimilarity.js').ItemScaleMeta>} scaleMeta
 * @param {string[]} [dimensions]
 */
export function buildQuizItemWeights(averagesRows, scaleMeta, dimensions = getQuizSurveyItemIds()) {
	return buildIdeologyWeightVector(averagesRows, scaleMeta, dimensions);
}

export { weightedCosineSimilarity };

/**
 * @param {QuizAnswers} answers
 * @param {string[]} models
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {unknown} encoding
 */
export function rankModelsByQuizSimilarity(answers, models, averagesRows, encoding) {
	const scaleMeta = buildItemScaleMeta(encoding);
	const dimensions = getQuizSurveyItemIds();
	const weights = buildQuizItemWeights(averagesRows, scaleMeta, dimensions);
	const userVec = buildUserQuizVector(answers);

	/** @type {QuizModelRankingRow[]} */
	const rows = [];
	for (const model of models) {
		const key = String(model ?? '').trim();
		if (!key) continue;
		const modelVec = buildModelQuizVector(key, averagesRows, scaleMeta, dimensions);
		const sim = weightedCosineSimilarity(userVec, modelVec, weights);
		rows.push({ model: key, similarityPct: Math.round(sim * 100) });
	}
	rows.sort((a, b) => b.similarityPct - a.similarityPct || a.model.localeCompare(b.model));
	return rows;
}

/**
 * Stable item list for a quiz question (union of A/B mapping keys).
 *
 * @param {typeof quizMapping.questions[number]} question
 */
function getQuestionMappedItemIds(question) {
	const itemIds = new Set();
	for (const side of ['A', 'B']) {
		const mapping = question?.mapping?.[side];
		if (!mapping) continue;
		for (const itemId of Object.keys(mapping)) itemIds.add(String(itemId).trim());
	}
	return [...itemIds].sort();
}

/**
 * @param {QuizAnswers} answers
 * @param {typeof quizMapping.questions[number]} question
 * @param {string[]} [dimensions]
 */
export function buildUserQuizVectorForQuestion(answers, question, dimensions = null) {
	const choice = answers[String(question?.id ?? '').trim()];
	if (choice !== 'A' && choice !== 'B') return new Float64Array(0);
	const mapping = question?.mapping?.[choice];
	if (!mapping) return new Float64Array(0);

	const dims = dimensions ?? getQuestionMappedItemIds(question);
	const indexByItem = itemIndexByDimension(dims);
	const raw = new Float64Array(dims.length);
	for (const [itemId, weight] of Object.entries(mapping)) {
		const idx = indexByItem.get(String(itemId).trim());
		if (idx === undefined) continue;
		const w = Number(weight);
		if (Number.isFinite(w) && w > 0) raw[idx] += w;
	}
	return l2Normalize(raw);
}

/**
 * Per-question alignment between the user's choice and a model on that question's mapped items.
 *
 * @param {QuizAnswers} answers
 * @param {string} model
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {Map<string, import('$lib/data/archetypeSimilarity.js').ItemScaleMeta>} scaleMeta
 * @param {typeof quizMapping} [quiz]
 * @returns {IdeologyInsight[]}
 */
export function rankQuizQuestionInsights(answers, model, averagesRows, scaleMeta, quiz = quizMapping) {
	const questions = getQuizQuestions();
	/** @type {IdeologyInsight[]} */
	const insights = [];

	for (const question of questions) {
		const questionId = String(question?.id ?? '').trim();
		const choice = answers[questionId];
		if (choice !== 'A' && choice !== 'B') continue;

		const dimensions = getQuestionMappedItemIds(question);
		if (!dimensions.length) continue;

		const userVec = buildUserQuizVectorForQuestion(answers, question, dimensions);
		const modelVec = buildModelQuizVectorForQuestion(model, questionId, averagesRows, scaleMeta, quiz);
		if (!userVec.length || userVec.length !== modelVec.length) continue;

		const weights = new Float64Array(userVec.length);
		const unit = 1 / userVec.length;
		for (let i = 0; i < userVec.length; i++) weights[i] = unit;

		const agreementPct = Math.round(weightedCosineSimilarity(userVec, modelVec, weights) * 100);
		const prompt = String(question.prompt ?? '').trim();
		const userChoiceLabel =
			choice === 'A'
				? String(question.option_a ?? '').trim()
				: String(question.option_b ?? '').trim();

		insights.push({
			id: questionId,
			prompt,
			userChoiceLabel,
			agreementPct
		});
	}

	insights.sort((a, b) => b.agreementPct - a.agreementPct || a.prompt.localeCompare(b.prompt));
	return insights;
}

/**
 * Builder slider alignment vs top model on discriminating survey items.
 *
 * @param {Record<string, number>} completeSurvey
 * @param {string} model
 * @param {unknown} encoding
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {Map<string, import('$lib/data/archetypeSimilarity.js').ItemScaleMeta>} scaleMeta
 * @returns {IdeologyInsight[]}
 */
function rankBuilderItemInsights(completeSurvey, model, encoding, averagesRows, scaleMeta) {
	const userProfile = buildCustomDisplayProfile(completeSurvey, scaleMeta);
	const topModelProfile = buildModelDisplayProfile(model, averagesRows, scaleMeta);
	const encodingItemById = buildEncodingItemById(encoding);
	/** @type {IdeologyInsight[]} */
	const insights = [];

	for (const itemId of IDEOLOGY_DISCRIMINATING_ITEM_IDS) {
		const agreementPct = itemAgreementPct(userProfile, topModelProfile, itemId, scaleMeta);
		if (agreementPct === null) continue;
		insights.push({
			id: itemId,
			prompt: builderStatementLabelForStatement(itemId, encodingItemById),
			userChoiceLabel: null,
			agreementPct
		});
	}

	insights.sort((a, b) => b.agreementPct - a.agreementPct || a.prompt.localeCompare(b.prompt));
	return insights;
}
