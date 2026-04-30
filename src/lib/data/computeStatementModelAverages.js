/**
 * @typedef {object} StatementModelAverageRow
 * @property {string} item_id
 * @property {number} dimension_id
 * @property {string} fund_model
 * @property {number} mean_value
 * @property {number} sample_count
 * @property {number} scale_min
 * @property {number} scale_max
 * @property {string} scale_min_label
 * @property {string} scale_max_label
 * @property {number} scale_step
 * @property {string} scale_label
 */

/**
 * @param {number} value
 * @param {number} scaleMin
 * @param {number} scaleMax
 */
function reverseNumericValue(value, scaleMin, scaleMax) {
	return scaleMin + scaleMax - value;
}

/**
 * @param {number} value
 * @param {number} lo
 * @param {number} hi
 */
function clampRoundToStep(value, lo, hi) {
	if (!Number.isFinite(value) || !Number.isFinite(lo) || !Number.isFinite(hi)) return lo;
	const clamped = Math.max(lo, Math.min(hi, value));
	const mid = (lo + hi) / 2;
	const stepped = clamped < mid ? Math.floor(clamped) : Math.ceil(clamped);
	return Math.max(lo, Math.min(hi, stepped));
}

/**
 * Fallback label for scales without explicit `statement_scale` buckets.
 * Primarily used for forced-choice pairs (e.g. dimension 27) so scale labels
 * are never blank in `statement_model_averages.json`.
 *
 * @param {number} step
 * @param {number} lo
 * @param {number} hi
 * @param {string} minLabel
 * @param {string} maxLabel
 */
function fallbackScaleLabel(step, lo, hi, minLabel, maxLabel) {
	const left = String(minLabel ?? '').trim();
	const right = String(maxLabel ?? '').trim();
	if (!left && !right) return '';
	const mid = (lo + hi) / 2;
	if (step < mid) return left || right;
	if (step > mid) return right || left;
	if (left && right) return `${left} / ${right}`;
	return left || right;
}

/**
 * Computes average value per statement item per model.
 * Mean values are in display space (reverse-coded items are flipped).
 *
 * @param {unknown[]} encoding
 * @param {unknown[]} compiled
 * @returns {StatementModelAverageRow[]}
 */
export function computeStatementModelAverages(encoding, compiled) {
	if (!Array.isArray(encoding) || !Array.isArray(compiled)) return [];

	/** @type {StatementModelAverageRow[]} */
	const out = [];

	for (const dim of encoding) {
		const dimId = Number(dim?.id);
		const scaleMin = Number(dim?.scale?.min);
		const scaleMax = Number(dim?.scale?.max);
		if (!Number.isFinite(dimId) || !Array.isArray(dim?.items)) continue;
		if (!Number.isFinite(scaleMin) || !Number.isFinite(scaleMax)) continue;

		const lo = Math.min(scaleMin, scaleMax);
		const hi = Math.max(scaleMin, scaleMax);

		/** @type {Map<string, unknown[]>} */
		const byModel = new Map();
		for (const row of compiled) {
			if (!row || Number(row?.id) !== dimId || !row?.response_parsed) continue;
			const model = String(row?.fund_model ?? '').trim();
			if (!model) continue;
			if (!byModel.has(model)) byModel.set(model, []);
			byModel.get(model).push(row);
		}

		for (const item of dim.items) {
			const itemId = String(item?.item_id ?? '').trim();
			if (!itemId) continue;
			const key = itemId.split('_').pop() ?? '';
			const reverse = Boolean(item?.reverse);
			const statementScale = Array.isArray(item?.statement_scale)
				? item.statement_scale.map((s) => String(s ?? '').trim()).filter(Boolean)
				: Array.isArray(dim?.statement_scale)
					? dim.statement_scale.map((s) => String(s ?? '').trim()).filter(Boolean)
					: [];
			const dimMinLabel = String(dim?.statement_values?.min ?? '').trim();
			const dimMaxLabel = String(dim?.statement_values?.max ?? '').trim();
			const itemMinLabel = String(item?.statement_values?.min ?? '').trim();
			const itemMaxLabel = String(item?.statement_values?.max ?? '').trim();
			const rawScaleMinLabel = itemMinLabel || dimMinLabel;
			const rawScaleMaxLabel = itemMaxLabel || dimMaxLabel;
			const scaleMinLabel = reverse ? rawScaleMaxLabel : rawScaleMinLabel;
			const scaleMaxLabel = reverse ? rawScaleMinLabel : rawScaleMaxLabel;

			for (const [fundModel, rows] of byModel.entries()) {
				/** @type {number[]} */
				const values = [];
				for (const row of rows) {
					const v = Number(row?.response_parsed?.[key]);
					if (!Number.isFinite(v)) continue;
					values.push(reverse ? reverseNumericValue(v, lo, hi) : v);
				}
				if (!values.length) continue;
				const mean = values.reduce((a, b) => a + b, 0) / values.length;
				const scaleStep = clampRoundToStep(mean, lo, hi);
				const scaleIdx = Math.max(0, Math.min(statementScale.length - 1, scaleStep - lo));
				const orientedScale = reverse ? [...statementScale].reverse() : statementScale;
				const scaleLabel =
					orientedScale[scaleIdx] ??
					fallbackScaleLabel(scaleStep, lo, hi, scaleMinLabel, scaleMaxLabel);

				out.push({
					item_id: itemId,
					dimension_id: dimId,
					fund_model: fundModel,
					mean_value: Number(mean.toFixed(4)),
					sample_count: values.length,
					scale_min: lo,
					scale_max: hi,
					scale_min_label: scaleMinLabel,
					scale_max_label: scaleMaxLabel,
					scale_step: scaleStep,
					scale_label: scaleLabel
				});
			}
		}
	}

	out.sort((a, b) => {
		if (a.item_id !== b.item_id) return a.item_id.localeCompare(b.item_id);
		return a.fund_model.localeCompare(b.fund_model);
	});
	return out;
}

