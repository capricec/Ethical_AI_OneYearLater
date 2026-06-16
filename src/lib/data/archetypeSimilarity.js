/**
 * Archetype similarity: normalized mean agreement on a 0–100% scale.
 *
 * Default (USE_COSINE_IDEOLOGY_SIMILARITY = false):
 *   Per item (display space, rounded to nearest scale step):
 *     item_similarity = max(0, 1 - |a - b| / (scale_max - scale_min))
 *   Overall:
 *     similarity% = round(100 × weighted average(item_similarity))
 *
 * Cosine mode (USE_COSINE_IDEOLOGY_SIMILARITY = true) — same as ideology quiz:
 *   Each profile → unit vector over discriminating items (display value in [0,1], L2-normalized)
 *   similarity% = round(100 × weighted_cosine(model, archetype))
 *
 * Optional model distinctiveness weighting (USE_MODEL_DISTINCTIVENESS_WEIGHTS):
 *   weight_i = SD(model means on item i) / range_i
 *
 * Model means in statement_model_averages.json are in display space (flipped at
 * aggregation). Custom/builder/quiz profiles are stored in survey space.
 * Archetype matrix values are survey-space raw. Similarity compares display
 * profiles: models use means as-is; archetype/custom apply toDisplayValue.
 */

/** Internal toggle: set true to weight items by cross-model SD / range. */
export const USE_MODEL_DISTINCTIVENESS_WEIGHTS = true;

/**
 * Internal toggle: set true to score ideology rankings with weighted cosine similarity
 * (same method as the ideology quiz). false = per-item agreement (legacy).
 */
export const USE_COSINE_IDEOLOGY_SIMILARITY = false;

/**
 * Survey items retained for ideology similarity and the builder (~75% of cross-model
 * distinctiveness weight). Remaining items use model-consensus values in the archetype matrix.
 */
export const IDEOLOGY_DISCRIMINATING_ITEM_IDS = [
	'28_10',
	'28_11',
	'23_2',
	'28_7',
	'31_2',
	'28_8',
	'28_9',
	'31_6',
	'23_5',
	'30_5',
	'31_9',
	'32_8',
	'28_6',
	'27_3',
	'23_4',
	'23_10',
	'27_1',
	'30_1',
	'31_7',
	'31_4',
	'31_8',
	'31_1',
	'32_1',
	'30_2',
	'31_5'
];

const IDEOLOGY_DISCRIMINATING_ITEM_ID_SET = new Set(IDEOLOGY_DISCRIMINATING_ITEM_IDS);

/** @param {string} itemId */
export function isIdeologyDiscriminatingItem(itemId) {
	return IDEOLOGY_DISCRIMINATING_ITEM_ID_SET.has(String(itemId ?? '').trim());
}

/**
 * @typedef {object} ItemScaleMeta
 * @property {number} lo
 * @property {number} hi
 * @property {boolean} reverse
 */

/**
 * @typedef {object} ArchetypeRankingRow
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number} similarityPct
 * @property {boolean} isCustom
 */

/**
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 */
export function reverseNumericValue(v, lo, hi) {
	return lo + hi - v;
}

/**
 * @param {number} value
 * @param {ItemScaleMeta} meta
 */
export function toDisplayValue(value, meta) {
	if (!Number.isFinite(value) || !meta) return NaN;
	const v = Number(value);
	return meta.reverse ? reverseNumericValue(v, meta.lo, meta.hi) : v;
}

/**
 * @param {number} display
 * @param {ItemScaleMeta} meta
 */
export function displayToSurveyValue(display, meta) {
	if (!Number.isFinite(display) || !meta) return meta?.lo ?? 1;
	const v = Number(display);
	return meta.reverse ? reverseNumericValue(v, meta.lo, meta.hi) : v;
}

/**
 * @param {number} value
 * @param {number} lo
 * @param {number} hi
 */
export function roundToNearestStep(value, lo, hi) {
	if (!Number.isFinite(value) || !Number.isFinite(lo) || !Number.isFinite(hi)) return lo;
	const clamped = Math.max(lo, Math.min(hi, value));
	return Math.round(clamped);
}

/**
 * @param {unknown} encoding
 * @returns {Map<string, ItemScaleMeta>}
 */
export function buildItemScaleMeta(encoding) {
	/** @type {Map<string, ItemScaleMeta>} */
	const meta = new Map();
	for (const dim of encoding ?? []) {
		const scaleMin = Number(dim?.scale?.min);
		const scaleMax = Number(dim?.scale?.max);
		if (!Number.isFinite(scaleMin) || !Number.isFinite(scaleMax)) continue;
		const lo = Math.min(scaleMin, scaleMax);
		const hi = Math.max(scaleMin, scaleMax);
		for (const item of dim?.items ?? []) {
			const itemId = String(item?.item_id ?? '').trim();
			if (!itemId) continue;
			meta.set(itemId, { lo, hi, reverse: Boolean(item?.reverse) });
		}
	}
	return meta;
}

/**
 * @param {number[]} values
 */
function populationStdDev(values) {
	if (!Array.isArray(values) || values.length < 2) return 0;
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
	return Math.sqrt(variance);
}

/**
 * Distinctiveness weights from spread of model means (display space) per item.
 * weight_i = SD(all model means on item i) / (scale_max - scale_min)
 *
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 * @returns {Map<string, number>}
 */
export function buildModelDistinctivenessWeights(averagesRows, scaleMeta) {
	/** @type {Map<string, number[]>} */
	const valuesByItem = new Map();
	for (const row of averagesRows ?? []) {
		const itemId = String(row?.item_id ?? '').trim();
		const meta = scaleMeta.get(itemId);
		if (!meta) continue;
		const mean = Number(row?.mean_value);
		if (!Number.isFinite(mean)) continue;
		if (!valuesByItem.has(itemId)) valuesByItem.set(itemId, []);
		valuesByItem.get(itemId).push(mean);
	}

	/** @type {Map<string, number>} */
	const weights = new Map();
	for (const [itemId, meta] of scaleMeta) {
		const values = valuesByItem.get(itemId);
		const range = meta.hi - meta.lo;
		if (!values || values.length < 2 || range <= 0) {
			weights.set(itemId, 0);
			continue;
		}
		weights.set(itemId, populationStdDev(values) / range);
	}
	return weights;
}

/**
 * Distinctiveness weight as a share of total (sums to 100% across items with weight > 0).
 *
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 * @returns {{ shares: { itemId: string, weight: number, weightPct: number }[], totalWeight: number }}
 */
export function buildModelDistinctivenessWeightShares(averagesRows, scaleMeta) {
	const weights = buildModelDistinctivenessWeights(averagesRows, scaleMeta);
	let totalWeight = 0;
	for (const w of weights.values()) totalWeight += w;

	/** @type {{ itemId: string, weight: number, weightPct: number }[]} */
	const shares = [];
	for (const [itemId, weight] of weights) {
		shares.push({
			itemId,
			weight,
			weightPct: totalWeight > 0 ? (weight / totalWeight) * 100 : 0
		});
	}
	shares.sort((a, b) => b.weight - a.weight || a.itemId.localeCompare(b.itemId));
	return { shares, totalWeight };
}

/**
 * Distinctiveness weight shares among ideology-discriminating items only (builder display).
 *
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 */
export function buildIdeologyDistinctivenessWeightShares(averagesRows, scaleMeta) {
	const { shares } = buildModelDistinctivenessWeightShares(averagesRows, scaleMeta);
	const discriminating = shares.filter((s) => isIdeologyDiscriminatingItem(s.itemId));
	let totalWeight = 0;
	for (const s of discriminating) totalWeight += s.weight;
	const rebased = discriminating.map((s) => ({
		...s,
		weightPct: totalWeight > 0 ? (s.weight / totalWeight) * 100 : 0
	}));
	return { shares: rebased, totalWeight };
}

/**
 * Cross-model consensus profile in survey space (for builder / quiz fill).
 * Model means in averagesRows are display space and are converted back to survey
 * space so buildCustomDisplayProfile applies reverse scaling exactly once.
 *
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 * @returns {Record<string, number>}
 */
export function buildConsensusSurveyResponses(averagesRows, scaleMeta) {
	/** @type {Map<string, number[]>} */
	const valuesByItem = new Map();
	for (const row of averagesRows ?? []) {
		const itemId = String(row?.item_id ?? '').trim();
		const meta = scaleMeta.get(itemId);
		if (!meta) continue;
		const mean = Number(row?.mean_value);
		if (!Number.isFinite(mean)) continue;
		if (!valuesByItem.has(itemId)) valuesByItem.set(itemId, []);
		valuesByItem.get(itemId).push(mean);
	}

	/** @type {Record<string, number>} */
	const out = {};
	for (const [itemId, meta] of scaleMeta) {
		const values = valuesByItem.get(itemId) ?? [];
		const displayMean = values.length
			? values.reduce((a, b) => a + b, 0) / values.length
			: (meta.lo + meta.hi) / 2;
		const surveyValue = displayToSurveyValue(displayMean, meta);
		out[itemId] = roundToNearestStep(surveyValue, meta.lo, meta.hi);
	}
	return out;
}

/**
 * Merge builder slider values with consensus for non-discriminating items.
 *
 * @param {Record<string, number> | null | undefined} partial
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 */
export function completeIdeologySurveyResponses(partial, averagesRows, scaleMeta) {
	const out = buildConsensusSurveyResponses(averagesRows, scaleMeta);
	if (!partial || typeof partial !== 'object') return out;
	for (const itemId of IDEOLOGY_DISCRIMINATING_ITEM_IDS) {
		const meta = scaleMeta.get(itemId);
		if (!meta) continue;
		const v = Number(partial[itemId]);
		if (!Number.isFinite(v)) continue;
		out[itemId] = roundToNearestStep(v, meta.lo, meta.hi);
	}
	return out;
}

/**
 * Builder draft: discriminating items only (from a full stored profile if present).
 *
 * @param {Record<string, number> | null | undefined} full
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 */
export function ideologyBuilderResponsesFromFull(full, scaleMeta) {
	/** @type {Record<string, number>} */
	const out = {};
	for (const itemId of IDEOLOGY_DISCRIMINATING_ITEM_IDS) {
		const meta = scaleMeta.get(itemId);
		if (!meta) continue;
		const v = Number(full?.[itemId]);
		if (!Number.isFinite(v)) continue;
		out[itemId] = roundToNearestStep(v, meta.lo, meta.hi);
	}
	return out;
}

/**
 * @param {Map<string, number>} weights
 */
function filterIdeologyItemWeights(weights) {
	/** @type {Map<string, number>} */
	const filtered = new Map();
	for (const itemId of IDEOLOGY_DISCRIMINATING_ITEM_IDS) {
		const w = Number(weights.get(itemId) ?? 0);
		if (Number.isFinite(w) && w > 0) filtered.set(itemId, w);
	}
	return filtered;
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
 * @param {number} value
 * @param {ItemScaleMeta} meta
 */
function displayToUnitInterval(value, meta) {
	const range = meta.hi - meta.lo;
	if (range <= 0 || !Number.isFinite(value)) return 0;
	const clamped = Math.max(meta.lo, Math.min(meta.hi, value));
	return (clamped - meta.lo) / range;
}

/**
 * L2 unit vector from a display-space profile over ideology discriminating items.
 *
 * @param {Map<string, number>} displayProfile
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 * @param {string[]} [dimensions]
 */
export function buildIdeologyUnitVector(
	displayProfile,
	scaleMeta,
	dimensions = IDEOLOGY_DISCRIMINATING_ITEM_IDS
) {
	const raw = new Float64Array(dimensions.length);
	for (let i = 0; i < dimensions.length; i++) {
		const itemId = dimensions[i];
		const meta = scaleMeta.get(itemId);
		const val = displayProfile.get(itemId);
		raw[i] = meta && Number.isFinite(val) ? displayToUnitInterval(val, meta) : 0;
	}
	return l2Normalize(raw);
}

/**
 * Distinctiveness weights for ideology/quiz vectors (sum to 1).
 *
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 * @param {string[]} [dimensions]
 */
export function buildIdeologyWeightVector(
	averagesRows,
	scaleMeta,
	dimensions = IDEOLOGY_DISCRIMINATING_ITEM_IDS
) {
	const allWeights = buildModelDistinctivenessWeights(averagesRows, scaleMeta);
	const weights = new Float64Array(dimensions.length);
	let total = 0;
	for (let i = 0; i < dimensions.length; i++) {
		const w = Number(allWeights.get(dimensions[i]) ?? 0);
		weights[i] = Number.isFinite(w) && w > 0 ? w : 0;
		total += weights[i];
	}
	if (total > 0) {
		for (let i = 0; i < weights.length; i++) weights[i] /= total;
	}
	return weights;
}

/**
 * @param {Float64Array} a
 * @param {Float64Array} b
 * @param {Float64Array} weights
 */
export function weightedCosineSimilarity(a, b, weights) {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	const n = Math.min(a.length, b.length, weights.length);
	for (let i = 0; i < n; i++) {
		const w = weights[i];
		dot += w * a[i] * b[i];
		normA += w * a[i] * a[i];
		normB += w * b[i] * b[i];
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB);
	if (denom <= 1e-12) return 0;
	return Math.max(0, Math.min(1, dot / denom));
}

/**
 * Weighted cosine similarity between two display profiles (quiz-compatible).
 *
 * @param {Map<string, number>} profileA
 * @param {Map<string, number>} profileB
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {string[]} [dimensions]
 */
export function computeCosineIdeologySimilarityPct(
	profileA,
	profileB,
	scaleMeta,
	averagesRows,
	dimensions = IDEOLOGY_DISCRIMINATING_ITEM_IDS
) {
	const weights = buildIdeologyWeightVector(averagesRows, scaleMeta, dimensions);
	const vecA = buildIdeologyUnitVector(profileA, scaleMeta, dimensions);
	const vecB = buildIdeologyUnitVector(profileB, scaleMeta, dimensions);
	return Math.round(weightedCosineSimilarity(vecA, vecB, weights) * 100);
}

/**
 * @param {Map<string, number>} profileA
 * @param {Map<string, number>} profileB
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {Map<string, number> | null | undefined} [itemWeights]
 * @param {Set<string> | null | undefined} [itemIdFilter]
 */
function computeIdeologySimilarityPct(
	profileA,
	profileB,
	scaleMeta,
	averagesRows,
	itemWeights = null,
	itemIdFilter = null
) {
	if (USE_COSINE_IDEOLOGY_SIMILARITY) {
		const dimensions = itemIdFilter
			? IDEOLOGY_DISCRIMINATING_ITEM_IDS.filter((id) => itemIdFilter.has(id))
			: IDEOLOGY_DISCRIMINATING_ITEM_IDS;
		return computeCosineIdeologySimilarityPct(profileA, profileB, scaleMeta, averagesRows, dimensions);
	}
	return computeSimilarityPct(profileA, profileB, scaleMeta, itemWeights, itemIdFilter);
}

/**
 * @param {Map<string, number>} profileA
 * @param {Map<string, number>} profileB
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 * @param {Map<string, number> | null | undefined} [itemWeights]
 * @param {Set<string> | null | undefined} [itemIdFilter]
 */
export function computeSimilarityPct(profileA, profileB, scaleMeta, itemWeights = null, itemIdFilter = null) {
	let weightedSum = 0;
	let weightTotal = 0;
	let unweightedSum = 0;
	let unweightedCount = 0;
	const useWeights = itemWeights instanceof Map && itemWeights.size > 0;

	for (const [itemId, meta] of scaleMeta) {
		if (itemIdFilter && !itemIdFilter.has(itemId)) continue;
		const a = profileA.get(itemId);
		const b = profileB.get(itemId);
		if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
		const range = meta.hi - meta.lo;
		if (range <= 0) continue;
		const d = Math.abs(a - b);
		const itemSim = Math.max(0, 1 - d / range);
		unweightedSum += itemSim;
		unweightedCount += 1;

		if (useWeights) {
			const w = Number(itemWeights.get(itemId) ?? 0);
			if (!Number.isFinite(w) || w <= 0) continue;
			weightedSum += w * itemSim;
			weightTotal += w;
		}
	}

	if (useWeights && weightTotal > 0) {
		return Math.round((weightedSum / weightTotal) * 100);
	}
	if (unweightedCount === 0) return 0;
	return Math.round((unweightedSum / unweightedCount) * 100);
}

/**
 * @param {string} model
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 * @returns {Map<string, number>} display-space profile (means are pre-oriented in averages)
 */
export function buildModelDisplayProfile(model, averagesRows, scaleMeta) {
	/** @type {Map<string, number>} */
	const profile = new Map();
	const key = String(model ?? '').trim();
	if (!key) return profile;
	for (const row of averagesRows ?? []) {
		if (String(row?.fund_model ?? '').trim() !== key) continue;
		const itemId = String(row?.item_id ?? '').trim();
		const meta = scaleMeta.get(itemId);
		if (!meta) continue;
		const mean = Number(row?.mean_value);
		if (!Number.isFinite(mean)) continue;
		profile.set(itemId, roundToNearestStep(mean, meta.lo, meta.hi));
	}
	return profile;
}

/**
 * @param {unknown} matrix
 * @param {string} archetypeId
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 * @returns {Map<string, number>}
 */
export function buildArchetypeDisplayProfile(matrix, archetypeId, scaleMeta) {
	/** @type {Map<string, number>} */
	const profile = new Map();
	const id = String(archetypeId ?? '').trim();
	if (!id) return profile;
	for (const row of matrix?.responses ?? []) {
		const itemId = String(row?.item_id ?? '').trim();
		const meta = scaleMeta.get(itemId);
		if (!meta) continue;
		const raw = Number(row?.responses?.[id]);
		if (!Number.isFinite(raw)) continue;
		const display = toDisplayValue(raw, meta);
		profile.set(itemId, roundToNearestStep(display, meta.lo, meta.hi));
	}
	return profile;
}

/**
 * Survey-space responses keyed by item_id (builder sliders, quiz, session storage).
 * Converted to display space via toDisplayValue for similarity comparisons.
 *
 * @param {Record<string, number> | null | undefined} surveyResponses
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 * @returns {Map<string, number>}
 */
export function buildCustomDisplayProfile(surveyResponses, scaleMeta) {
	/** @type {Map<string, number>} */
	const profile = new Map();
	if (!surveyResponses || typeof surveyResponses !== 'object') return profile;
	for (const [itemId, raw] of Object.entries(surveyResponses)) {
		const meta = scaleMeta.get(itemId);
		if (!meta) continue;
		const v = Number(raw);
		if (!Number.isFinite(v)) continue;
		const display = toDisplayValue(v, meta);
		profile.set(itemId, roundToNearestStep(display, meta.lo, meta.hi));
	}
	return profile;
}

/**
 * @param {string} model
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 * @returns {Record<string, number>}
 */
export function modelSurveyResponsesForBuilder(model, averagesRows, scaleMeta) {
	/** @type {Record<string, number>} */
	const out = {};
	const profile = buildModelDisplayProfile(model, averagesRows, scaleMeta);
	for (const itemId of IDEOLOGY_DISCRIMINATING_ITEM_IDS) {
		const display = profile.get(itemId);
		const meta = scaleMeta.get(itemId);
		if (!meta || !Number.isFinite(display)) continue;
		out[itemId] = roundToNearestStep(displayToSurveyValue(display, meta), meta.lo, meta.hi);
	}
	return out;
}

/**
 * Similarity % between a custom survey profile and a model — same calculation as the
 * Custom (you) row in {@link rankArchetypes} for that model.
 *
 * @param {Record<string, number>} customSurveyResponses
 * @param {string} model
 * @param {unknown} encoding
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 */
export function computeCustomSurveySimilarityToModel(
	customSurveyResponses,
	model,
	encoding,
	averagesRows
) {
	const scaleMeta = buildItemScaleMeta(encoding);
	const modelProfile = buildModelDisplayProfile(model, averagesRows, scaleMeta);
	const customProfile = buildCustomDisplayProfile(customSurveyResponses, scaleMeta);
	const itemIdFilter = IDEOLOGY_DISCRIMINATING_ITEM_ID_SET;
	const rawWeights = USE_MODEL_DISTINCTIVENESS_WEIGHTS
		? buildModelDistinctivenessWeights(averagesRows, scaleMeta)
		: null;
	const itemWeights = rawWeights ? filterIdeologyItemWeights(rawWeights) : null;
	return computeIdeologySimilarityPct(
		modelProfile,
		customProfile,
		scaleMeta,
		averagesRows,
		itemWeights,
		itemIdFilter
	);
}

/**
 * Rank models by custom survey similarity — runs the panel's Custom-vs-model logic for each model.
 *
 * @param {Record<string, number>} customSurveyResponses
 * @param {string[]} models
 * @param {unknown} encoding
 * @param {Array<{ item_id?: string, fund_model?: string, mean_value?: number }>} averagesRows
 * @returns {{ model: string, similarityPct: number }[]}
 */
export function rankModelsByCustomSurveySimilarity(
	customSurveyResponses,
	models,
	encoding,
	averagesRows
) {
	/** @type {{ model: string, similarityPct: number }[]} */
	const rows = [];
	for (const model of models) {
		const key = String(model ?? '').trim();
		if (!key) continue;
		rows.push({
			model: key,
			similarityPct: computeCustomSurveySimilarityToModel(
				customSurveyResponses,
				key,
				encoding,
				averagesRows
			)
		});
	}
	rows.sort((a, b) => b.similarityPct - a.similarityPct || a.model.localeCompare(b.model));
	return rows;
}

/**
 * @param {unknown} matrix
 * @param {string} archetypeId
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 * @returns {Record<string, number>}
 */
export function archetypeSurveyResponses(matrix, archetypeId, scaleMeta) {
	/** @type {Record<string, number>} */
	const out = {};
	const id = String(archetypeId ?? '').trim();
	for (const row of matrix?.responses ?? []) {
		const itemId = String(row?.item_id ?? '').trim();
		if (!isIdeologyDiscriminatingItem(itemId)) continue;
		const meta = scaleMeta.get(itemId);
		if (!meta) continue;
		const raw = Number(row?.responses?.[id]);
		if (!Number.isFinite(raw)) continue;
		out[itemId] = roundToNearestStep(raw, meta.lo, meta.hi);
	}
	return out;
}

/**
 * @param {{
 *   matrix: unknown,
 *   encoding: unknown,
 *   averagesRows: unknown[],
 *   model: string,
 *   customSurveyResponses?: Record<string, number> | null
 * }} opts
 * @returns {ArchetypeRankingRow[]}
 */
export function rankArchetypes(opts) {
	const { matrix, encoding, averagesRows, model, customSurveyResponses = null } = opts;
	const scaleMeta = buildItemScaleMeta(encoding);
	const modelProfile = buildModelDisplayProfile(model, averagesRows, scaleMeta);
	const itemIdFilter = IDEOLOGY_DISCRIMINATING_ITEM_ID_SET;
	const rawWeights = USE_MODEL_DISTINCTIVENESS_WEIGHTS
		? buildModelDistinctivenessWeights(averagesRows, scaleMeta)
		: null;
	const itemWeights = rawWeights ? filterIdeologyItemWeights(rawWeights) : null;

	/** @type {ArchetypeRankingRow[]} */
	const rows = [];
	const archetypes = Array.isArray(matrix?.archetypes) ? matrix.archetypes : [];
	const titles = Array.isArray(matrix?.titles) ? matrix.titles : [];
	const descriptions = Array.isArray(matrix?.descriptions) ? matrix.descriptions : [];

	for (let i = 0; i < archetypes.length; i++) {
		const id = String(archetypes[i] ?? '').trim();
		if (!id) continue;
		const profile = buildArchetypeDisplayProfile(matrix, id, scaleMeta);
		rows.push({
			id,
			title: String(titles[i] ?? id),
			description: String(descriptions[i] ?? ''),
			similarityPct: computeIdeologySimilarityPct(
				modelProfile,
				profile,
				scaleMeta,
				averagesRows,
				itemWeights,
				itemIdFilter
			),
			isCustom: false
		});
	}

	const hasCustom =
		customSurveyResponses &&
		typeof customSurveyResponses === 'object' &&
		Object.keys(customSurveyResponses).length > 0;

	if (hasCustom) {
		rows.push({
			id: 'custom',
			title: 'Custom',
			description: 'Your personalized ideology profile',
			similarityPct: computeCustomSurveySimilarityToModel(
				customSurveyResponses,
				model,
				encoding,
				averagesRows
			),
			isCustom: true
		});
	}

	rows.sort((a, b) => b.similarityPct - a.similarityPct || a.title.localeCompare(b.title));
	return rows;
}
