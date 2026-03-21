import { MODEL_ORDER } from '$lib/viz/modelColors.js';

/** @param {string} itemId e.g. "31_4" → "4" */
function responseKeyFromItemId(itemId) {
	const parts = itemId.split('_');
	return parts[parts.length - 1] ?? '';
}

function isBlank(value) {
	return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function truncateFirstTwoWords(text) {
	if (isBlank(text)) return '';
	const words = String(text).trim().split(/\s+/).filter(Boolean);
	return words.slice(0, 2).join(' ');
}

/**
 * Apply standard numeric reversal across the worksheet scale domain.
 * v' = scaleMin + scaleMax - v
 *
 * @param {number} v
 * @param {number} scaleMin
 * @param {number} scaleMax
 */
function reverseNumericValue(v, scaleMin, scaleMax) {
	// If the worksheet scale isn't defined, don't break means.
	if (!Number.isFinite(scaleMin) || !Number.isFinite(scaleMax)) return v;
	return scaleMin + scaleMax - v;
}

/**
 * @param {unknown[]} encoding
 * @param {unknown[]} compiled
 * @param {number} dimensionId
 */
export function computeDimensionViz(encoding, compiled, dimensionId) {
	const dim = encoding.find((d) => d.id === dimensionId);
	if (!dim || !Array.isArray(dim.items)) return null;

	/** @type {Map<string, object[]>} */
	const byModel = new Map();
	for (const row of compiled) {
		if (!row || row.id !== dimensionId || !row.response_parsed) continue;
		const m = row.fund_model;
		if (!m) continue;
		if (!byModel.has(m)) byModel.set(m, []);
		byModel.get(m).push(row);
	}

	const scaleMin = Number(dim.scale?.min);
	const scaleMax = Number(dim.scale?.max);
	const scaleRange =
		Number.isFinite(scaleMin) && Number.isFinite(scaleMax) ? scaleMax - scaleMin : NaN;

	/** @type {{ aggregate: { left: string, right: string }, item: { left: string, right: string } }} */
	let labels = {
		aggregate: { left: '', right: '' },
		item: { left: '', right: '' }
	};

	if (dim.id === 27) {
		// Special forced-choice: endpoints show first 2 words from left/right.
		const first = dim.items?.[0];
		labels = {
			aggregate: {
				left: String(dim.aggregate_values?.min ?? ''),
				right: String(dim.aggregate_values?.max ?? '')
			},
			item: {
				left: truncateFirstTwoWords(first?.left),
				right: truncateFirstTwoWords(first?.right)
			}
		};
	} else {
		labels = {
			aggregate: {
				left: String(dim.aggregate_values?.min ?? ''),
				right: String(dim.aggregate_values?.max ?? '')
			},
			item: {
				left: String(dim.statement_values?.min ?? ''),
				right: String(dim.statement_values?.max ?? '')
			}
		};
	}

	/** @type {{ fundModel: string, itemMeans: (number|null)[], aggregate: number }[]} */
	const modelSeries = [];

	for (const fundModel of MODEL_ORDER) {
		const group = byModel.get(fundModel);
		if (!group?.length) continue;

		const itemMeans = dim.items.map((item) => {
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

		// Aggregate bubble: mean of underlying statement means (per your requirement).
		const aggregate = defined.reduce((a, b) => a + b, 0) / defined.length;
		modelSeries.push({ fundModel, itemMeans, aggregate });
	}

	if (!modelSeries.length) return null;

	// Rank by normalized divergence (highest -> lowest): fraction of the scale spanned
	// between max and min model means. divergence = rawSpread / (scaleMax - scaleMin).
	// If scale range is invalid, fall back to raw spread for ordering.
	const statementDispersion = dim.items.map((item, idx) => {
		const vals = modelSeries
			.map((m) => m.itemMeans[idx])
			.filter((v) => typeof v === 'number' && !Number.isNaN(v));
		const rawSpread = vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : 0;
		const divergence =
			Number.isFinite(scaleRange) && scaleRange > 0 ? rawSpread / scaleRange : rawSpread;
		return { idx, item, divergence, rawSpread };
	});
	statementDispersion.sort((a, b) => {
		if (b.divergence !== a.divergence) return b.divergence - a.divergence;
		return a.idx - b.idx;
	});
	const orderedIndices = statementDispersion.map((d) => d.idx);
	const orderedItems = statementDispersion.map((d) => d.item);

	const orderedModelSeries = modelSeries.map((m) => ({
		...m,
		itemMeans: orderedIndices.map((idx) => m.itemMeans[idx])
	}));

	// Scale domains: derived from the worksheet `scale.min/max` so x-axes remain stable
	// across dimensions and both statement + aggregate plots share the same domain.
	const aggregateExtent = [scaleMin, scaleMax];

	// Each statement row uses the same domain so the axes are consistent.
	const itemExtents = orderedItems.map(() => [scaleMin, scaleMax]);

	const orderedDim = {
		...dim,
		items: orderedItems
	};

	return {
		dim: orderedDim,
		modelSeries: orderedModelSeries,
		aggregateExtent,
		itemExtents,
		labels,
		statementDispersion: statementDispersion.map(({ item, divergence, rawSpread }) => ({
			item_id: item.item_id,
			divergence,
			rawSpread
		}))
	};
}
