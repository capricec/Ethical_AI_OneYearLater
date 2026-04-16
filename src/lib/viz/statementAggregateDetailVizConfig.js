/**
 * Developer controls: statement **aggregate** detail when **All** models is selected
 * (the horizontal strip that was heatmap bins). Single-model selection uses daily values
 * as **dots** on the statement scale (same jitter + radius as `DOT_STRIP_CONFIG`, opacity
 * from heatmap bin strength) in `DimensionAggregateBumpChart`.
 *
 * For production, set `STATEMENT_DETAIL_AGGREGATE_MODE` to `'heatmap'` or `'dots'`
 * (or wire from env / feature flag later).
 */

/** @typedef {'dots' | 'heatmap'} StatementAggregateDetailMode */

/** `'dots'` — one semi-transparent dot per daily value on the statement scale. `'heatmap'` — original binned rects. */
export const STATEMENT_DETAIL_AGGREGATE_MODE = /** @type {StatementAggregateDetailMode} */ ('dots');

/**
 * Dot strip tuning for the aggregate (All models) detail strip when
 * `STATEMENT_DETAIL_AGGREGATE_MODE === 'dots'`.
 * - `jitterXMaxScaleUnits`: max offset in **scale/domain units** (same units as the response value
 *   before `xScale`). Jitter is applied in data space then mapped with `xScale`, so it grows/shrinks
 *   with the chart width. For integer scales (e.g. 1–7), `0.45` is on the order of half the gap
 *   between adjacent values; tune up/down to taste.
 * - `fillOpacity`: base opacity per dot (overlap reads as density).
 * - `radiusPx`: circle radius (still px for screen legibility).
 */
export const DOT_STRIP_CONFIG = {
	jitterXMaxScaleUnits: 0.45,
	fillOpacity: 0.05,
	radiusPx: 10
};

/** Radius (px) for the single-model daily timeline dots. */
export const SINGLE_MODEL_DOT_RADIUS_PX = 4;

/** Horizontal jitter (in scale units) for the single-model timeline dots. */
export const SINGLE_MODEL_JITTER_SCALE_UNITS = 0.0;
