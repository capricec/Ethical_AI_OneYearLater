/**
 * @param {{ text?: string, left?: string, right?: string, item_id: string, dimensionId?: number, reverse?: boolean }} item
 */
export function statementLabel(item) {
	if (item?.text) return item.text;
	if (item?.left && item?.right) {
		if (item.dimensionId === 27 && item.reverse === true) return `${item.right} vs. ${item.left}`;
		return `${item.left} vs. ${item.right}`;
	}
	return item?.item_id ?? '';
}
