/**
 * Chronological daily series for one statement × one fund model from compiled runs.
 * Duplicate dates: keep the **last run** (last row in source order after sorting by date, then array index).
 */

/** @param {string} itemId */
export function responseKeyFromItemId(itemId) {
	const parts = String(itemId).split('_');
	return parts[parts.length - 1] ?? '';
}

/**
 * @param {number} v
 * @param {number} scaleMin
 * @param {number} scaleMax
 */
export function reverseNumericValue(v, scaleMin, scaleMax) {
	if (!Number.isFinite(scaleMin) || !Number.isFinite(scaleMax)) return v;
	return scaleMin + scaleMax - v;
}

/**
 * @param {unknown[]} compiled
 * @param {number} dimensionId
 * @param {{ item_id: string, reverse?: boolean, scaleMin: number, scaleMax: number }} item
 * @param {string} fundModel
 * @returns {{ date: string, value: number, model?: string }[]}
 */
export function dailySeriesForStatementModel(compiled, dimensionId, item, fundModel) {
	if (!Array.isArray(compiled) || !item) return [];
	const key = responseKeyFromItemId(item.item_id);
	const scaleMin = Number(item.scaleMin);
	const scaleMax = Number(item.scaleMax);
	const shouldReverse = Boolean(item.reverse);

	/** @type {{ date: string, value: number, model?: string, runIndex: number }[]} */
	const candidates = [];
	for (let i = 0; i < compiled.length; i++) {
		const row = compiled[i];
		if (!row || typeof row !== 'object') continue;
		if (row.id !== dimensionId || row.fund_model !== fundModel || !row.response_parsed) continue;
		const date = row.date;
		if (date == null || String(date).trim() === '') continue;
		const raw = row.response_parsed[key];
		if (typeof raw !== 'number' || Number.isNaN(raw)) continue;
		let v = raw;
		if (shouldReverse) v = reverseNumericValue(v, scaleMin, scaleMax);
		candidates.push({ date: String(date), value: v, model: String(row.model ?? ''), runIndex: i });
	}

	candidates.sort((a, b) => {
		if (a.date !== b.date) return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
		return a.runIndex - b.runIndex;
	});

	/** @type {Map<string, { value: number, model?: string }>} */
	const lastByDate = new Map();
	for (const c of candidates) {
		lastByDate.set(c.date, { value: c.value, model: c.model });
	}

	const dates = [...lastByDate.keys()].sort();
	return dates.map((date) => {
		const rec = /** @type {{ value: number, model?: string }} */ (lastByDate.get(date));
		return { date, value: rec.value, model: rec.model };
	});
}
