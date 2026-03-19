import { writable, derived, get } from 'svelte/store';
import { compiled, encoding } from '$lib/data/dataset.js';
import { computeDimensionViz } from '$lib/data/computeDimensionViz.js';
import { MODEL_ORDER } from '$lib/viz/modelColors.js';

export const VIEW_MODE_DIMENSION_BUMP = 'dimension_aggregate_bump';

const DEFAULT_DIMENSION_ID = 31;

function firstItemIdForDimension(dimId) {
	const dim = encoding.find((d) => d.id === dimId);
	return dim?.items?.[0]?.item_id ?? '';
}

function firstAvailableModel() {
	const viz = computeDimensionViz(encoding, compiled, DEFAULT_DIMENSION_ID);
	if (!viz) return MODEL_ORDER[0];
	return viz.modelSeries[0]?.fundModel ?? MODEL_ORDER[0];
}

export const rawDataset = writable({ compiled, encoding });

export const selectedModel = writable(firstAvailableModel());

export const selectedStatementId = writable(firstItemIdForDimension(DEFAULT_DIMENSION_ID));

export const selectedViewMode = writable(VIEW_MODE_DIMENSION_BUMP);

export const selectedDimension = writable(DEFAULT_DIMENSION_ID);

export const leftTrayOpen = writable(true);

export const rightTrayOpen = writable(true);

export const dimensionViz = derived([rawDataset, selectedDimension], ([$raw, $dim]) =>
	computeDimensionViz($raw.encoding, $raw.compiled, $dim)
);

/** Keep selected model valid when dimension or data changes */
dimensionViz.subscribe((viz) => {
	if (!viz?.modelSeries?.length) return;
	const current = get(selectedModel);
	if (!viz.modelSeries.some((m) => m.fundModel === current)) {
		selectedModel.set(viz.modelSeries[0].fundModel);
	}
});

export function setSelectedModel(fundModel) {
	selectedModel.set(fundModel);
}

export function setSelectedStatementId(itemId) {
	selectedStatementId.set(itemId);
}

export function setSelectedDimension(dimId) {
	selectedDimension.set(dimId);
	const first = firstItemIdForDimension(dimId);
	if (first) selectedStatementId.set(first);
}

export function setSelectedViewMode(mode) {
	selectedViewMode.set(mode);
}
