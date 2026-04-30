/**
 * Shared value → fill color for all visualizations (bump, radial, future charts).
 * Palette rules: 1–6 vs 1–10 base; 1–4 (e.g. id 30) uses bins from the 1–10 palette.
 */

export const VALUE_PALETTE_1_TO_6 = ['#05436F', '#82B8D1', '#D1E8F0', '#FEDBC7', '#D75F29', '#A4321C'];

export const VALUE_PALETTE_1_TO_10 = [
	'#05436F',
	'#0165AB',
	'#82B8D1',
	'#AADAEB',
	'#D1E8F0',
	'#FEDBC7',
	'#F6A482',
	'#D75F29',
	'#CC4226',
	'#A4321C'
];

/** Full diverging scale (radial fills sample this center → edge). */
export const RADIAL_FILL_PALETTE = VALUE_PALETTE_1_TO_10;

/** Below scale midpoint: blues only (avoids peach/orange sitting in “low” regions). */
export const RADIAL_FILL_PALETTE_COOL = VALUE_PALETTE_1_TO_10.slice(0, 5);

/** Above scale midpoint: warm reds/oranges only. */
export const RADIAL_FILL_PALETTE_WARM = VALUE_PALETTE_1_TO_10.slice(5);

/**
 * @param {object} item — expects scaleMin, scaleMax (from viz row)
 * @param {number} value
 */
export function fillColorForItem(item, value) {
	const minRaw = item?.scaleMin;
	const maxRaw = item?.scaleMax;
	const min = Number.isFinite(minRaw) ? Math.floor(minRaw) : 1;
	const max = Number.isFinite(maxRaw) ? Math.floor(maxRaw) : 6;
	const span = Math.max(1, max - min + 1);
	let palette;

	if (min === 1 && max === 4) {
		palette = [
			VALUE_PALETTE_1_TO_10[1],
			VALUE_PALETTE_1_TO_10[3],
			VALUE_PALETTE_1_TO_10[6],
			VALUE_PALETTE_1_TO_10[8]
		];
	} else {
		const basePalette = max <= 6 ? VALUE_PALETTE_1_TO_6 : VALUE_PALETTE_1_TO_10;
		palette = basePalette.slice(0, span);
	}
	const fallback = palette[0] ?? VALUE_PALETTE_1_TO_6[0];

	if (!Number.isFinite(value)) return fallback;
	const clamped = Math.max(min, Math.min(max, value));
	const binned = Math.floor(clamped);
	const index = Math.max(0, Math.min(span - 1, binned - min));
	return palette[index] ?? fallback;
}

/**
 * @param {number} value
 * @param {string[]} scaleTexts
 * @param {number} min
 * @param {number} max
 * @param {boolean} reverse
 */
export function scaleTextForValue(value, scaleTexts, min, max, reverse = false) {
	if (!Array.isArray(scaleTexts) || scaleTexts.length === 0) return '';
	if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return '';
	const clamped = Math.max(min, Math.min(max, value));
	// Midpoint-split mapping: lower half floors, upper half ceils.
	// Example 1-6: [1-2), [2-3), [3-3.5), [3.5-4), [4-5), [5-6]
	const mid = (min + max) / 2;
	let bin = clamped < mid ? Math.floor(clamped) : Math.ceil(clamped);
	if (reverse) {
		bin = min + max - bin;
	}
	const idx = Math.max(0, Math.min(scaleTexts.length - 1, bin - min));
	return String(scaleTexts[idx] ?? '');
}
