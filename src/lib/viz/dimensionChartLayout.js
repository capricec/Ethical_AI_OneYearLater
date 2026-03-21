/** Shared layout metrics so the page table rows match the SVG rows (margins 0 = heights line up). */
export const CHART_MARGIN_TOP = 0;
export const CHART_MARGIN_BOTTOM = 0;
export const CHART_SIDE_GUTTER = 150;

/** Taller band for the overall dimension (dark grey pill row). */
export const ROW_AGG_HEIGHT = 96;

/** One row per underlying statement (more padding for table feel). */
export const ROW_ITEM_HEIGHT = 90;

/** @param {number} itemCount */
export function chartHeight(itemCount) {
	return (
		CHART_MARGIN_TOP +
		CHART_MARGIN_BOTTOM +
		ROW_AGG_HEIGHT +
		itemCount * ROW_ITEM_HEIGHT
	);
}
