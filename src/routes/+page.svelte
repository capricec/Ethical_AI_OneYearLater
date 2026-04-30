<script>
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import {
		selectedModel,
		selectedModels,
		selectedDebateId,
		selectedDebate,
		selectedDebateSourceItems,
		leftTrayFeed,
		selectedStatementId,
		selectedSubscaleFilter,
		debateTopicOptions,
		radialStatementOrder,
		statementsViz,
		setSelectedModel,
		setSelectedModels,
		setSelectedDebateId,
		setSelectedStatementId,
		setSelectedDebateSourceItemId,
		setDimensionFilter,
		setSubscaleFilter,
		setRadialStatementOrder,
		appendLeftTrayMessage,
		resetLeftTrayFeed,
		setSelectedViewMode,
		VIEW_MODE_DIMENSION_BUMP,
		VIEW_MODE_RADIAL
	} from '$lib/stores/universalState.js';
	import { modelColor } from '$lib/viz/modelColors.js';
	import DimensionAggregateBumpChart from '$lib/viz/DimensionAggregateBumpChart.svelte';
	import StatementsRadialChart from '$lib/viz/StatementsRadialChart.svelte';
	import { statementLabel } from '$lib/ui/statementLabel.js';
	import { questions, statementContext, encoding, debates, debateTranscripts } from '$lib/data/dataset.js';
	import statementModelAveragesRaw from '../../data/statement_model_averages.json';
	import { sliceVizToSingleStatement } from '$lib/data/vizSliceSingleStatement.js';
	import {
		LEFT_TRAY_FEED_MODE,
		LEFT_TRAY_FEED_TIMING,
		LEFT_TRAY_MODEL_RESPONSE_MODE,
		LEFT_TRAY_MODEL_BUBBLE_LAYOUT
	} from '$lib/data/leftTrayFeedSeed.js';
	import {
		getFollowupResponseText,
		followupScaleStepFromConsensus
	} from '$lib/data/followupResponses.js';

	/** @type {Map<string, string>} */
	const STATEMENT_CONTEXT_BY_ID = new Map();
	for (const group of statementContext) {
		for (const it of group.items ?? []) {
			if (it?.item_id) STATEMENT_CONTEXT_BY_ID.set(String(it.item_id), String(it.context ?? ''));
		}
	}
	/** @type {Map<string, { scale: { min: number, max: number, type?: string }, statementValues: { min?: string, max?: string }, item: any }>} */
	const ENCODING_ITEM_BY_ID = new Map();
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
		for (const it of dim?.items ?? []) {
			const itemId = String(it?.item_id ?? '').trim();
			if (!itemId) continue;
			ENCODING_ITEM_BY_ID.set(itemId, { scale, statementValues, item: it });
		}
	}
	const QUESTION_BY_ITEM_ID = new Map(
		(questions ?? []).map((q) => [String(q?.item_id ?? '').trim(), String(q?.question ?? '').trim()])
	);
	const DEBATE_ROWS = Array.isArray(debates)
		? debates
		: Array.isArray(debates?.debates)
			? debates.debates
			: [];
	const DEBATE_CHOICES_BY_STATEMENT_ID = (() => {
		/** @type {Map<string, { id: string, label: string }[]>} */
		const byStatement = new Map();
		for (const d of DEBATE_ROWS) {
			const debateId = String(d?.debate_id ?? '').trim();
			const label = String(d?.question ?? '').trim() || debateId;
			if (!debateId) continue;
			for (const sourceItem of d?.source_items ?? []) {
				const itemId = String(sourceItem ?? '').trim();
				if (!itemId) continue;
				const list = byStatement.get(itemId) ?? [];
				if (!list.some((x) => x.id === debateId)) list.push({ id: debateId, label });
				byStatement.set(itemId, list);
			}
		}
		return byStatement;
	})();
	const DEBATE_BY_ID = new Map(
		DEBATE_ROWS.map((d) => [String(d?.debate_id ?? '').trim(), d]).filter(([id]) => Boolean(id))
	);
	const STATEMENT_AVERAGE_BY_ITEM_MODEL = (() => {
		/** @type {Map<string, { mean_value: number, scale_label: string }>} */
		const map = new Map();
		const rows = Array.isArray(statementModelAveragesRaw?.rows) ? statementModelAveragesRaw.rows : [];
		for (const row of rows) {
			const itemId = String(row?.item_id ?? '').trim();
			const model = String(row?.fund_model ?? '').trim();
			const mean = Number(row?.mean_value);
			const label = String(row?.scale_label ?? '').trim();
			if (!itemId || !model || !Number.isFinite(mean)) continue;
			map.set(`${itemId}::${model}`, { mean_value: mean, scale_label: label });
		}
		return map;
	})();
	const TRANSCRIPT_ROWS = Array.isArray(debateTranscripts?.transcripts)
		? debateTranscripts.transcripts
		: [];
	const TRANSCRIPTS_BY_DEBATE_ID = new Map(
		TRANSCRIPT_ROWS
			.map((row) => [String(row?.debate_id ?? '').trim(), row])
			.filter(([id]) => Boolean(id))
	);

	/** @param {string} model */
	function normalizeModelKey(model) {
		return String(model ?? '')
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '');
	}

	/** @param {string} model */
	function displayModelFromTranscript(model) {
		const key = normalizeModelKey(model);
		if (key === 'claude') return 'Claude';
		if (key === 'grok') return 'Grok';
		return String(model ?? '').trim();
	}

	/** @param {string[]} pickedModels */
	function isClaudeVsGrokPair(pickedModels) {
		const keys = new Set(pickedModels.map((m) => normalizeModelKey(m)));
		return keys.size === 2 && keys.has('claude') && keys.has('grok');
	}

	/** Fixed context / subscale rail (matches left tray width). */
	/** Dimension pills removed for now; avoid a stuck dimension-only filter. */
	onMount(() => {
		setDimensionFilter(null);
		resetLeftTrayFeed();
	});

	let chartWidth = $state(0);
	let radialCellW = $state(0);
	let radialCellH = $state(0);
	let leftTrayFeedEl = $state(/** @type {HTMLDivElement | null} */ (null));
	let feedSequenceToken = 0;
	let hasUsedBottomControls = $state(false);
	let leftTrayControlsCollapsed = $state(false);
	/** Bump statement view: flex slot height so the SVG row fills the viewport. */
	let statementBumpSlotH = $state(0);

	/** @param {number} ms */
	function waitMs(ms) {
		const delay = Math.max(0, Number(ms) || 0);
		return new Promise((resolve) => setTimeout(resolve, delay));
	}

	$effect(() => {
		$leftTrayFeed;
		tick().then(() => {
			if (!leftTrayFeedEl) return;
			leftTrayFeedEl.scrollTop = leftTrayFeedEl.scrollHeight;
		});
	});

	/** @param {unknown} k */
	function normSubscaleKey(k) {
		const s = String(k ?? '').trim();
		return s || '__none__';
	}

	/** Bump: filters the statement list. Radial: same store drives highlight only (viz does not filter). */
	function toggleSubscaleSelection(key) {
		const cur = get(selectedSubscaleFilter);
		const next = normSubscaleKey(cur) === normSubscaleKey(key) ? null : key;
		setSubscaleFilter(next);
	}

	/** @param {string} subscaleKey */
	function handleRadialSubscaleClick(subscaleKey) {
		if (!hasUsedBottomControls) leftTrayControlsCollapsed = true;
		toggleSubscaleSelection(subscaleKey);
	}

	/** Bottom-tray topic selector (phase 2): debate topic from `debates.json`. */
	function handleDebateTopicChange(/** @type {Event} */ e) {
		hasUsedBottomControls = true;
		leftTrayControlsCollapsed = false;
		const value = String(/** @type {HTMLSelectElement} */ (e.currentTarget)?.value ?? '').trim();
		setSelectedDebateId(value || null);
		setSelectedDebateSourceItemId(null);
		setSelectedStatementId(null);
	}

	/** Bottom-tray model selector (phase 2): multi-select store with single-model compatibility bridge. */
	function handleModelToggle(/** @type {string} */ model) {
		hasUsedBottomControls = true;
		leftTrayControlsCollapsed = false;
		const current = Array.isArray($selectedModels) ? [...$selectedModels] : [];
		/** `[]` means all models visible; first click isolates one model. */
		let next;
		if (current.length === 0) next = [model];
		else if (current.includes(model)) next = current.filter((m) => m !== model);
		else next = [...current, model];
		setSelectedModels(next);
		if (next.length === 1) setSelectedModel(next[0]);
		else setSelectedModel(null);
	}

	$effect(() => {
		const id = $selectedStatementId;
		const hasStatement = id != null && String(id).trim() !== '';
		setSelectedViewMode(hasStatement ? VIEW_MODE_DIMENSION_BUMP : VIEW_MODE_RADIAL);
	});

	/** @param {string | null} itemId */
	function applyStatementSelection(itemId) {
		if (itemId == null || itemId === '') {
			setSelectedStatementId(null);
			return;
		}
		setSelectedStatementId(itemId);
	}

	/** Same toggle behavior as the statement list in the left tray. */
	function handleRadialStatementSelect(/** @type {string} */ itemId) {
		if (!hasUsedBottomControls) leftTrayControlsCollapsed = true;
		const id = String(itemId ?? '').trim();
		if (!id) return;
		const next = $selectedStatementId === id ? null : id;
		if (next) {
			setSelectedDebateSourceItemId(next);
			applyStatementSelection(next);
			appendFeedForSelectedStatement(next);
		} else {
			setSelectedDebateSourceItemId(null);
			setSelectedStatementId(null);
		}
	}

	/** @param {string} itemId */
	async function appendFeedForSelectedStatement(itemId) {
		const token = ++feedSequenceToken;
		if (String($selectedDebateId ?? '').trim()) return;
		const viz = $statementsViz;
		if (!viz?.dim?.items?.length || !viz.modelSeries?.length) return;
		const idx = viz.dim.items.findIndex((it) => String(it?.item_id ?? '').trim() === itemId);
		if (idx < 0) return;
		const item = viz.dim.items[idx];
		const narratorQuestion =
			statementLabel(item) ||
			QUESTION_BY_ITEM_ID.get(itemId) ||
			fullSurveyQuestionForStatement(itemId);
		if (narratorQuestion) {
			await waitMs(LEFT_TRAY_FEED_TIMING.beforeNarrationMs);
			if (token !== feedSequenceToken) return;
			appendLeftTrayMessage({
				type: 'section_title',
				gapTop: true,
				chunkBreak: true,
				text: 'Value Statement'
			});
			appendLeftTrayMessage({
				type: 'narration',
				gapTop: true,
				text: narratorQuestion
			});
		}

		if (LEFT_TRAY_FEED_MODE === 'topic_choices') {
			const options = DEBATE_CHOICES_BY_STATEMENT_ID.get(itemId) ?? [];
			if (options.length) {
				await waitMs(LEFT_TRAY_FEED_TIMING.narrationToModelsMs);
				if (token !== feedSequenceToken) return;
				appendLeftTrayMessage({
					type: 'topic_choices',
					text: 'Choose a debate topic for this statement:',
					statementId: itemId,
					options
				});
			}
			return;
		}

		const selected = Array.isArray($selectedModels)
			? Array.from(new Set($selectedModels.map((m) => String(m ?? '').trim()).filter(Boolean)))
			: [];
		const visibleSeries =
			selected.length > 0
				? viz.modelSeries.filter((s) => selected.includes(String(s?.fundModel ?? '').trim()))
				: viz.modelSeries;

		await waitMs(LEFT_TRAY_FEED_TIMING.narrationToModelsMs);
		if (token !== feedSequenceToken) return;

		for (let i = 0; i < visibleSeries.length; i++) {
			const ms = visibleSeries[i];
			const model = String(ms?.fundModel ?? '').trim();
			if (!model) continue;
			const avgRow = STATEMENT_AVERAGE_BY_ITEM_MODEL.get(`${itemId}::${model}`);
			const mean = Number(ms?.itemMeans?.[idx]);
			const step = followupScaleStepFromConsensus(mean, item);
			const scaleLabel = statementScaleLabelForMean(mean, item);
			const meanForDisplay = Number.isFinite(avgRow?.mean_value) ? avgRow.mean_value : mean;
			const scaleLabelForDisplay = avgRow?.scale_label ? avgRow.scale_label : scaleLabel;
			const response =
				LEFT_TRAY_MODEL_RESPONSE_MODE === 'average_value'
					? `Average Response: ${Number.isFinite(meanForDisplay) ? meanForDisplay.toFixed(2) : 'n/a'}${scaleLabelForDisplay ? ` ${scaleLabelForDisplay}` : ''}`
					: getFollowupResponseText(itemId, step, model) ||
						`Average Response: ${Number.isFinite(meanForDisplay) ? meanForDisplay.toFixed(2) : 'n/a'}${scaleLabelForDisplay ? ` ${scaleLabelForDisplay}` : ''}`;
			appendLeftTrayMessage({
				type: 'model',
				model,
				side: i % 2 === 0 ? 'left' : 'right',
				text: response
			});
			if (i < visibleSeries.length - 1) {
				await waitMs(LEFT_TRAY_FEED_TIMING.betweenModelMessagesMs);
				if (token !== feedSequenceToken) return;
			}
		}

		if (String($selectedDebateId ?? '').trim()) return;
		const debateOptions = DEBATE_CHOICES_BY_STATEMENT_ID.get(itemId) ?? [];
		if (!debateOptions.length || viz.modelSeries.length < 2) return;
		const debateChoice = debateOptions[0];
		const debatePrompt = debateChoice?.label;
		if (!debatePrompt || !debateChoice?.id) return;

		let widestPair = null;
		for (let a = 0; a < viz.modelSeries.length; a++) {
			for (let b = a + 1; b < viz.modelSeries.length; b++) {
				const mA = viz.modelSeries[a];
				const mB = viz.modelSeries[b];
				const vA = Number(mA?.itemMeans?.[idx]);
				const vB = Number(mB?.itemMeans?.[idx]);
				if (!Number.isFinite(vA) || !Number.isFinite(vB)) continue;
				const gap = Math.abs(vA - vB);
				if (!widestPair || gap > widestPair.gap) {
					widestPair = {
						leftModel: String(mA?.fundModel ?? ''),
						rightModel: String(mB?.fundModel ?? ''),
						gap
					};
				}
			}
		}
		if (!widestPair?.leftModel || !widestPair?.rightModel) return;

		await waitMs(LEFT_TRAY_FEED_TIMING.betweenModelMessagesMs);
		if (token !== feedSequenceToken) return;
		appendLeftTrayMessage({
			type: 'debate_suggestion',
			gapTop: true,
			chunkBreak: true,
			text:
				`Suggested debate question: ${debatePrompt}\n` +
				`Biggest disagreement on this statement: ${widestPair.leftModel} vs ${widestPair.rightModel}.`,
			debateId: debateChoice.id,
			suggestedModels: [widestPair.leftModel, widestPair.rightModel]
		});
	}

	function goToRadialRoot() {
		setSelectedStatementId(null);
		setSelectedDebateSourceItemId(null);
		setSelectedDebateId(null);
	}

	function goToDebateStatements() {
		setSelectedStatementId(null);
	}

	/** @param {string} topicId @param {string} statementId */
	function handleFeedTopicChoice(topicId, statementId) {
		const debateId = String(topicId ?? '').trim();
		if (!debateId) return;
		feedSequenceToken += 1;
		setSelectedDebateId(debateId);
		setSelectedDebateSourceItemId(null);
		setSelectedStatementId(null);
		appendLeftTrayMessage({
			type: 'narration',
			gapTop: true,
			text: 'Pick which models you want to debate.'
		});
	}

	/** @param {{ debateId?: string, suggestedModels?: string[] } | null | undefined} suggestion */
	function handleDebateSuggestion(suggestion) {
		const debateId = String(suggestion?.debateId ?? '').trim();
		if (!debateId) return;
		const models = Array.isArray(suggestion?.suggestedModels)
			? suggestion.suggestedModels.map((m) => String(m ?? '').trim()).filter(Boolean)
			: [];
		feedSequenceToken += 1;
		setSelectedDebateId(debateId);
		setSelectedDebateSourceItemId(null);
		setSelectedStatementId(null);
		setSelectedModels(models);
		if (models.length === 1) setSelectedModel(models[0]);
		else setSelectedModel(null);
		if (models.length === 2) {
			handleDebateStart({ debateId, models });
		}
	}

	/** @param {{ debateId?: string, models?: string[] }=} opts */
	async function handleDebateStart(opts = {}) {
		const debateId =
			String(opts?.debateId ?? '').trim() || String($selectedDebateId ?? '').trim();
		const pickedModels = Array.isArray(opts?.models)
			? opts.models.map((m) => String(m ?? '').trim()).filter(Boolean)
			: Array.isArray($selectedModels)
				? $selectedModels.map((m) => String(m ?? '').trim()).filter(Boolean)
				: [];
		if (!debateId || pickedModels.length !== 2) return;
		hasUsedBottomControls = true;
		leftTrayControlsCollapsed = true;
		const scenario = String(DEBATE_BY_ID.get(debateId)?.scenario ?? '').trim();
		const question = String(DEBATE_BY_ID.get(debateId)?.question ?? '').trim();
		appendLeftTrayMessage({
			type: 'section_title',
			gapTop: true,
			chunkBreak: true,
			text: 'Debate'
		});
		const scenarioAndQuestion = [scenario, question].filter(Boolean).join('\n\n');
		if (scenarioAndQuestion) {
			appendLeftTrayMessage({
				type: 'narration',
				gapTop: true,
				text: scenarioAndQuestion
			});
		}
		appendLeftTrayMessage({
			type: 'narration',
			text: 'Let the debate begin!'
		});

		if (!isClaudeVsGrokPair(pickedModels)) return;
		const transcript = TRANSCRIPTS_BY_DEBATE_ID.get(debateId);
		const turns = Array.isArray(transcript?.turns) ? transcript.turns : [];
		if (!turns.length) return;
		const leftModelKey = normalizeModelKey(pickedModels[0]);
		const transcriptSectionTitleByStep = new Map([
			[1, 'OPENING POSITIONS'],
			[3, 'VALUE CHALLENGE'],
			[5, 'THRESHOLD CHALLENGE']
		]);
		await waitMs(LEFT_TRAY_FEED_TIMING.narrationToModelsMs);
		for (let i = 0; i < turns.length; i++) {
			const turn = turns[i];
			const response = String(turn?.response ?? '').trim();
			const model = displayModelFromTranscript(String(turn?.model ?? ''));
			const step = Number(turn?.step);
			const sectionTitle = transcriptSectionTitleByStep.get(step);
			if (sectionTitle) {
				appendLeftTrayMessage({
					type: 'section_title',
					gapTop: step === 1,
					text: sectionTitle
				});
			}
			if (!response || !model) continue;
			const side = normalizeModelKey(model) === leftModelKey ? 'left' : 'right';
			appendLeftTrayMessage({
				type: 'model',
				model,
				side,
				text: response
			});
			if (i < turns.length - 1) {
				await waitMs(LEFT_TRAY_FEED_TIMING.betweenModelMessagesMs);
			}
		}
	}

	/** Stable `id` per statement tray row (scroll into view). */
	function trayStatementRowId(/** @type {unknown} */ itemId) {
		return `tray-statement-${String(itemId ?? '')
			.trim()
			.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
	}

	$effect(() => {
		const id = $selectedStatementId;
		if (id == null || String(id).trim() === '') return;
		const domId = trayStatementRowId(id);
		tick().then(() => {
			const el = document.getElementById(domId);
			el?.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' });
		});
	});

	/** Subscale filter hides non-matching questions; clear statement if it falls outside the filter. */
	$effect(() => {
		const viz = $statementsViz;
		const sub = $selectedSubscaleFilter;
		const id = $selectedStatementId;
		if (!viz || id == null || String(id).trim() === '') return;
		if (sub == null || String(sub).trim() === '') return;
		const listed = questionItemsForSubscaleFilter(viz, sub, questions);
		if (!listed.some((q) => q.item_id === id)) setSelectedStatementId(null);
	});

	/**
	 * Left-tray statement list: ordered by cross-model divergence (high → low).
	 * Only filters by **subscale** when a subscale is chosen; statement selection
	 * never hides other rows (the selected one just scrolls into view).
	 * @param {{ dim?: { items?: { item_id: string, subscaleKey?: string }[] }, statementDivergence?: { item_id: string, divergence: number }[] } | null | undefined} viz
	 * @param {string | null} subscaleF
	 */
	function trayStatementItems(viz, subscaleF) {
		if (!viz?.dim?.items?.length) return [];
		const divMap = new Map(
			(viz.statementDivergence ?? []).map((d) => [
				d.item_id,
				typeof d.divergence === 'number' && !Number.isNaN(d.divergence) ? d.divergence : 0
			])
		);
		const filtered = viz.dim.items.filter((it) => {
			if (subscaleF != null && String(subscaleF).trim() !== '')
				return normSubscaleKey(it.subscaleKey) === normSubscaleKey(subscaleF);
			return true;
		});
		return [...filtered].sort(
			(a, b) => (divMap.get(b.item_id) ?? 0) - (divMap.get(a.item_id) ?? 0)
		);
	}

	/**
	 * Question bar list: same subscale membership as the tray when a subscale is selected.
	 * @param {{ dim?: { items?: { item_id: string, subscaleKey?: string }[] } } | null | undefined} viz
	 * @param {string | null} subscaleF
	 * @param {{ item_id: string, question: string }[]} allQuestions
	 */
	function questionItemsForSubscaleFilter(viz, subscaleF, allQuestions) {
		if (!viz?.dim?.items?.length) return allQuestions;
		if (subscaleF == null || String(subscaleF).trim() === '') return allQuestions;
		const want = normSubscaleKey(subscaleF);
		const allowed = new Set(
			viz.dim.items
				.filter((it) => normSubscaleKey(it.subscaleKey) === want)
				.map((it) => String(it.item_id))
		);
		return allQuestions.filter((q) => allowed.has(String(q.item_id)));
	}

	/**
	 * Radial debate mode: keep only source statements, in debate-provided order.
	 * @param {import('$lib/data/computeStatementsViz.js').StatementsViz | null | undefined} viz
	 * @param {string[]} orderedItemIds
	 */
	function sliceVizToOrderedItems(viz, orderedItemIds) {
		if (!viz?.dim?.items?.length) return viz ?? null;
		const ids = Array.isArray(orderedItemIds)
			? orderedItemIds.map((id) => String(id ?? '').trim()).filter(Boolean)
			: [];
		if (!ids.length) return viz;
		const byId = new Map(viz.dim.items.map((it, i) => [String(it.item_id), i]));
		const keep = ids.map((id) => byId.get(id)).filter((i) => Number.isInteger(i));
		if (!keep.length) return viz;
		const itemExtents = keep.map((i) => viz.itemExtents[i]);
		const dimItems = keep.map((i) => viz.dim.items[i]);
		const modelSeries = viz.modelSeries.map((ms) => ({
			...ms,
			itemMeans: keep.map((i) => ms.itemMeans[i]),
			itemDistributions: Array.isArray(ms.itemDistributions)
				? keep.map((i) => ms.itemDistributions[i])
				: ms.itemDistributions
		}));
		const statementDivergence = (viz.statementDivergence ?? []).filter((d) =>
			ids.includes(String(d.item_id))
		);
		return {
			...viz,
			dim: { ...viz.dim, items: dimItems },
			itemExtents,
			modelSeries,
			statementDivergence
		};
	}

	/** @param {string | null} statementId */
	function fullSurveyQuestionForStatement(statementId) {
		const key = String(statementId ?? '').trim();
		if (!key) return '';
		const row = ENCODING_ITEM_BY_ID.get(key);
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

	/** @param {string} question */
	function formatSurveyQuestionForDisplay(question) {
		const input = String(question ?? '').trim();
		if (!input) return '';
		return input.replace(/how would you rate:?\s*/i, 'how would you rate:\n');
	}

	/**
	 * @param {number} meanDisplayValue
	 * @param {{ statement_scale?: string[], scaleMin?: unknown, scaleMax?: unknown, reverse?: unknown }} item
	 */
	function statementScaleLabelForMean(meanDisplayValue, item) {
		const scale = Array.isArray(item?.statement_scale)
			? item.statement_scale.map((s) => String(s ?? '').trim()).filter(Boolean)
			: [];
		if (!scale.length) return '';
		const step = followupScaleStepFromConsensus(meanDisplayValue, item);
		const lo = Math.min(Number(item?.scaleMin), Number(item?.scaleMax));
		if (!Number.isFinite(lo)) return '';
		const idx = Math.max(0, Math.min(scale.length - 1, step - lo));
		return scale[idx] ?? '';
	}

	/**
	 * @param {import('$lib/data/debatesAdapter.js').DebateRecord | null | undefined} debate
	 * @param {string | null} statementId
	 */
	function primaryTensionForStatement(debate, statementId) {
		const id = String(statementId ?? '').trim();
		if (!debate || !id) return '';
		const src = Array.isArray(debate.source_items) ? debate.source_items.map((s) => String(s)) : [];
		const idx = src.indexOf(id);
		if (idx < 0) return '';
		const tensions = Array.isArray(debate.tensions)
			? debate.tensions.map((t) => String(t ?? '').trim())
			: Array.isArray(debate.primary_tensions)
				? debate.primary_tensions.map((t) => String(t ?? '').trim())
			: [];
		return tensions[idx] ?? tensions[0] ?? '';
	}

	/** @param {any} item */
	function navLabelForSelectedStatement(item) {
		const t = String(item?.tension ?? '').trim();
		if (t) return t;
		return statementLabel(item);
	}
</script>

<svelte:head>
	<title>Ethical AI — One Year Later</title>
</svelte:head>

<div class="min-h-screen overflow-x-hidden bg-slate-100 text-slate-900">
	<div class="">
		{#if $statementsViz}
			{@const isStatementView =
				$selectedStatementId != null && String($selectedStatementId).trim() !== ''}
			<!-- Desktop: radial was filling the column too tightly; mobile sizing unchanged. -->
			{@const rawRadialSquare = Math.max(
				260,
				Math.floor(
					Math.min(Math.max(radialCellW, 1) - 16, Math.max(radialCellH, 1) - 16)
				)
			)}
			<!-- Desktop: modest shrink vs full cell (half of the prior 10% step → 5%). -->
			{@const radialSquare =
				radialCellW >= 768
					? Math.max(260, Math.floor(rawRadialSquare * 0.95))
					: rawRadialSquare}
			{@const radialViz = sliceVizToOrderedItems($statementsViz, $selectedDebateSourceItems)}
			{@const visibleModels = $statementsViz.modelSeries.map((m) => m.fundModel)}
			{@const allModelsShowing =
				$selectedModels.length === 0 || $selectedModels.length === visibleModels.length}
			{@const selectedDebateTensions = Array.isArray($selectedDebate?.tensions)
				? $selectedDebate.tensions.map((t) => String(t ?? '').trim()).filter(Boolean)
				: Array.isArray($selectedDebate?.primary_tensions)
					? $selectedDebate.primary_tensions.map((t) => String(t ?? '').trim()).filter(Boolean)
				: []}
			{@const latestDebateSuggestion =
				[...$leftTrayFeed].reverse().find((m) => m?.type === 'debate_suggestion') ?? null}
			{@const selectedSurveyQuestion = fullSurveyQuestionForStatement($selectedStatementId)}
			{@const selectedSurveyQuestionDisplay = formatSurveyQuestionForDisplay(selectedSurveyQuestion)}
			{@const selectedPrimaryTension = primaryTensionForStatement(
				$selectedDebate,
				$selectedStatementId
			)}
			{@const bumpViz = $selectedStatementId
				? sliceVizToSingleStatement($statementsViz, $selectedStatementId)
				: null}
			<!-- Min row height must fit all model heatmap/timeline rows (matches compact vs desktop spacing in DimensionAggregateBumpChart). -->
			<!-- Matches compact detailTopPad + model rows + heatmap bar (see DimensionAggregateBumpChart). -->
			<!-- Extra room for follow-up speech bubble above the bump chart (see DimensionAggregateBumpChart). -->
			{@const stmtDetailMinH = bumpViz
				? chartWidth === 0 || chartWidth < 768
					? 95 + bumpViz.modelSeries.length * 54 + 100
					: 214 + bumpViz.modelSeries.length * 100 + 100
				: 0}
			{@const bumpSingleRowHeights = bumpViz
				? [Math.max(statementBumpSlotH > 0 ? statementBumpSlotH : 360, stmtDetailMinH)]
				: []}

			<div
				class="flex h-[100vh] min-h-0 flex-col overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-300"
			>
				<div class="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden">
					<!-- Dashboard left tray: selector stack anchored to bottom (text panel not in scope). -->
					<aside
						class="box-border flex w-full max-w-full shrink-0 flex-col overflow-hidden border-t border-slate-600 bg-[#3B3A3A] order-2 md:order-1 h-[35vh] md:h-auto md:w-[35vw] md:min-w-[400px] md:max-w-[35vw] md:border-r md:border-t-0"
					>
						<div class="flex min-h-0 flex-1 flex-col">
							<div
								class="min-h-0 flex-1 overflow-y-auto space-y-3 bg-[#3B3A3A] px-4 py-4"
								bind:this={leftTrayFeedEl}
							>
								{#each $leftTrayFeed as message, idx (message.id)}
									<div class:mt-6={idx === 0 || message.gapTop} class:mt-10={message.chunkBreak}>
										{#if message.chunkBreak && idx > 0}
											<div class="mb-4 h-px w-full bg-white/20"></div>
										{/if}
										{#if message.type === 'narration'}
											<p class="px-2 text-center text-sm leading-relaxed text-white">
												{message.text}
											</p>
										{:else if message.type === 'section_title'}
											<p class="mt-[10px] text-center text-xs font-semibold uppercase tracking-wide text-slate-200">
												{message.text}
											</p>
										{:else if message.type === 'topic_choices'}
											<div class="space-y-2 px-2">
												<p class="text-center text-sm leading-relaxed text-white">
													{message.text}
												</p>
												{#each message.options ?? [] as option (option.id)}
													<button
														type="button"
														class="w-full rounded-md border border-slate-400/40 bg-[#4b4b4e] px-3 py-2 text-left text-xs font-medium text-white hover:bg-[#5a5a5d]"
														onclick={() =>
															handleFeedTopicChoice(
																option.id,
																String(message.statementId ?? '')
															)}
													>
														{option.label}
													</button>
												{/each}
											</div>
										{:else if message.type === 'debate_suggestion'}
											{@const leftModel = String(message.suggestedModels?.[0] ?? '')}
											{@const rightModel = String(message.suggestedModels?.[1] ?? '')}
											<div class="space-y-2 px-2">
												<p class="text-center text-xs font-semibold uppercase tracking-wide text-slate-200">
													Suggested Debate
												</p>
												<div
													class="h-11 w-full rounded-md bg-[#4b4b4e] px-3 text-sm text-white flex items-center"
												>
													{String(
														DEBATE_BY_ID.get(String(message.debateId ?? ''))?.question ??
															''
													)}
												</div>
												<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
													<button
														type="button"
														class="min-w-0 rounded-md px-2 py-1.5 text-xs font-semibold text-white"
														style={leftModel
															? `background-color: ${modelColor(leftModel)};`
															: 'background-color: #7a7a7a;'}
													>
														{leftModel || 'Model 1'}
													</button>
													<span class="text-xs font-semibold uppercase tracking-wide text-slate-300">
														vs.
													</span>
													<button
														type="button"
														class="min-w-0 rounded-md px-2 py-1.5 text-xs font-semibold text-white"
														style={rightModel
															? `background-color: ${modelColor(rightModel)};`
															: 'background-color: #7a7a7a;'}
													>
														{rightModel || 'Model 2'}
													</button>
												</div>
												<button
													type="button"
													class="h-11 w-full rounded-md bg-[#4b4b4e] px-3 text-center text-sm font-bold tracking-wide text-white hover:bg-[#5a5a5d]"
													onclick={() => handleDebateSuggestion(message)}
												>
													DEBATE
												</button>
											</div>
										{:else}
											<div
												class="flex w-full"
												class:justify-center={LEFT_TRAY_MODEL_BUBBLE_LAYOUT === 'center'}
												class:justify-end={LEFT_TRAY_MODEL_BUBBLE_LAYOUT !== 'center' && message.side === 'right'}
												class:justify-start={LEFT_TRAY_MODEL_BUBBLE_LAYOUT !== 'center' && message.side !== 'right'}
											>
												<div
													class="w-[90%] rounded-2xl bg-[#4b4b4e] px-3 py-2 text-sm leading-relaxed text-white shadow-sm"
												>
													{#if message.model}
														<p
															class="mb-1 text-[10px] font-semibold uppercase tracking-wide"
															style={`color: ${modelColor(message.model)};`}
														>
															{message.model}
														</p>
													{/if}
													<p>{message.text}</p>
												</div>
											</div>
										{/if}
									</div>
								{/each}
							</div>
							<div class="shrink-0 border-t border-slate-500 bg-[#5F5F5F] px-4 pb-4 pt-3 text-white">
								<button
									type="button"
									class="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-slate-200"
									onclick={() => (leftTrayControlsCollapsed = !leftTrayControlsCollapsed)}
								>
									<span>CREATE YOUR OWN DEBATE</span>
									<span
										aria-hidden="true"
										class="text-xl leading-none transition-transform {leftTrayControlsCollapsed
											? ''
											: 'rotate-180'}"
									>
										⌄
									</span>
								</button>
								{#if !leftTrayControlsCollapsed}
									<div class="mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-200">
										Topic
									</div>
									<select
										class="mt-3 h-11 w-full rounded-md bg-[#3B3A3A] px-3 pr-10 text-sm text-white outline-none"
										value={$selectedDebateId ?? ''}
										onchange={handleDebateTopicChange}
									>
										<option value="">Select a debate topic</option>
										{#each $debateTopicOptions as topic (topic.id)}
											<option value={topic.id}>{topic.label}</option>
										{/each}
									</select>
									<div class="mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-200">
										Models (pick 2)
									</div>
									<div class="mt-3 flex flex-nowrap gap-2">
										{#each visibleModels as model (model)}
											{@const active = allModelsShowing || $selectedModels.includes(model)}
											<button
												type="button"
												class="min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs font-semibold text-white transition-opacity {active
													? 'opacity-100'
													: 'bg-[#7a7a7a] opacity-55 hover:opacity-75'}"
												style={active ? `background-color: ${modelColor(model)};` : ''}
												onclick={() => handleModelToggle(model)}
											>
												{model}
											</button>
										{/each}
									</div>
									<button
										type="button"
										class="mt-5 h-11 w-full rounded-md bg-[#3B3A3A] px-3 text-sm font-bold tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#4b4b4e]"
										disabled={!$selectedDebateId || $selectedModels.length !== 2}
										onclick={handleDebateStart}
									>
										DEBATE
									</button>
								{/if}
							</div>
						</div>
					</aside>

					<div
						class="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-white order-1 md:order-2 h-[65vh] md:h-auto"
					>
						{#if isStatementView || $selectedDebateId}
							<header class="shrink-0 bg-white px-4 pb-2 pt-3 md:px-6 md:pt-4">
								<div class="mx-auto w-full max-w-[min(100%,calc(72rem-40px))]">
									<div class="flex flex-wrap items-center gap-2">
										{#if $selectedDebateId}
											<button
												type="button"
												class="inline-flex items-center gap-2 rounded-md border border-slate-500 bg-[#3B3A3A] px-3 py-1 text-xs font-semibold text-white"
												onclick={goToRadialRoot}
												aria-label="Clear selected debate"
											>
												<span>{String($selectedDebate?.question ?? $selectedDebateId)}</span>
												<span aria-hidden="true">×</span>
											</button>
										{/if}
										{#if isStatementView && bumpViz?.dim?.items?.[0]}
											<button
												type="button"
												class="inline-flex items-center gap-2 rounded-md border border-slate-500 bg-[#3B3A3A] px-3 py-1 text-xs font-semibold text-white"
												onclick={goToDebateStatements}
												aria-label="Clear selected statement"
											>
												<span>{navLabelForSelectedStatement(bumpViz.dim.items[0])}</span>
												<span aria-hidden="true">×</span>
											</button>
										{/if}
									</div>
								</div>
								{#if isStatementView && selectedSurveyQuestion}
									<div class="mx-auto mt-5 mb-6 w-full max-w-[min(100%,calc(72rem-40px))] rounded-md border border-slate-300 bg-slate-100 px-4 py-4 text-center text-sm text-slate-800 shadow-sm whitespace-pre-line">
										{selectedSurveyQuestionDisplay}
									</div>
								{/if}
							</header>
						{/if}

						<div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
							{#if isStatementView}
								{#if bumpViz}
									<div
										class="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-y-auto overflow-x-hidden bg-white -mt-1.5 md:mt-0"
									>
										<div
											class="mx-auto box-border flex min-h-0 min-w-0 w-full max-w-[min(100%,calc(72rem-40px))] flex-1 flex-col px-4 pb-2 pt-0 md:pb-4 md:pt-3"
										>
											<h2
												class="hidden"
											>
												{statementLabel(bumpViz.dim.items[0])}
											</h2>
											<div
												bind:clientWidth={chartWidth}
												bind:clientHeight={statementBumpSlotH}
												class="box-border flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col self-stretch"
											>
												<DimensionAggregateBumpChart
													width={Math.max(chartWidth, 280)}
													viz={bumpViz}
													selectedModel={$selectedModel}
													selectedModels={$selectedModels}
													showFollowupText={false}
													showFollowupLine={false}
													selectedStatementId={$selectedStatementId}
													rowHeights={bumpSingleRowHeights}
													highlightSubscaleKey={$selectedSubscaleFilter}
													onSelectModel={setSelectedModel}
												/>
											</div>
										</div>
									</div>
								{:else}
									<div
										class="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-500"
									>
										Choose a question above or a statement on the left to see model responses.
									</div>
								{/if}
							{:else}
								<div
									bind:clientWidth={radialCellW}
									bind:clientHeight={radialCellH}
									class="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white p-2"
								>
									<div class="relative min-h-0 w-full flex-1">
										<StatementsRadialChart
											width={radialSquare}
											height={radialSquare}
											viz={radialViz}
											selectedModel={$selectedModel}
											selectedModels={$selectedModels}
											debatePrimaryTensions={selectedDebateTensions}
											radialSortMode={$radialStatementOrder}
											onRadialSortModeChange={setRadialStatementOrder}
											highlightSubscaleKey={$selectedSubscaleFilter}
											onSubscaleWedgeClick={handleRadialSubscaleClick}
											onStatementSelect={handleRadialStatementSelect}
										/>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{:else}
			<p class="p-4 text-sm text-slate-500">No data.</p>
		{/if}
	</div>
</div>

