import { writable, derived, get } from 'svelte/store';
import { compiled, encoding, debates as debatesRaw } from '$lib/data/dataset.js';
import {
	computeStatementsViz,
	STATEMENT_ORDER_DIVERGENCE,
	STATEMENT_ORDER_SUBSCALE
} from '$lib/data/computeStatementsViz.js';
import {
	normalizeDebates,
	debatesById,
	debateOptions,
	sourceItemsForDebate
} from '$lib/data/debatesAdapter.js';
import { MODEL_ORDER } from '$lib/viz/modelColors.js';
import { cloneLeftTrayFeedSeed } from '$lib/data/leftTrayFeedSeed.js';

export const VIEW_MODE_DIMENSION_BUMP = 'dimension_aggregate_bump';
export const VIEW_MODE_RADIAL = 'statements_radial';

function firstAvailableModel() {
	const viz = computeStatementsViz(encoding, compiled, null, STATEMENT_ORDER_DIVERGENCE);
	if (!viz) return MODEL_ORDER[0];
	return viz.modelSeries[0]?.fundModel ?? MODEL_ORDER[0];
}

export const rawDataset = writable({ compiled, encoding });
export const debatesDataset = writable(normalizeDebates(debatesRaw));

/** `null` means “no model selected” (used for convergence views). */
export const selectedModel = writable(/** @type {string | null} */ (null));
/** Multi-select model state for debate mode (phase 1 scaffold; not yet wired to all views). */
export const selectedModels = writable(/** @type {string[]} */ ([]));
/** `null` means no debate-topic selected. */
export const selectedDebateId = writable(/** @type {string | null} */ (null));
/** `null` means no source item selected within the active debate-topic. */
export const selectedDebateSourceItemId = writable(/** @type {string | null} */ (null));

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
export const leftTrayFeed = writable(cloneLeftTrayFeedSeed());

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

export const debatesByIdMap = derived(debatesDataset, ($debates) => debatesById($debates));
export const debateTopicOptions = derived(debatesDataset, ($debates) => debateOptions($debates));
export const selectedDebate = derived(
	[debatesByIdMap, selectedDebateId],
	([$byId, $debateId]) => ($debateId ? $byId.get($debateId) ?? null : null)
);
export const selectedDebateSourceItems = derived(selectedDebate, ($debate) =>
	sourceItemsForDebate($debate)
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
	if (!viz?.modelSeries?.length) return;
	const valid = new Set(viz.modelSeries.map((m) => m.fundModel));
	const current = get(selectedModels);
	const next = current.filter((m) => valid.has(m));
	if (next.length !== current.length) selectedModels.set(next);
});

selectedModel.subscribe((model) => {
	// Compatibility bridge: single-model interactions (e.g. clicking a spike) should
	// seed multi-select with that one model. Do not collapse multi-select back to
	// "all models" when selectedModel becomes null.
	if (model == null) return;
	const next = [model];
	const current = get(selectedModels);
	if (
		current.length === next.length &&
		current.every((m, idx) => m === next[idx])
	)
		return;
	selectedModels.set(next);
});

selectedDebate.subscribe((debate) => {
	const cur = get(selectedDebateSourceItemId);
	if (cur == null) return;
	const allowed = sourceItemsForDebate(debate);
	if (!allowed.includes(cur)) selectedDebateSourceItemId.set(null);
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

/** @param {string[] | null | undefined} models */
export function setSelectedModels(models) {
	const normalized = Array.isArray(models)
		? Array.from(
			new Set(models.map((m) => String(m ?? '').trim()).filter(Boolean))
		)
		: [];
	selectedModels.set(normalized);
}

/** @param {string} model */
export function toggleSelectedModel(model) {
	const key = String(model ?? '').trim();
	if (!key) return;
	const current = get(selectedModels);
	if (current.includes(key)) {
		selectedModels.set(current.filter((m) => m !== key));
		return;
	}
	selectedModels.set([...current, key]);
}

/** @param {string | null} debateId */
export function setSelectedDebateId(debateId) {
	selectedDebateId.set(debateId ? String(debateId).trim() : null);
}

/** @param {string | null} itemId */
export function setSelectedDebateSourceItemId(itemId) {
	selectedDebateSourceItemId.set(itemId ? String(itemId).trim() : null);
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

/**
 * @param {{ id?: string, type: string, text?: string, model?: string, side?: 'left' | 'right', gapTop?: boolean, chunkBreak?: boolean, statementId?: string, options?: { id: string, label: string }[], debateOptions?: { id: string, label: string }[], debateId?: string, suggestedModels?: string[], debatePrompt?: boolean, valueStatement?: boolean, whySegments?: { kind: 'text' | 'model', text?: string, model?: string }[] }} message
 */
export function appendLeftTrayMessage(message) {
	const type = String(message?.type ?? '').trim() || 'narration';
	const isTopicChoices = type === 'topic_choices';
	const isDebateSelectionCard = type === 'debate_selection_card';
	const isWhyNarration = type === 'why_narration';
	const debateOptionsRaw = Array.isArray(message?.debateOptions) ? message.debateOptions : null;
	const debateOptions =
		debateOptionsRaw
			?.map((o) => ({
				id: String(o?.id ?? '').trim(),
				label: String(o?.label ?? '').trim()
			}))
			.filter((o) => o.id && o.label) ?? [];
	const isDebateSuggestionList = type === 'debate_suggestion' && debateOptions.length > 0;
	if (type === 'debate_suggestion' && Array.isArray(message?.debateOptions) && debateOptions.length === 0)
		return;
	const rawSegments = Array.isArray(message?.whySegments) ? message.whySegments : null;
	/** @type {{ kind: 'text' | 'model', text?: string, model?: string }[]} */
	const whySegments = isWhyNarration
		? (rawSegments ?? [])
				.map((s) => {
					const kind = s?.kind === 'model' ? 'model' : 'text';
					if (kind === 'model') {
						const m = String(s?.model ?? '').trim();
						return m ? { kind: 'model', model: m } : null;
					}
					const t = String(s?.text ?? '');
					return { kind: 'text', text: t };
				})
				.filter(Boolean)
		: [];
	const textFromSegments =
		isWhyNarration && whySegments.length
			? whySegments
					.map((s) => (s.kind === 'model' ? String(s.model ?? '') : String(s.text ?? '')))
					.join('')
					.trim()
			: '';
	const text = String(message?.text ?? '').trim() || textFromSegments;
	if (
		!isTopicChoices &&
		!isDebateSelectionCard &&
		!text &&
		!(isWhyNarration && whySegments.length) &&
		!isDebateSuggestionList
	)
		return;
	if (isDebateSelectionCard) {
		const did = String(message?.debateId ?? '').trim();
		const models = Array.isArray(message?.suggestedModels)
			? message.suggestedModels.map((m) => String(m ?? '').trim()).filter(Boolean)
			: [];
		if (!did || models.length < 2) return;
	}
	const id =
		String(message?.id ?? '').trim() ||
		`msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	leftTrayFeed.update((messages) => [
		...messages,
		{
			id,
			type,
			text: isDebateSelectionCard ? '' : text,
			model: message?.model ? String(message.model).trim() : undefined,
			whySegments: isWhyNarration && whySegments.length ? whySegments : undefined,
			side: message?.side === 'right' ? 'right' : message?.side === 'left' ? 'left' : undefined,
			gapTop: Boolean(message?.gapTop),
			chunkBreak: Boolean(message?.chunkBreak),
			statementId: message?.statementId ? String(message.statementId).trim() : undefined,
			options: Array.isArray(message?.options)
				? message.options
					.map((o) => ({
						id: String(o?.id ?? '').trim(),
						label: String(o?.label ?? '').trim()
					}))
					.filter((o) => o.id && o.label)
				: undefined,
			debateId: message?.debateId ? String(message.debateId).trim() : undefined,
			suggestedModels: Array.isArray(message?.suggestedModels)
				? message.suggestedModels.map((m) => String(m ?? '').trim()).filter(Boolean)
				: undefined,
			debateOptions: debateOptions.length ? debateOptions : undefined,
			debatePrompt: Boolean(message?.debatePrompt),
			valueStatement: Boolean(message?.valueStatement)
		}
	]);
}

export function resetLeftTrayFeed() {
	leftTrayFeed.set(cloneLeftTrayFeedSeed());
}
