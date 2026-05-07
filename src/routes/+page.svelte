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
		// Reset to "all models" state when exiting debate via header close.
		setSelectedModels([]);
		setSelectedModel(null);
		leftTrayControlsCollapsed = false;
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
		const feed = get(leftTrayFeed);
		const lastMsg = feed.length ? feed[feed.length - 1] : null;
		const fromLastFeedSuggestion =
			lastMsg?.type === 'debate_suggestion' &&
			String(lastMsg?.debateId ?? '').trim() === debateId;
		setSelectedDebateId(debateId);
		setSelectedDebateSourceItemId(null);
		setSelectedStatementId(null);
		setSelectedModels(models);
		if (models.length === 1) setSelectedModel(models[0]);
		else setSelectedModel(null);
		if (models.length === 2) {
			handleDebateStart({ debateId, models, fromLastFeedSuggestion });
		}
	}

	/** @param {string=} preferredDebateId */
	function handleRandomizedDebateStart(preferredDebateId) {
		const topicOptions = Array.isArray($debateTopicOptions) ? $debateTopicOptions : [];
		const fallbackDebateId = String($selectedDebateId ?? '').trim();
		const preferred = String(preferredDebateId ?? '').trim();
		const debateId =
			preferred ||
			(fallbackDebateId
				? fallbackDebateId
				: topicOptions.length
					? String(topicOptions[Math.floor(Math.random() * topicOptions.length)]?.id ?? '').trim()
					: '');
		const allModels = Array.isArray($statementsViz?.modelSeries)
			? $statementsViz.modelSeries
					.map((m) => String(m?.fundModel ?? '').trim())
					.filter(Boolean)
			: [];
		const deduped = Array.from(new Set(allModels));
		if (!debateId || deduped.length < 2) return;
		const firstIdx = Math.floor(Math.random() * deduped.length);
		let secondIdx = Math.floor(Math.random() * (deduped.length - 1));
		if (secondIdx >= firstIdx) secondIdx += 1;
		const models = [deduped[firstIdx], deduped[secondIdx]];
		setSelectedDebateId(debateId);
		setSelectedDebateSourceItemId(null);
		setSelectedStatementId(null);
		setSelectedModels(models);
		setSelectedModel(null);
		handleDebateStart({ debateId, models });
	}

	/** @param {string} s */
	function titleCaseTensionLabel(s) {
		const t = String(s ?? '').trim();
		if (!t) return '';
		return t
			.split(/\s+/)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
			.join(' ');
	}

	/**
	 * Debate WHY summary based on average positions (same data as radial spikes).
	 * One prioritized tension per model; narrator line with colored model names in UI.
	 * @param {import('$lib/data/debatesAdapter.js').DebateRecord | undefined} debate
	 * @param {string} modelA
	 * @param {string} modelB
	 * @returns {{ text: string, whySegments: { kind: 'text' | 'model', text?: string, model?: string }[] } | null}
	 */
	function buildWhySummariesForDebate(debate, modelA, modelB) {
		if (!debate) return null;
		const sourceItems = Array.isArray(debate.source_items)
			? debate.source_items.map((s) => String(s ?? '').trim()).filter(Boolean)
			: [];
		const tensions = Array.isArray(debate.tensions)
			? debate.tensions.map((t) => String(t ?? '').trim())
			: Array.isArray(debate.primary_tensions)
				? debate.primary_tensions.map((t) => String(t ?? '').trim())
				: [];
		if (!sourceItems.length || !tensions.length) return null;

		/** @type {{ id: string, label: string, a: number, b: number, mid: number, scaleLabelA: string, scaleLabelB: string }[]} */
		const rows = [];
		for (let i = 0; i < sourceItems.length && i < tensions.length; i += 1) {
			const itemId = sourceItems[i];
			const label = tensions[i] || itemId;
			const keyA = `${itemId}::${modelA}`;
			const keyB = `${itemId}::${modelB}`;
			const avgA = STATEMENT_AVERAGE_BY_ITEM_MODEL.get(keyA);
			const avgB = STATEMENT_AVERAGE_BY_ITEM_MODEL.get(keyB);
			const a = Number(avgA?.mean_value);
			const b = Number(avgB?.mean_value);
			if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
			const scaleLabelA = String(avgA?.scale_label ?? '').trim();
			const scaleLabelB = String(avgB?.scale_label ?? '').trim();
			const encodingMeta = ENCODING_ITEM_BY_ID.get(itemId);
			const sMin = Number(encodingMeta?.scale?.min);
			const sMax = Number(encodingMeta?.scale?.max);
			const mid = Number.isFinite(sMin) && Number.isFinite(sMax) ? (sMin + sMax) / 2 : 0;
			rows.push({ id: itemId, label, a, b, mid, scaleLabelA, scaleLabelB });
		}
		if (rows.length === 0) return null;

		/**
		 * Pick one tension using the requested rule:
		 * - gap = chosen - other
		 * - if chosen is inward (below midpoint), flip sign: gap *= -1
		 * - pick the largest resulting gap
		 * @param {'a'|'b'} modelKey
		 * @param {'a'|'b'} otherKey
		 */
		function pickTension(modelKey, otherKey) {
			return [...rows].sort((x, y) => {
				const xChosen = x[modelKey];
				const xOther = x[otherKey];
				const xGap = xChosen - xOther;

				const yChosen = y[modelKey];
				const yOther = y[otherKey];
				const yGap = yChosen - yOther;

				if (yGap !== xGap) return yGap - xGap;
				// Tie-breaker: further from center for this model.
				return Math.abs(yChosen - y.mid) - Math.abs(xChosen - x.mid);
			})[0];
		}

		const pickA = pickTension('a', 'b');
		const pickB = pickTension('b', 'a');
		if (!pickA || !pickB) return null;

		const labelA = String(pickA.label || pickA.id);
		const labelB = String(pickB.label || pickB.id);
		/** @type {{ kind: 'text' | 'model', text?: string, model?: string }[]} */
		const whySegments = [
			{ kind: 'model', model: modelA },
			{
				kind: 'text',
				text: ` prioritizes ${titleCaseTensionLabel(labelA)} while `
			},
			{ kind: 'model', model: modelB },
			{
				kind: 'text',
				text: ` prioritizes ${titleCaseTensionLabel(labelB)}.`
			}
		];
		const text = whySegments
			.map((s) => (s.kind === 'model' ? String(s.model ?? '') : String(s.text ?? '')))
			.join('')
			.trim();
		return { text, whySegments };
	}

	/** @param {{ debateId?: string, models?: string[], fromLastFeedSuggestion?: boolean }=} opts */
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
		const fromLastFeedSuggestion = Boolean(opts?.fromLastFeedSuggestion);
		if (!fromLastFeedSuggestion) {
			appendLeftTrayMessage({
				type: 'debate_selection_card',
				gapTop: true,
				chunkBreak: true,
				debateId,
				suggestedModels: [pickedModels[0], pickedModels[1]]
			});
		}
		// Narration: scenario only; question is already on the selection card / nav.
		const scenarioText = scenario.replace(/\s+/g, ' ').trim();
		if (scenarioText) {
			appendLeftTrayMessage({
				type: 'narration',
				gapTop: !fromLastFeedSuggestion,
				text: scenarioText
			});
		}

		if (!isClaudeVsGrokPair(pickedModels)) return;
		const transcript = TRANSCRIPTS_BY_DEBATE_ID.get(debateId);
		const turns = Array.isArray(transcript?.turns) ? transcript.turns : [];
		if (!turns.length) return;
		const leftModelKey = normalizeModelKey(pickedModels[0]);
		const transcriptSectionTitleByStep = new Map([
			[1, 'ADVICE'],
			[3, 'VALUES'],
			[5, 'THRESHOLDS']
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

		// WHY section: synthetic value explanation from average positions & tensions (no extra model calls).
		const debate = DEBATE_BY_ID.get(debateId);
		const why = buildWhySummariesForDebate(debate, pickedModels[0], pickedModels[1]);
		if (why?.whySegments?.length && why.text) {
			appendLeftTrayMessage({
				type: 'section_title',
				gapTop: false,
				text: 'WHY'
			});
			appendLeftTrayMessage({
				type: 'why_narration',
				gapTop: false,
				text: why.text,
				whySegments: why.whySegments
			});
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

	$effect(() => {
		const id = $selectedStatementId;
		if (id == null || String(id).trim() === '') return;
		leftTrayControlsCollapsed = true;
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
											<div class="flex w-full justify-center">
												<div
													class="w-[90%] rounded-2xl bg-[#4b4b4e] px-3 py-2 text-sm leading-relaxed text-white shadow-sm"
												>
													<p class="text-center whitespace-pre-line">{message.text}</p>
												</div>
											</div>
										{:else if message.type === 'section_title'}
											<p class="mt-[10px] text-center text-xs font-semibold uppercase tracking-wide text-slate-200">
												{message.text}
											</p>
										{:else if message.type === 'topic_choices'}
											<div class="space-y-2 px-2">
												<div class="flex w-full justify-center">
													<div
														class="w-[90%] rounded-2xl bg-[#4b4b4e] px-3 py-2 text-sm leading-relaxed text-white shadow-sm"
													>
														<p class="text-center whitespace-pre-line">{message.text}</p>
													</div>
												</div>
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
										{:else if message.type === 'debate_suggestion' || message.type === 'debate_selection_card'}
											{@const leftModel = String(message.suggestedModels?.[0] ?? '')}
											{@const rightModel = String(message.suggestedModels?.[1] ?? '')}
											<div class="space-y-2 px-2">
												<p class="text-center text-xs font-semibold uppercase tracking-wide text-slate-200">
													{message.type === 'debate_selection_card' ? 'Question' : 'Suggested Question'}
												</p>
												<div class="flex w-full justify-center">
													<div
														class="flex min-h-11 w-[90%] items-center justify-center rounded-full bg-[#4b4b4e] px-3 py-2 text-center text-sm text-white"
													>
														{String(
															DEBATE_BY_ID.get(String(message.debateId ?? ''))?.question ??
																''
														)}
													</div>
												</div>
												<div class="my-4 flex items-center justify-center gap-2">
													{#if message.type === 'debate_selection_card'}
														<div
															class="w-[100px] rounded-full px-2 py-1.5 text-center text-xs font-semibold text-white"
															style={leftModel
																? `background-color: ${modelColor(leftModel)};`
																: 'background-color: #7a7a7a;'}
														>
															{leftModel || 'Model 1'}
														</div>
														<span class="text-xs font-semibold uppercase tracking-wide text-slate-300">
															and
														</span>
														<div
															class="w-[100px] rounded-full px-2 py-1.5 text-center text-xs font-semibold text-white"
															style={rightModel
																? `background-color: ${modelColor(rightModel)};`
																: 'background-color: #7a7a7a;'}
														>
															{rightModel || 'Model 2'}
														</div>
													{:else}
														<button
															type="button"
															class="w-[100px] cursor-pointer rounded-full px-2 py-1.5 text-xs font-semibold text-white"
															style={leftModel
																? `background-color: ${modelColor(leftModel)};`
																: 'background-color: #7a7a7a;'}
														>
															{leftModel || 'Model 1'}
														</button>
														<span class="text-xs font-semibold uppercase tracking-wide text-slate-300">
															and
														</span>
														<button
															type="button"
															class="w-[100px] cursor-pointer rounded-full px-2 py-1.5 text-xs font-semibold text-white"
															style={rightModel
																? `background-color: ${modelColor(rightModel)};`
																: 'background-color: #7a7a7a;'}
														>
															{rightModel || 'Model 2'}
														</button>
													{/if}
												</div>
												{#if message.type === 'debate_suggestion'}
													<div class="flex items-center justify-center">
														<button
															type="button"
															class="h-10 min-w-[130px] cursor-pointer rounded-full bg-[#4b4b4e] px-5 text-center text-sm font-bold tracking-wide text-white"
															onclick={() => handleDebateSuggestion(message)}
														>
															COMPARE
														</button>
													</div>
												{/if}
											</div>
										{:else if message.type === 'why_narration'}
											<div class="flex w-full justify-center">
												<div
													class="w-[90%] rounded-2xl bg-[#4b4b4e] px-3 py-2 text-sm leading-relaxed text-white shadow-sm"
												>
													<p class="text-left">
														{#if Array.isArray(message.whySegments) && message.whySegments.length}
															{#each message.whySegments as seg, sidx (sidx)}
																{#if seg.kind === 'model'}
																	<span
																		class="font-semibold"
																		style={`color: ${modelColor(String(seg.model ?? ''))};`}
																	>
																		{seg.model}
																	</span>
																{:else}
																	{seg.text}
																{/if}
															{/each}
														{:else}
															{message.text}
														{/if}
													</p>
												</div>
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
									class="relative flex w-full items-center justify-center text-center text-xs font-semibold uppercase tracking-wide text-slate-200"
									onclick={() => (leftTrayControlsCollapsed = !leftTrayControlsCollapsed)}
								>
									<span>WHAT QUESTIONS ARE YOU ASKING AI?</span>
									<span
										aria-hidden="true"
										class="absolute right-0 text-2xl leading-none"
									>
										{leftTrayControlsCollapsed ? '+' : '-'}
									</span>
								</button>
								{#if !leftTrayControlsCollapsed}
									<div class="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-200">
										Question
									</div>
									<select
										class="debate-topic-select mt-3 h-11 w-full rounded-full bg-[#3B3A3A] px-3 pr-14 text-center text-sm text-white outline-none [text-align-last:center]"
										value={$selectedDebateId ?? ''}
										onchange={handleDebateTopicChange}
									>
										<option value="">Select a question</option>
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
												class="min-w-0 flex-1 cursor-pointer rounded-full px-2 py-1.5 text-xs font-semibold text-white transition-opacity {active
													? 'opacity-100'
													: 'bg-[#7a7a7a] opacity-55 hover:opacity-75'}"
												style={active ? `background-color: ${modelColor(model)};` : ''}
												onclick={() => handleModelToggle(model)}
											>
												{model}
											</button>
										{/each}
									</div>
									<div class="mt-7 flex items-center justify-center">
										<button
											type="button"
											class={`relative h-10 min-w-[210px] rounded-full bg-[#3B3A3A] px-5 pr-14 text-sm font-bold tracking-wide text-white ${
												Boolean(String($selectedDebateId ?? '').trim()) && $selectedModels.length === 2
													? 'cursor-pointer'
													: 'cursor-not-allowed bg-[#4a4a4d]'
											}`}
											aria-disabled={!(
												Boolean(String($selectedDebateId ?? '').trim()) &&
												$selectedModels.length === 2
											)}
											onclick={() => {
												if (
													!(
														Boolean(String($selectedDebateId ?? '').trim()) &&
														$selectedModels.length === 2
													)
												)
													return;
												handleDebateStart();
											}}
										>
											<span
												class:opacity-50={!(
													Boolean(String($selectedDebateId ?? '').trim()) &&
													$selectedModels.length === 2
												)}
											>
												COMPARE
											</span>
											<span
												role="button"
												tabindex="0"
												class="absolute right-0 top-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#3B3A3A] bg-[#66666b] text-xl font-bold text-white hover:bg-[#74747a]"
												onclick={(event) => {
													event.stopPropagation();
													handleRandomizedDebateStart();
												}}
												onkeydown={(event) => {
													if (event.key === 'Enter' || event.key === ' ') {
														event.preventDefault();
														event.stopPropagation();
														handleRandomizedDebateStart();
													}
												}}
												aria-label="Randomize debate topic and models"
											>
												🎲
											</span>
										</button>
									</div>
								{/if}
							</div>
						</div>
					</aside>

					<div
						class="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-white order-1 md:order-2 h-[65vh] md:h-auto"
					>
						{#if isStatementView || $selectedDebateId}
							<header class="shrink-0 bg-white">
								<div class="flex w-full flex-col">
									{#if $selectedDebateId}
										{@const debateHeaderModels =
											$selectedModels.length > 0
												? $selectedModels
												: $selectedModel
													? [$selectedModel]
													: []}
										<div class="flex w-full items-center gap-3 bg-[#3B3A3A] px-3 py-3 text-white">
											<div class="min-w-0 flex-1 truncate text-sm font-semibold">
												QUESTION: {String($selectedDebate?.question ?? $selectedDebateId)}
											</div>
											{#if debateHeaderModels.length}
												<div class="flex items-center gap-2">
													{#if debateHeaderModels.length === 2}
														<button
															type="button"
															class="w-[100px] rounded-full px-3 py-1 text-center text-xs font-semibold text-white"
															style={`background-color: ${modelColor(debateHeaderModels[0])};`}
														>
															{debateHeaderModels[0]}
														</button>
														<span class="text-xs font-semibold text-slate-200">and</span>
														<button
															type="button"
															class="w-[100px] rounded-full px-3 py-1 text-center text-xs font-semibold text-white"
															style={`background-color: ${modelColor(debateHeaderModels[1])};`}
														>
															{debateHeaderModels[1]}
														</button>
													{:else}
														{#each debateHeaderModels as model (model)}
															<button
																type="button"
																class="w-[100px] rounded-full px-3 py-1 text-center text-xs font-semibold text-white"
																style={`background-color: ${modelColor(model)};`}
															>
																{model}
															</button>
														{/each}
													{/if}
												</div>
											{/if}
											<button
												type="button"
												class="text-base leading-none text-slate-200 hover:text-white"
												onclick={goToRadialRoot}
												aria-label="Clear selected question"
											>
												×
											</button>
										</div>
									{/if}
									{#if isStatementView && bumpViz?.dim?.items?.[0]}
										<div
											class="flex w-full items-center gap-3 px-3 py-2.5 text-white"
											style={`background-color: ${$selectedDebateId ? '#5F5F5F' : '#3B3A3A'};`}
										>
											<div class="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide">
												VALUE: {navLabelForSelectedStatement(bumpViz.dim.items[0])}
											</div>
											<button
												type="button"
												class="text-base leading-none text-slate-200 hover:text-white"
												onclick={goToDebateStatements}
												aria-label="Clear selected statement"
											>
												×
											</button>
										</div>
									{/if}
								</div>
								{#if isStatementView && selectedSurveyQuestion}
									<div class="mx-auto mt-5 mb-6 w-[calc(100%-2rem)] max-w-[min(100%,calc(72rem-40px))] rounded-md border border-slate-300 bg-slate-100 px-4 py-4 text-center text-sm text-slate-800 shadow-sm whitespace-pre-line">
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

<style>
	/* Closed select: centered label; open list: left-aligned options (where supported). */
	:global(select.debate-topic-select) {
		/* Use custom caret so right inset is consistent across browsers. */
		appearance: none;
		-webkit-appearance: none;
		-moz-appearance: none;
		padding-right: 2.75rem;
		-webkit-padding-end: 2.75rem;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7l5 6 5-6' stroke='%23cbd5e1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-size: 12px 12px;
		background-position: right 1rem center;
	}

	:global(select.debate-topic-select option) {
		text-align: left;
	}
</style>
