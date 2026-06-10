/**
 * Archetype similarity: normalized mean agreement on a 0–100% scale.
 *
 * Per item (display space, rounded to nearest scale step):
 *   item_similarity = max(0, 1 - |a - b| / (scale_max - scale_min))
 * Overall (default):
 *   similarity% = round(100 × average(item_similarity))
 *
 * Optional model distinctiveness weighting (USE_MODEL_DISTINCTIVENESS_WEIGHTS):
 *   weight_i = SD(model means on item i) / range_i   // display space, all models
 *   similarity% = round(100 × Σ(weight_i × item_similarity_i) / Σ(weight_i))
 *   Items with zero cross-model SD are excluded.
 *
 * Model means and custom profiles are converted to display space (reverse-coded
 * items flipped) before comparison. Archetype matrix values are survey-space raw.
 */

/** Internal toggle: set true to weight items by cross-model SD / range. */
export const USE_MODEL_DISTINCTIVENESS_WEIGHTS = true;

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
 * @param {Map<string, number>} profileA
 * @param {Map<string, number>} profileB
 * @param {Map<string, ItemScaleMeta>} scaleMeta
 * @param {Map<string, number> | null | undefined} [itemWeights]
 */
export function computeSimilarityPct(profileA, profileB, scaleMeta, itemWeights = null) {
	let weightedSum = 0;
	let weightTotal = 0;
	let unweightedSum = 0;
	let unweightedCount = 0;
	const useWeights = itemWeights instanceof Map && itemWeights.size > 0;

	for (const [itemId, meta] of scaleMeta) {
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
 * @returns {Map<string, number>}
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
 * Survey-space responses keyed by item_id (slider values).
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
	for (const [itemId, display] of profile) {
		const meta = scaleMeta.get(itemId);
		if (!meta) continue;
		out[itemId] = roundToNearestStep(displayToSurveyValue(display, meta), meta.lo, meta.hi);
	}
	return out;
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
	const itemWeights = USE_MODEL_DISTINCTIVENESS_WEIGHTS
		? buildModelDistinctivenessWeights(averagesRows, scaleMeta)
		: null;

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
			similarityPct: computeSimilarityPct(modelProfile, profile, scaleMeta, itemWeights),
			isCustom: false
		});
	}

	const hasCustom =
		customSurveyResponses &&
		typeof customSurveyResponses === 'object' &&
		Object.keys(customSurveyResponses).length > 0;

	if (hasCustom) {
		const customProfile = buildCustomDisplayProfile(customSurveyResponses, scaleMeta);
		rows.push({
			id: 'custom',
			title: 'Custom',
			description: 'Your personalized ideology profile',
			similarityPct: computeSimilarityPct(modelProfile, customProfile, scaleMeta, itemWeights),
			isCustom: true
		});
	}

	rows.sort((a, b) => b.similarityPct - a.similarityPct || a.title.localeCompare(b.title));
	return rows;
}
