/** @param {[number, number]} extent @param {number} p */
export function padExtent(extent, p = 0.04) {
	const [min, max] = extent;
	if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
	if (min === max) return [min - 1, max + 1];
	const d = max - min;
	return [min - p * d, max + p * d];
}
