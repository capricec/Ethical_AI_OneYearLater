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

	// Scale domains: derived from the worksheet `scale.min/max` so x-axes remain stable
	// across dimensions and both statement + aggregate plots share the same domain.
	const aggregateExtent = [scaleMin, scaleMax];

	// Each statement row uses the same domain so the axes are consistent.
	const itemExtents = dim.items.map(() => [scaleMin, scaleMax]);

	return {
		dim,
		modelSeries,
		aggregateExtent,
		itemExtents,
		labels
	};
}
