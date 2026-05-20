import { compiled, encoding } from '$lib/data/dataset.js';
import {
	computeStatementsViz,
	STATEMENT_ORDER_SUBSCALE
} from '$lib/data/computeStatementsViz.js';
import { SURVEY_SPIKE_NEUTRAL_FRAC } from '$lib/introduction/surveyChartLayout.js';
import debatesDataset from '../../../data/debates.json';

const ANGLE_BASE = -Math.PI / 2;

/** @type {{ itemIndex: Map<string, number>, n: number } | null} */
let surveyPngLayoutCache = null;

/**
 * Same statement order as the live radial (`STATEMENT_ORDER_SUBSCALE`) and `SurveyResults.png`.
 */
function surveyPngLayout() {
	if (surveyPngLayoutCache) return surveyPngLayoutCache;

	const viz = computeStatementsViz(encoding, compiled, null, STATEMENT_ORDER_SUBSCALE);
	const items = viz?.dim?.items ?? [];
	const n = items.length;
	/** @type {Map<string, number>} */
	const itemIndex = new Map();

	for (let i = 0; i < n; i++) {
		const id = String(items[i]?.item_id ?? '').trim();
		if (id) itemIndex.set(id, i);
	}

	surveyPngLayoutCache = { itemIndex, n };
	return surveyPngLayoutCache;
}

/**
 * @param {string} itemId
 * @returns {{ angleRad: number, neutralRadiusFrac: number } | null}
 */
export function surveySpokeForItemId(itemId) {
	const id = String(itemId ?? '').trim();
	const { itemIndex, n } = surveyPngLayout();
	if (!n || !itemIndex.has(id)) return null;

	const i = itemIndex.get(id);
	const angleRad = ANGLE_BASE + (i / n) * 2 * Math.PI;
	return {
		angleRad,
		neutralRadiusFrac: SURVEY_SPIKE_NEUTRAL_FRAC
	};
}

/**
 * @param {string[]} itemIds
 * @returns {{ itemId: string, angleRad: number, neutralRadiusFrac: number }[]}
 */
export function surveySpokesForItemIds(itemIds) {
	return (itemIds ?? [])
		.map((itemId) => {
			const spoke = surveySpokeForItemId(itemId);
			if (!spoke) return null;
			return { itemId: String(itemId), ...spoke };
		})
		.filter(Boolean);
}

/**
 * @param {string} debateId
 * @returns {string[]}
 */
export function sourceItemsForIntroDebate(debateId) {
	const id = String(debateId ?? '').trim();
	const row = (debatesDataset?.debates ?? []).find((d) => String(d?.debate_id ?? '') === id);
	return Array.isArray(row?.source_items)
		? row.source_items.map((s) => String(s ?? '').trim()).filter(Boolean)
		: [];
}
