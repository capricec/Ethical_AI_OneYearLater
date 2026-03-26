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

function firstGlobalItemId() {
	const viz = computeStatementsViz(encoding, compiled, null, STATEMENT_ORDER_DIVERGENCE);
	return viz?.dim?.items?.[0]?.item_id ?? '';
}

function firstAvailableModel() {
	const viz = computeStatementsViz(encoding, compiled, null, STATEMENT_ORDER_DIVERGENCE);
	if (!viz) return MODEL_ORDER[0];
	return viz.modelSeries[0]?.fundModel ?? MODEL_ORDER[0];
}

export const rawDataset = writable({ compiled, encoding });

/** `null` means “no model selected” (used for convergence views). */
export const selectedModel = writable(/** @type {string | null} */ (null));

export const selectedStatementId = writable(firstGlobalItemId());

export const selectedViewMode = writable(VIEW_MODE_DIMENSION_BUMP);

/** `null` = all dimensions; otherwise filter to this dimension id */
export const selectedDimensionFilter = writable(/** @type {number | null} */ (null));

/** `null` = all subscales; otherwise filter to this subscale key (e.g. from encoding item.subscale) */
export const selectedSubscaleFilter = writable(/** @type {string | null} */ (null));

/** Mirrors view mode: open in Bump, closed in Radial (driven by `selectedViewMode`). */
export const leftTrayOpen = writable(true);

export const rightTrayOpen = writable(true);

selectedViewMode.subscribe((mode) => {
	leftTrayOpen.set(mode === VIEW_MODE_DIMENSION_BUMP);
});

export const statementsViz = derived(
	[rawDataset, selectedDimensionFilter, selectedViewMode, selectedSubscaleFilter],
	([$raw, $filter, $mode, $subscale]) =>
		computeStatementsViz(
			$raw.encoding,
			$raw.compiled,
			$filter,
			$mode === VIEW_MODE_RADIAL ? STATEMENT_ORDER_SUBSCALE : STATEMENT_ORDER_DIVERGENCE,
			$subscale
		)
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
	if (!viz.dim.items.some((it) => it.item_id === cur)) {
		selectedStatementId.set(viz.dim.items[0].item_id);
	}
});

export function setSelectedModel(fundModel) {
	selectedModel.set(fundModel ?? null);
}

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

export function setSelectedViewMode(mode) {
	selectedViewMode.set(mode);
}
