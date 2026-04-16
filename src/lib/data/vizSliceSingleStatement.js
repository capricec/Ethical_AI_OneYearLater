/**
 * Narrow a statements viz to a single statement row (for single-statement dashboard mode).
 * @param {object | null | undefined} viz
 * @param {string} itemId
 */
export function sliceVizToSingleStatement(viz, itemId) {
	if (!viz?.dim?.items?.length) return null;
	const idx = viz.dim.items.findIndex((it) => it.item_id === itemId);
	if (idx < 0) return null;
	const item = viz.dim.items[idx];
	const itemExtents = [viz.itemExtents[idx] ?? [0, 1]];
	const modelSeries = viz.modelSeries.map((ms) => ({
		fundModel: ms.fundModel,
		itemMeans: [ms.itemMeans[idx] ?? null],
		itemDistributions: [Array.isArray(ms.itemDistributions?.[idx]) ? ms.itemDistributions[idx] : []]
	}));
	return {
		...viz,
		dim: { items: [item] },
		itemExtents,
		modelSeries
	};
}
