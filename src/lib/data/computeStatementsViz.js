import { MODEL_ORDER } from '$lib/viz/modelColors.js';
import { subscaleDisplayName } from '$lib/ui/subscaleDisplayName.js';
import { subscaleInterpretation } from '$lib/data/dataset.js';

/**
 * @param {number} dimensionId
 * @param {string} subscaleKey — internal key including __none__
 */
function interpretationForSubscale(dimensionId, subscaleKey) {
	if (subscaleKey === '__none__') return null;
	const dim = /** @type {Record<string, Record<string, { label?: string, description?: string }>>} */ (
		subscaleInterpretation
	);
	return dim[String(dimensionId)]?.[subscaleKey] ?? null;
}

/** @param {string} itemId */
function responseKeyFromItemId(itemId) {
	const parts = itemId.split('_');
	return parts[parts.length - 1] ?? '';
}

/**
 * @param {number} v
 * @param {number} scaleMin
 * @param {number} scaleMax
 */
function reverseNumericValue(v, scaleMin, scaleMax) {
	if (!Number.isFinite(scaleMin) || !Number.isFinite(scaleMax)) return v;
	return scaleMin + scaleMax - v;
}

/**
 * @param {unknown[]} compiled
 * @param {number} dimensionId
 */
function buildByModelForDimension(compiled, dimensionId) {
	/** @type {Map<string, object[]>} */
	const byModel = new Map();
	for (const row of compiled) {
		if (!row || row.id !== dimensionId || !row.response_parsed) continue;
		const m = row.fund_model;
		if (!m) continue;
		if (!byModel.has(m)) byModel.set(m, []);
		byModel.get(m).push(row);
	}
	return byModel;
}

/**
 * @param {object} dim
 * @param {Map<string, object[]>} byModel
 */
function modelSeriesForDimension(dim, byModel) {
	const scaleMin = Number(dim.scale?.min);
	const scaleMax = Number(dim.scale?.max);
	const items = dim.items;
	if (!Array.isArray(items)) return [];

	/** @type {{ fundModel: string, itemMeans: (number|null)[] }[]} */
	const series = [];

	for (const fundModel of MODEL_ORDER) {
		const group = byModel.get(fundModel);
		if (!group?.length) continue;

		const itemMeans = items.map((item) => {
			const shouldReverse = Boolean(item?.reverse);
			const key = responseKeyFromItemId(item.item_id);
			const vals = [];
			for (const row of group) {
				const v = row.response_parsed[key];
				if (typeof v === 'number' && !Number.isNaN(v)) vals.push(v);
			}
			if (shouldReverse) {
				for (let i = 0; i < vals.length; i++) {
					vals[i] = reverseNumericValue(vals[i], scaleMin, scaleMax);
				}
			}
			return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
		});

		const defined = itemMeans.filter((x) => x !== null);
		if (!defined.length) continue;

		series.push({ fundModel, itemMeans });
	}

	return series;
}

function constructTitle(construct) {
	if (!construct) return 'Dimension';
	return String(construct).replace(/_/g, ' ');
}

/** First-appearance order of subscale keys within one dimension's item list. */
function subscaleRankMapForDimension(dim) {
	/** @type {Map<string, number>} */
	const map = new Map();
	let rank = 0;
	if (!Array.isArray(dim.items)) return map;
	for (const item of dim.items) {
		const key = String(item?.subscale ?? '').trim() || '__none__';
		if (!map.has(key)) map.set(key, rank++);
	}
	return map;
}

export const STATEMENT_ORDER_DIVERGENCE = 'divergence';
export const STATEMENT_ORDER_DIMENSION = 'dimension';
/** Radial: encoding dimension order, then first-appearance subscale order within dimension, then item index. */
export const STATEMENT_ORDER_SUBSCALE = 'subscale';

/**
 * All statements across dimensions.
 * Optional filter: single dimension id, or null for all.
 *
 * @param {unknown[]} encoding
 * @param {unknown[]} compiled
 * @param {number | null} dimensionFilter
 * @param {'divergence' | 'dimension' | 'subscale'} [order='divergence']
 * @param {string | null} [subscaleFilter] — if set, keep only entries with this subscale key (after dimension filter)
 */
export function computeStatementsViz(
	encoding,
	compiled,
	dimensionFilter,
	order = STATEMENT_ORDER_DIVERGENCE,
	subscaleFilter = null
) {
	if (!Array.isArray(encoding) || !Array.isArray(compiled)) return null;

	/** @type {Map<number, { fundModel: string, itemMeans: (number|null)[] }[]>} */
	const seriesByDimId = new Map();

	/** @type {{ dim: object, item: object, itemIndexInDim: number, encodingIndex: number, divergence: number, rawSpread: number, subscaleKey: string, subscaleRankInDim: number }[]} */
	const entries = [];

	for (let encodingIndex = 0; encodingIndex < encoding.length; encodingIndex++) {
		const dim = encoding[encodingIndex];
		if (!dim || typeof dim.id !== 'number' || !Array.isArray(dim.items) || !dim.items.length) continue;

		const byModel = buildByModelForDimension(compiled, dim.id);
		const modelSeries = modelSeriesForDimension(dim, byModel);
		if (!modelSeries.length) continue;

		seriesByDimId.set(dim.id, modelSeries);

		const scaleMin = Number(dim.scale?.min);
		const scaleMax = Number(dim.scale?.max);
		const scaleRange =
			Number.isFinite(scaleMin) && Number.isFinite(scaleMax) ? scaleMax - scaleMin : NaN;

		const subscaleRanks = subscaleRankMapForDimension(dim);

		dim.items.forEach((item, itemIndexInDim) => {
			const vals = modelSeries
				.map((m) => m.itemMeans[itemIndexInDim])
				.filter((v) => typeof v === 'number' && !Number.isNaN(v));
			const rawSpread = vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : 0;
			const divergence =
				Number.isFinite(scaleRange) && scaleRange > 0 ? rawSpread / scaleRange : rawSpread;
			const subscaleKey = String(item?.subscale ?? '').trim() || '__none__';
			const subscaleRankInDim = subscaleRanks.get(subscaleKey) ?? 0;
			entries.push({
				dim,
				item,
				itemIndexInDim,
				encodingIndex,
				divergence,
				rawSpread,
				subscaleKey,
				subscaleRankInDim
			});
		});
	}

	entries.sort((a, b) => {
		if (order === STATEMENT_ORDER_SUBSCALE) {
			if (a.encodingIndex !== b.encodingIndex) return a.encodingIndex - b.encodingIndex;
			if (a.subscaleRankInDim !== b.subscaleRankInDim) return a.subscaleRankInDim - b.subscaleRankInDim;
			return a.itemIndexInDim - b.itemIndexInDim;
		}
		if (order === STATEMENT_ORDER_DIMENSION) {
			if (a.encodingIndex !== b.encodingIndex) return a.encodingIndex - b.encodingIndex;
			return a.itemIndexInDim - b.itemIndexInDim;
		}
		if (b.divergence !== a.divergence) return b.divergence - a.divergence;
		if (a.dim.id !== b.dim.id) return a.dim.id - b.dim.id;
		return a.itemIndexInDim - b.itemIndexInDim;
	});

	let filtered =
		dimensionFilter === null || dimensionFilter === undefined
			? entries
			: entries.filter((e) => e.dim.id === dimensionFilter);

	if (subscaleFilter !== null && subscaleFilter !== undefined) {
		filtered = filtered.filter((e) => e.subscaleKey === subscaleFilter);
	}

	if (!filtered.length) return null;

	/** Unique subscale keys in final list order (for radial rail). */
	const seenSubscale = new Set();
	/** @type {{ key: string, label: string, description: string }[]} */
	const subscalesInOrder = [];
	for (const e of filtered) {
		const key = e.subscaleKey;
		if (seenSubscale.has(key)) continue;
		seenSubscale.add(key);
		const interp = interpretationForSubscale(e.dim.id, key);
		subscalesInOrder.push({
			key,
			label:
				interp?.label ?? (key === '__none__' ? 'Uncategorized' : subscaleDisplayName(key)),
			description: interp?.description ? String(interp.description) : ''
		});
	}

	/** @type {object[]} */
	const enrichedItems = filtered.map((e) => {
		const dim = e.dim;
		const scaleMin = Number(dim.scale?.min);
		const scaleMax = Number(dim.scale?.max);
		const sk = e.subscaleKey;
		const interp = interpretationForSubscale(dim.id, sk);
		return {
			...e.item,
			dimensionId: dim.id,
			dimensionTitle: dim.title ?? constructTitle(dim.construct),
			subscaleKey: sk,
			subscaleLabel:
				interp?.label ?? (sk === '__none__' ? 'Uncategorized' : subscaleDisplayName(sk)),
			subscaleDescription: interp?.description ? String(interp.description) : '',
			scaleMin,
			scaleMax,
			statement_scale: Array.isArray(e.item.statement_scale)
				? e.item.statement_scale
				: Array.isArray(dim.statement_scale)
					? dim.statement_scale
					: [],
			dimStatementValues: {
				min: String(dim.statement_values?.min ?? ''),
				max: String(dim.statement_values?.max ?? '')
			}
		};
	});

	const itemExtents = enrichedItems.map((it) => [it.scaleMin, it.scaleMax]);

	/** @type {{ fundModel: string, itemMeans: (number|null)[] }[]} */
	const modelSeries = [];

	for (const fundModel of MODEL_ORDER) {
		const itemMeans = filtered.map((e) => {
			const ms = seriesByDimId.get(e.dim.id);
			const row = ms?.find((m) => m.fundModel === fundModel);
			return row ? row.itemMeans[e.itemIndexInDim] : null;
		});
		if (!itemMeans.some((v) => v !== null && v !== undefined)) continue;
		modelSeries.push({ fundModel, itemMeans });
	}

	if (!modelSeries.length) return null;

	return {
		dim: { items: enrichedItems },
		modelSeries,
		itemExtents,
		subscalesInOrder,
		labels: {
			aggregate: { left: '', right: '' },
			item: { left: '', right: '' }
		},
		statementDivergence: filtered.map((e) => ({
			item_id: e.item.item_id,
			divergence: e.divergence,
			rawSpread: e.rawSpread
		}))
	};
}
