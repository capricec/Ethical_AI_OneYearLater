import { writable, derived, get } from 'svelte/store';
import { compiled, encoding } from '$lib/data/dataset.js';
import {
	computeStatementsViz,
	STATEMENT_ORDER_DIVERGENCE,
	STATEMENT_ORDER_SUBSCALE
} from '$lib/data/computeStatementsViz.js';
import { MODEL_ORDER } from '$lib/viz/modelColors.js';

export const VIEW_MODE_DIMENSION_BUMP = 'dimension_aggregate_bump';
export const VIEW_MODE_RADIAL = 'statements_radial';

function firstAvailableModel() {
	const viz = computeStatementsViz(encoding, compiled, null, STATEMENT_ORDER_DIVERGENCE);
	if (!viz) return MODEL_ORDER[0];
	return viz.modelSeries[0]?.fundModel ?? MODEL_ORDER[0];
}

export const rawDataset = writable({ compiled, encoding });

/** `null` means “no model selected” (used for convergence views). */
export const selectedModel = writable(/** @type {string | null} */ (null));

/** `null` means no statement is selected yet (selection is explicit in Bump). */
export const selectedStatementId = writable(/** @type {string | null} */ (null));

export const selectedViewMode = writable(VIEW_MODE_RADIAL);

/** `null` = all dimensions; otherwise filter to this dimension id */
export const selectedDimensionFilter = writable(/** @type {number | null} */ (null));

/** `null` = all subscales. UI-only: left tray + radial wedge highlight; does not filter `statementsViz`. */
export const selectedSubscaleFilter = writable(/** @type {string | null} */ (null));

/**
 * Radial-only statement ordering (bump always uses divergence).
 */
export const radialStatementOrder = writable(
	/** @type {typeof STATEMENT_ORDER_SUBSCALE | typeof STATEMENT_ORDER_DIVERGENCE} */ (
		STATEMENT_ORDER_SUBSCALE
	)
);

/** Mirrors view mode: open in Bump, closed in Radial (driven by `selectedViewMode`). */
export const leftTrayOpen = writable(true);

export const rightTrayOpen = writable(true);

selectedViewMode.subscribe((mode) => {
	leftTrayOpen.set(mode === VIEW_MODE_DIMENSION_BUMP);
});

export const statementsViz = derived(
	[rawDataset, selectedDimensionFilter, selectedViewMode, radialStatementOrder],
	([$raw, $filter, $mode, $radialOrder]) => {
		const isRadial = $mode === VIEW_MODE_RADIAL;
		const order = isRadial ? $radialOrder : STATEMENT_ORDER_DIVERGENCE;
		// Never filter viz by subscale: dimension highlight is independent of statement selection,
		// and bump mode must keep all statements so any `selectedStatementId` stays valid.
		return computeStatementsViz($raw.encoding, $raw.compiled, $filter, order, null);
	}
);

statementsViz.subscribe((viz) => {
	if (!viz?.modelSeries?.length) return;
	const current = get(selectedModel);
	if (current === null) return;
	if (!viz.modelSeries.some((m) => m.fundModel === current)) {
		selectedModel.set(null);
	}
});

statementsViz.subscribe((viz) => {
	if (!viz?.dim?.items?.length) return;
	const cur = get(selectedStatementId);
	if (cur === null) return;
	if (!viz.dim.items.some((it) => it.item_id === cur)) {
		selectedStatementId.set(null);
	}
});

export function setSelectedModel(fundModel) {
	selectedModel.set(fundModel ?? null);
}

/** @param {string | null} itemId */
export function setSelectedStatementId(itemId) {
	selectedStatementId.set(itemId);
}

/** @param {number | null} dimId */
export function setDimensionFilter(dimId) {
	selectedDimensionFilter.set(dimId);
}

/** @param {string | null} subscaleKey */
export function setSubscaleFilter(subscaleKey) {
	selectedSubscaleFilter.set(subscaleKey ?? null);
}

/** @param {typeof STATEMENT_ORDER_SUBSCALE | typeof STATEMENT_ORDER_DIVERGENCE} order */
export function setRadialStatementOrder(order) {
	radialStatementOrder.set(
		order === STATEMENT_ORDER_DIVERGENCE ? STATEMENT_ORDER_DIVERGENCE : STATEMENT_ORDER_SUBSCALE
	);
}

export function setSelectedViewMode(mode) {
	selectedViewMode.set(mode);
}
