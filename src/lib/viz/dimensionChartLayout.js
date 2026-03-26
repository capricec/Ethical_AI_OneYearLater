/** Shared layout metrics so the page table rows match the SVG rows (margins 0 = heights line up). */
export const CHART_MARGIN_TOP = 0;
export const CHART_MARGIN_BOTTOM = 0;
export const CHART_SIDE_GUTTER = 150;

/** One row per statement (aligned with left/center/right table rows). */
export const ROW_ITEM_HEIGHT = 120;

/** @param {number} itemCount */
export function chartHeight(itemCount) {
	return CHART_MARGIN_TOP + CHART_MARGIN_BOTTOM + itemCount * ROW_ITEM_HEIGHT;
}
