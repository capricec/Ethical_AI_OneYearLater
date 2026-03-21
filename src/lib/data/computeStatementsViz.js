import { MODEL_ORDER } from '$lib/viz/modelColors.js';

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

/**
 * All statements across dimensions, sorted by normalized divergence (high → low).
 * Optional filter: single dimension id, or null for all.
 *
 * @param {unknown[]} encoding
 * @param {unknown[]} compiled
 * @param {number | null} dimensionFilter
 */
export function computeStatementsViz(encoding, compiled, dimensionFilter) {
	if (!Array.isArray(encoding) || !Array.isArray(compiled)) return null;

	/** @type {Map<number, { fundModel: string, itemMeans: (number|null)[] }[]>} */
	const seriesByDimId = new Map();

	/** @type {{ dim: object, item: object, itemIndexInDim: number, divergence: number, rawSpread: number }[]} */
	const entries = [];

	for (const dim of encoding) {
		if (!dim || typeof dim.id !== 'number' || !Array.isArray(dim.items) || !dim.items.length) continue;

		const byModel = buildByModelForDimension(compiled, dim.id);
		const modelSeries = modelSeriesForDimension(dim, byModel);
		if (!modelSeries.length) continue;

		seriesByDimId.set(dim.id, modelSeries);

		const scaleMin = Number(dim.scale?.min);
		const scaleMax = Number(dim.scale?.max);
		const scaleRange =
			Number.isFinite(scaleMin) && Number.isFinite(scaleMax) ? scaleMax - scaleMin : NaN;

		dim.items.forEach((item, itemIndexInDim) => {
			const vals = modelSeries
				.map((m) => m.itemMeans[itemIndexInDim])
				.filter((v) => typeof v === 'number' && !Number.isNaN(v));
			const rawSpread = vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : 0;
			const divergence =
				Number.isFinite(scaleRange) && scaleRange > 0 ? rawSpread / scaleRange : rawSpread;
			entries.push({ dim, item, itemIndexInDim, divergence, rawSpread });
		});
	}

	entries.sort((a, b) => {
		if (b.divergence !== a.divergence) return b.divergence - a.divergence;
		if (a.dim.id !== b.dim.id) return a.dim.id - b.dim.id;
		return a.itemIndexInDim - b.itemIndexInDim;
	});

	const filtered =
		dimensionFilter === null || dimensionFilter === undefined
			? entries
			: entries.filter((e) => e.dim.id === dimensionFilter);

	if (!filtered.length) return null;

	/** @type {object[]} */
	const enrichedItems = filtered.map((e) => {
		const dim = e.dim;
		const scaleMin = Number(dim.scale?.min);
		const scaleMax = Number(dim.scale?.max);
		return {
			...e.item,
			dimensionId: dim.id,
			dimensionTitle: dim.title ?? constructTitle(dim.construct),
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
