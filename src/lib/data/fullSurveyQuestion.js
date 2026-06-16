/**
 * Build a lookup of encoding rows keyed by item_id.
 * @param {unknown} encoding
 * @returns {Map<string, { scale: { min: number, max: number, type: string }, statementValues: { min: string, max: string }, item: Record<string, unknown>, dimensionId?: number, dimensionTitle?: string }>}
 */
export function buildEncodingItemById(encoding) {
	/** @type {Map<string, { scale: { min: number, max: number, type: string }, statementValues: { min: string, max: string }, item: Record<string, unknown>, dimensionId?: number, dimensionTitle?: string }>} */
	const byId = new Map();
	for (const dim of encoding ?? []) {
		const scale = {
			min: Number(dim?.scale?.min),
			max: Number(dim?.scale?.max),
			type: String(dim?.scale?.type ?? '').trim()
		};
		const statementValues = {
			min: String(dim?.statement_values?.min ?? '').trim(),
			max: String(dim?.statement_values?.max ?? '').trim()
		};
		const dimensionId = Number(dim?.id);
		const dimensionTitle = String(dim?.title ?? '').trim();
		for (const it of dim?.items ?? []) {
			const itemId = String(it?.item_id ?? '').trim();
			if (!itemId) continue;
			byId.set(itemId, { scale, statementValues, item: it, dimensionId, dimensionTitle });
		}
	}
	return byId;
}

/**
 * Min/max labels as used in the full survey question prompt.
 * @param {{ scale?: { min?: number, max?: number, type?: string }, statementValues?: { min?: string, max?: string }, item?: Record<string, unknown> }} row
 * @returns {{ min: string, max: string }}
 */
export function scaleMeaningsForEncodingRow(row) {
	const type = String(row.scale?.type ?? '').trim();
	const baseItem = row.item ?? {};
	const text = String(baseItem.text ?? '').trim();
	const left = String(baseItem.left ?? '').trim();
	const right = String(baseItem.right ?? '').trim();
	const minTxt = String(row.statementValues?.min ?? '').trim();
	const maxTxt = String(row.statementValues?.max ?? '').trim();

	if (type === 'justifiability' && text) {
		return { min: 'never justifiable', max: 'always justifiable' };
	}
	if (type === 'forced_choice_pair' && left && right) {
		return { min: left, max: right };
	}
	if (type === 'frequency' && text) {
		return {
			min: minTxt || String(row.scale?.min ?? ''),
			max: maxTxt || String(row.scale?.max ?? '')
		};
	}
	if (text && minTxt && maxTxt) {
		return { min: minTxt, max: maxTxt };
	}
	return { min: minTxt, max: maxTxt };
}

/**
 * Full survey question text shown in the statement view.
 * @param {{ scale?: { min?: number, max?: number, type?: string }, statementValues?: { min?: string, max?: string }, item?: Record<string, unknown> }} row
 * @returns {string}
 */
export function fullSurveyQuestionForEncodingRow(row) {
	if (!row) return '';
	const min = Number(row.scale?.min);
	const max = Number(row.scale?.max);
	const minTxt = String(row.statementValues?.min ?? '').trim();
	const maxTxt = String(row.statementValues?.max ?? '').trim();
	const baseItem = row.item ?? {};
	const text = String(baseItem.text ?? '').trim();
	const left = String(baseItem.left ?? '').trim();
	const right = String(baseItem.right ?? '').trim();
	const type = String(row.scale?.type ?? '').trim();

	if (type === 'justifiability' && text) {
		return `On a scale from ${min}-${max}, ${min} meaning never justifiable to ${max} meaning always justifiable how would you rate ${text.toLowerCase()}?`;
	}
	if (type === 'forced_choice_pair' && left && right) {
		return `On a scale from ${min}-${max}, ${min} meaning ${left.toLowerCase()} and ${max} meaning ${right.toLowerCase()}, where would you place your view?`;
	}
	if (type === 'frequency' && text) {
		const lo = minTxt || `${min}`;
		const hi = maxTxt || `${max}`;
		return `On a scale from ${min}-${max}, ${min} meaning ${lo.toLowerCase()} and ${max} meaning ${hi.toLowerCase()}, how would you rate: ${text.toLowerCase()}?`;
	}
	if (text && minTxt && maxTxt) {
		return `On a scale from ${min}-${max}, ${min} meaning ${minTxt.toLowerCase()} and ${max} meaning ${maxTxt.toLowerCase()}, how would you rate: ${text.toLowerCase()}?`;
	}
	return text || left || right;
}

/**
 * Short label for ideology builder sliders (no scale preamble).
 * Forced-choice pairs use the placement question; others use the statement text only.
 *
 * @param {{ scale?: { type?: string }, item?: Record<string, unknown> } | undefined} row
 * @returns {string}
 */
export function builderStatementLabelForEncodingRow(row) {
	if (!row) return '';
	const type = String(row.scale?.type ?? '').trim();
	const baseItem = row.item ?? {};
	const text = String(baseItem.text ?? '').trim();
	const left = String(baseItem.left ?? '').trim();
	const right = String(baseItem.right ?? '').trim();

	if (type === 'forced_choice_pair' || (left && right && !text)) {
		return 'Where would you place your view?';
	}
	if (text) {
		const normalized = text.endsWith('?') ? text.slice(0, -1).trimEnd() : text;
		return normalized.charAt(0).toUpperCase() + normalized.slice(1);
	}
	return 'Where would you place your view?';
}

/**
 * @param {string | null | undefined} statementId
 * @param {Map<string, { scale: { min: number, max: number, type: string }, statementValues: { min: string, max: string }, item: Record<string, unknown> }>} encodingItemById
 * @returns {string}
 */
export function builderStatementLabelForStatement(statementId, encodingItemById) {
	const key = String(statementId ?? '').trim();
	if (!key) return '';
	return builderStatementLabelForEncodingRow(encodingItemById.get(key));
}

/**
 * @param {string | null | undefined} statementId
 * @param {Map<string, { scale: { min: number, max: number, type: string }, statementValues: { min: string, max: string }, item: Record<string, unknown> }>} encodingItemById
 * @returns {string}
 */
export function fullSurveyQuestionForStatement(statementId, encodingItemById) {
	const key = String(statementId ?? '').trim();
	if (!key) return '';
	return fullSurveyQuestionForEncodingRow(encodingItemById.get(key));
}

/**
 * @param {unknown} encoding
 * @returns {Array<{ item_id: string, dimension_id: number | null, dimension_title: string, scale: { min: number, max: number, type: string }, meanings: { min: string, max: string }, prompt: string }>}
 */
export function buildFullSurveyStatements(encoding) {
	const byId = buildEncodingItemById(encoding);
	const statements = [];
	for (const [itemId, row] of byId) {
		statements.push({
			item_id: itemId,
			dimension_id: Number.isFinite(row.dimensionId) ? row.dimensionId : null,
			dimension_title: row.dimensionTitle ?? '',
			scale: { ...row.scale },
			meanings: scaleMeaningsForEncodingRow(row),
			prompt: fullSurveyQuestionForEncodingRow(row)
		});
	}
	statements.sort((a, b) => a.item_id.localeCompare(b.item_id, undefined, { numeric: true }));
	return statements;
}
