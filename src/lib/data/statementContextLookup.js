import { statementContext } from '$lib/data/dataset.js';

/** @type {Map<string, string>} */
const byItemId = new Map();
for (const group of statementContext) {
	for (const row of group?.items ?? []) {
		if (row?.item_id) byItemId.set(String(row.item_id), String(row.context ?? ''));
	}
}

/** @param {string} itemId */
export function contextTextForItem(itemId) {
	return byItemId.get(String(itemId)) ?? '';
}
