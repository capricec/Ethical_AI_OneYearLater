<script>
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { consumeIntroToolDeepLink } from '$lib/introduction/introToolDeepLink.js';
	import {
		buildEncodingItemById,
		fullSurveyQuestionForStatement as fullSurveyQuestionFromEncoding
	} from '$lib/data/fullSurveyQuestion.js';
	import {
		selectedModel,
		selectedModels,
		selectedDebateId,
		selectedDebate,
		selectedDebateSourceItems,
		selectedDebateSourceItemId,
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
	import { modelColor, MODEL_ORDER } from '$lib/viz/modelColors.js';
	import DimensionAggregateBumpChart from '$lib/viz/DimensionAggregateBumpChart.svelte';
	import StatementsRadialChart from '$lib/viz/StatementsRadialChart.svelte';
	import { statementLabel } from '$lib/ui/statementLabel.js';
	import { questions, statementContext, encoding, debates, debateAllModelsResponses } from '$lib/data/dataset.js';
	import statementModelAveragesRaw from '../../../data/statement_model_averages.json';
	import { sliceVizToSingleStatement } from '$lib/data/vizSliceSingleStatement.js';
	import {
		LEFT_TRAY_FEED_MODE,
		leftTrayDebateFeedTimingForViewport,
		leftTrayValueFeedTimingForViewport,
		LEFT_TRAY_MODEL_RESPONSE_MODE,
		LEFT_TRAY_MODEL_BUBBLE_LAYOUT
	} from '$lib/data/leftTrayFeedSeed.js';
	import {
		formatDebateTensionLabel,
		normDebateTensionKey,
		radialTensionLabelForStatement
	} from '$lib/data/debateTensionLabels.js';
	import {
		getFollowupResponseText,
		followupScaleStepFromConsensus
	} from '$lib/data/followupResponses.js';
	import DebateCompareControls from '$lib/components/DebateCompareControls.svelte';
	import ExperienceTopBar from '$lib/components/ExperienceTopBar.svelte';
	import LeftTrayTypingIndicator from '$lib/components/LeftTrayTypingIndicator.svelte';
	import VizValueHeader from '$lib/components/VizValueHeader.svelte';

	/** @type {Map<string, string>} */
	const STATEMENT_CONTEXT_BY_ID = new Map();
	for (const group of statementContext) {
		for (const it of group.items ?? []) {
			if (it?.item_id) STATEMENT_CONTEXT_BY_ID.set(String(it.item_id), String(it.context ?? ''));
		}
	}
	const ENCODING_ITEM_BY_ID = buildEncodingItemById(encoding);
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

	/**
	 * Debates that include this statement in their value triad (`source_items`), or whose
	 * `tensions` list includes the same normalized label. Triads use item ids; tension
	 * strings in debates.json don't always match statement_encoding (e.g. 31_8 is
	 * "anti-elite distrust" in encoding but "political distrust" in debates).
	 * @param {string} itemId
	 * @param {string} valueTensionRaw from statement / encoding (`item.tension`)
	 */
	function debatesForSelectedStatement(itemId, valueTensionRaw) {
		const id = String(itemId ?? '').trim();
		const tensionKey = normDebateTensionKey(valueTensionRaw);
		/** @type {{ id: string, label: string }[]} */
		const out = [];
		const seen = new Set();
		for (const d of DEBATE_ROWS) {
			const debateId = String(d?.debate_id ?? '').trim();
			const label = String(d?.question ?? '').trim() || debateId;
			if (!debateId || seen.has(debateId)) continue;

			const sourceItems = Array.isArray(d?.source_items)
				? d.source_items.map((s) => String(s ?? '').trim()).filter(Boolean)
				: [];
			const inTriad = id && sourceItems.includes(id);

			const rawTensions = Array.isArray(d?.tensions)
				? d.tensions
				: Array.isArray(d?.primary_tensions)
					? d.primary_tensions
					: [];
			const tensionMatch =
				tensionKey &&
				rawTensions.some((t) => normDebateTensionKey(String(t ?? '')) === tensionKey);

			if (!inTriad && !tensionMatch) continue;
			seen.add(debateId);
			out.push({ id: debateId, label });
		}
		out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
		return out;
	}
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
	const DEBATE_ALL_MODELS_BY_KEY = (() => {
		const recs = Array.isArray(debateAllModelsResponses?.records)
			? debateAllModelsResponses.records
			: [];
		/** @param {unknown} r */
		function recordTimeMs(r) {
			const t = r?.timestamp;
			if (t == null) return 0;
			const s = String(t).trim().replace(/^(\d{4}-\d{2}-\d{2}) (\d)/, '$1T$2');
			const n = Date.parse(s);
			return Number.isFinite(n) ? n : 0;
		}
		/** @param {unknown} r */
		function recordIsUsable(r) {
			const err = r?.error;
			if (err != null && String(err).trim() !== '') return false;
			const rsp = String(r?.response ?? '').trim();
			return Boolean(rsp);
		}
		const ordered = recs
			.map((r, i) => ({ r, i }))
			.sort((a, b) => {
				const dt = recordTimeMs(a.r) - recordTimeMs(b.r);
				if (dt !== 0) return dt;
				return a.i - b.i;
			})
			.map((x) => x.r);
		/** @type {Map<string, string>} */
		const m = new Map();
		for (const r of ordered) {
			if (!recordIsUsable(r)) continue;
			const did = String(r?.debate_id ?? '').trim();
			const fm = String(r?.fund_model ?? '').trim();
			const pt = String(r?.prompt_type ?? '').trim();
			if (!did || !fm || !pt) continue;
			const rsp = String(r?.response ?? '').trim();
			const key = `${did}::${normalizeModelKey(fm)}::${pt}`;
			m.set(key, rsp);
		}
		return m;
	})();

	/** @param {string} model */
	function normalizeModelKey(model) {
		return String(model ?? '')
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '');
	}

	/** @param {string} debateId @param {string} model @param {'opening'|'threshold'} promptType */
	function getAllModelsDebateResponse(debateId, model, promptType) {
		const key = `${String(debateId ?? '').trim()}::${normalizeModelKey(model)}::${String(promptType ?? '').trim()}`;
		return DEBATE_ALL_MODELS_BY_KEY.get(key) ?? '';
	}

	/** @param {string} model */
	function displayFundModelName(model) {
		const k = normalizeModelKey(model);
		for (const name of MODEL_ORDER) {
			if (normalizeModelKey(name) === k) return name;
		}
		return String(model ?? '').trim() || 'Model';
	}

	/** Matches Tailwind `md:` — bottom question tray defaults closed on mobile only. */
	const MOBILE_VIEWPORT_MQ = '(max-width: 767px)';
	let viewportMobile = $state(false);

	/** Fixed context / subscale rail (matches left tray width). */
	/** Dimension pills removed for now; avoid a stuck dimension-only filter. */
	onMount(() => {
		setDimensionFilter(null);
		resetLeftTrayFeed();
		const mq = window.matchMedia(MOBILE_VIEWPORT_MQ);
		const syncViewport = () => {
			viewportMobile = mq.matches;
		};
		syncViewport();
		mq.addEventListener('change', syncViewport);

		const introLink = consumeIntroToolDeepLink();
		if (introLink) {
			tick().then(() => {
				setSelectedDebateId(introLink.debateId);
				setSelectedDebateSourceItemId(null);
				setSelectedStatementId(null);
				setSelectedModels(introLink.models);
				setSelectedModel(null);
				// Same feed as bottom module → COMPARE (includes debate_selection_card).
				handleDebateStart({
					debateId: introLink.debateId,
					models: introLink.models
				});
			});
		}

		return () => mq.removeEventListener('change', syncViewport);
	});

	let chartWidth = $state(0);
	let radialCellW = $state(0);
	let radialCellH = $state(0);
	let leftTrayFeedEl = $state(/** @type {HTMLDivElement | null} */ (null));
	let feedSequenceToken = 0;
	/** Bump statement view: flex slot height so the SVG row fills the viewport. */
	let statementBumpSlotH = $state(0);
	/** Nested feed streams (typing indicator while any wait is active). */
	let feedTypingDepth = $state(0);
	const feedTypingVisible = $derived(feedTypingDepth > 0);

	/** @param {number} ms */
	function waitMs(ms) {
		const delay = Math.max(0, Number(ms) || 0);
		return new Promise((resolve) => setTimeout(resolve, delay));
	}

	function debateFeedTiming() {
		return leftTrayDebateFeedTimingForViewport(viewportMobile);
	}

	function valueFeedTiming() {
		return leftTrayValueFeedTimingForViewport(viewportMobile);
	}

	function beginFeedTyping() {
		feedTypingDepth += 1;
	}

	function endFeedTyping() {
		feedTypingDepth = Math.max(0, feedTypingDepth - 1);
	}

	/** Pause with three-dot typing bubble visible (used for all streamed feed delays). */
	async function waitFeed(ms) {
		const delay = Math.max(0, Number(ms) || 0);
		if (delay === 0) return;
		beginFeedTyping();
		await tick();
		try {
			await waitMs(delay);
		} finally {
			endFeedTyping();
		}
	}

	/** Stop in-flight streamed feed (keeps messages already shown). */
	function cancelActiveFeedSequence() {
		feedSequenceToken += 1;
		feedTypingDepth = 0;
	}

	$effect(() => {
		$leftTrayFeed;
		feedTypingDepth;
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
		toggleSubscaleSelection(subscaleKey);
	}

	/** Top-bar question picker: debate topic from `debates.json`. */
	function handleDebateTopicSelect(/** @type {string | null} */ debateId) {
		const value = String(debateId ?? '').trim();
		if (!value) {
			goToRadialRoot();
			return;
		}
		setSelectedDebateId(value);
		setSelectedDebateSourceItemId(null);
		setSelectedStatementId(null);
	}

	/** Model selector: multi-select store with single-model compatibility bridge. */
	function handleModelToggle(/** @type {string} */ model) {
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

	/** Mobile debate view: question only — no tension / statement drill-down. */
	$effect(() => {
		if (!viewportMobile || !String($selectedDebateId ?? '').trim()) return;
		if ($selectedStatementId == null && $selectedDebateSourceItemId == null) return;
		setSelectedStatementId(null);
		setSelectedDebateSourceItemId(null);
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
		if (viewportMobile && String($selectedDebateId ?? '').trim()) return;
		const id = String(itemId ?? '').trim();
		if (!id) return;
		const next = $selectedStatementId === id ? null : id;
		if (next) {
			setSelectedDebateSourceItemId(next);
			applyStatementSelection(next);
			// Do not bump feedSequenceToken while a debate stream is running.
			if (!String($selectedDebateId ?? '').trim()) {
				appendFeedForSelectedStatement(next);
			}
		} else {
			setSelectedDebateSourceItemId(null);
			setSelectedStatementId(null);
		}
	}

	/** @param {string} itemId */
	async function appendFeedForSelectedStatement(itemId) {
		if (String($selectedDebateId ?? '').trim()) return;
		const token = ++feedSequenceToken;
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
			await waitFeed(valueFeedTiming().beforeNarrationMs);
			if (token !== feedSequenceToken) return;
			appendLeftTrayMessage({
				type: 'section_title',
				gapTop: true,
				chunkBreak: true,
				text: 'Value Statement'
			});
			await waitFeed(valueFeedTiming().sectionTitleToNarrationMs);
			if (token !== feedSequenceToken) return;
			appendLeftTrayMessage({
				type: 'narration',
				valueStatement: true,
				text: narratorQuestion
			});
		}

		if (LEFT_TRAY_FEED_MODE === 'topic_choices') {
			const options = DEBATE_CHOICES_BY_STATEMENT_ID.get(itemId) ?? [];
			if (options.length) {
				await waitFeed(valueFeedTiming().narrationToModelsMs);
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

		await waitFeed(valueFeedTiming().narrationToModelsMs);
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
			await waitFeed(valueFeedTiming().betweenModelMessagesMs);
			if (token !== feedSequenceToken) return;
			appendLeftTrayMessage({
				type: 'model',
				model,
				side: i % 2 === 0 ? 'left' : 'right',
				text: response
			});
		}

		if (String($selectedDebateId ?? '').trim()) return;
		const valueTension = String(item?.tension ?? '').trim();
		const debateQuestionOptions = debatesForSelectedStatement(itemId, valueTension);
		if (!debateQuestionOptions.length) return;

		await waitFeed(valueFeedTiming().beforeSectionMs);
		if (token !== feedSequenceToken) return;
		appendLeftTrayMessage({
			type: 'debate_suggestion',
			gapTop: true,
			chunkBreak: true,
			debateOptions: debateQuestionOptions
		});
	}

	function goToRadialRoot() {
		cancelActiveFeedSequence();
		setSelectedStatementId(null);
		setSelectedDebateSourceItemId(null);
		setSelectedDebateId(null);
		// Reset to "all models" state when exiting debate via header close.
		setSelectedModels([]);
		setSelectedModel(null);
	}

	function goToDebateStatements() {
		// Value-only drill-down: stop streamed statement feed; keep debate feed if a question is active.
		if (!String($selectedDebateId ?? '').trim()) {
			cancelActiveFeedSequence();
		}
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

	/** Pick a debate from the feed list only: set topic, clear models/statement; do not run compare stream. */
	function handlePickDebateQuestionOnly(/** @type {string} */ debateId) {
		const id = String(debateId ?? '').trim();
		if (!id) return;
		cancelActiveFeedSequence();
		feedSequenceToken += 1;
		setSelectedDebateId(id);
		setSelectedDebateSourceItemId(null);
		setSelectedStatementId(null);
		setSelectedModels([]);
		setSelectedModel(null);
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
		return formatDebateTensionLabel(s);
	}

	/** Counts a “meaningful” pairwise gap for debate WHY branching (strict >). */
	const WHY_DEBATE_GAP_STRONG = 0.35;

	/**
	 * Debate WHY summary based on average positions (same data as radial spikes).
	 * “Disagree most about importance of …” when exactly one tension beats WHY_DEBATE_GAP_STRONG,
	 * or when none do (then pick largest |a−b|). Two+ strong tensions: pickTension + dual prioritizes.
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

		/** @type {{ id: string, label: string, a: number, b: number, mid: number, scaleLabelA: string, scaleLabelB: string, absGap: number }[]} */
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
			const absGap = Math.abs(a - b);
			rows.push({ id: itemId, label, a, b, mid, scaleLabelA, scaleLabelB, absGap });
		}
		if (rows.length === 0) return null;

		/** @param {{ label: string, id: string }} row */
		function whySegmentsDisagreeMostAboutImportance(row) {
			const valueLabel = titleCaseTensionLabel(String(row.label || row.id));
			return [
				{ kind: 'model', model: modelA },
				{ kind: 'text', text: ' and ' },
				{ kind: 'model', model: modelB },
				{
					kind: 'text',
					text: ` disagree most about the importance of ${valueLabel}.`
				}
			];
		}

		const strongRows = rows.filter((r) => r.absGap > WHY_DEBATE_GAP_STRONG);
		if (strongRows.length === 1) {
			const whySegments = whySegmentsDisagreeMostAboutImportance(strongRows[0]);
			const text = whySegments
				.map((s) => (s.kind === 'model' ? String(s.model ?? '') : String(s.text ?? '')))
				.join('')
				.trim();
			return { text, whySegments };
		}

		if (strongRows.length === 0) {
			const rankedByAbsGap = [...rows].sort((x, y) => {
				if (y.absGap !== x.absGap) return y.absGap - x.absGap;
				return (
					Math.max(Math.abs(y.a - y.mid), Math.abs(y.b - y.mid)) -
					Math.max(Math.abs(x.a - x.mid), Math.abs(x.b - x.mid))
				);
			});
			const top = rankedByAbsGap[0];
			if (!top) return null;
			const whySegments = whySegmentsDisagreeMostAboutImportance(top);
			const text = whySegments
				.map((s) => (s.kind === 'model' ? String(s.model ?? '') : String(s.text ?? '')))
				.join('')
				.trim();
			return { text, whySegments };
		}

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
		const token = ++feedSequenceToken;
		const debate = DEBATE_BY_ID.get(debateId);
		const scenarioText = String(debate?.scenario ?? '')
			.replace(/\s+/g, ' ')
			.trim();
		const thresholdPrompt = String(debate?.threshold ?? '')
			.replace(/\s+/g, ' ')
			.trim();
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

		const leftModelKey = normalizeModelKey(pickedModels[0]);
		const opening0 = getAllModelsDebateResponse(debateId, pickedModels[0], 'opening');
		const opening1 = getAllModelsDebateResponse(debateId, pickedModels[1], 'opening');
		const threshold0 = getAllModelsDebateResponse(debateId, pickedModels[0], 'threshold');
		const threshold1 = getAllModelsDebateResponse(debateId, pickedModels[1], 'threshold');
		const hasAdvice = Boolean(scenarioText || opening0 || opening1);
		const hasThreshold = Boolean(thresholdPrompt || threshold0 || threshold1);
		if (!hasAdvice && !hasThreshold) return;

		/**
		 * @param {{ leadingPause?: boolean, gapTop?: boolean }} [sectionOpts]
		 * @returns {Promise<boolean>}
		 */
		async function appendSectionTitle(title, sectionOpts = {}) {
			if (sectionOpts.leadingPause) {
				await waitFeed(debateFeedTiming().beforeSectionMs);
				if (token !== feedSequenceToken) return false;
			}
			appendLeftTrayMessage({
				type: 'section_title',
				gapTop: Boolean(sectionOpts.gapTop),
				text: title
			});
			return true;
		}

		/** Centered prompt bubble (scenario or threshold question). */
		async function appendDebatePromptBubble(text) {
			const copy = String(text ?? '').trim();
			if (!copy) return;
			await waitFeed(debateFeedTiming().betweenModelMessagesMs);
			if (token !== feedSequenceToken) return;
			appendLeftTrayMessage({
				type: 'narration',
				text: copy,
				debatePrompt: true
			});
		}

		/** @param {string} a @param {string} b */
		async function appendModelPair(a, b) {
			const items = [
				{ text: String(a ?? '').trim(), picked: pickedModels[0] },
				{ text: String(b ?? '').trim(), picked: pickedModels[1] }
			].filter((x) => x.text);
			for (let i = 0; i < items.length; i++) {
				await waitFeed(debateFeedTiming().betweenModelMessagesMs);
				if (token !== feedSequenceToken) return;
				const { text, picked } = items[i];
				const model = displayFundModelName(picked);
				const side = normalizeModelKey(picked) === leftModelKey ? 'left' : 'right';
				appendLeftTrayMessage({
					type: 'model',
					model,
					side,
					text
				});
			}
		}

		await waitFeed(debateFeedTiming().narrationToModelsMs);
		if (token !== feedSequenceToken) return;

		if (hasAdvice) {
			if (!(await appendSectionTitle('ADVICE', { gapTop: !fromLastFeedSuggestion }))) return;
			await appendDebatePromptBubble(scenarioText);
			if (token !== feedSequenceToken) return;
			await appendModelPair(opening0, opening1);
		}

		if (token !== feedSequenceToken) return;

		if (hasThreshold) {
			if (!(await appendSectionTitle('THRESHOLD', { leadingPause: true }))) return;
			await appendDebatePromptBubble(thresholdPrompt);
			if (token !== feedSequenceToken) return;
			await appendModelPair(threshold0, threshold1);
		}

		// WHY section: synthetic value explanation from average positions & tensions (no extra model calls).
		if (token !== feedSequenceToken) return;
		const why = buildWhySummariesForDebate(debate, pickedModels[0], pickedModels[1]);
		if (why?.whySegments?.length && why.text) {
			await waitFeed(debateFeedTiming().beforeSectionMs);
			if (token !== feedSequenceToken) return;
			appendLeftTrayMessage({
				type: 'section_title',
				gapTop: false,
				text: 'WHY'
			});
			await waitFeed(debateFeedTiming().betweenModelMessagesMs);
			if (token !== feedSequenceToken) return;
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
		return fullSurveyQuestionFromEncoding(statementId, ENCODING_ITEM_BY_ID);
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
</script>

<svelte:head>
	<title>Everyday Ethics of AI</title>
</svelte:head>

<div class="min-h-screen overflow-x-hidden bg-slate-100 text-slate-900" data-tool-root>
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
					: $selectedDebateId
						? Math.max(240, Math.floor(rawRadialSquare * 0.9))
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
			{@const radialStatementSelectEnabled =
				!(viewportMobile && String($selectedDebateId ?? '').trim())}
			{@const selectedSurveyQuestion = fullSurveyQuestionForStatement($selectedStatementId)}
			{@const bumpViz = $selectedStatementId
				? sliceVizToSingleStatement($statementsViz, $selectedStatementId)
				: null}
			<!-- Desktop: row height comes from the flex slot (chart scales model rows to fit). -->
			{@const isMobileStatementChart = chartWidth < 768}
			<!-- Mobile: fixed SVG height (bump + axis labels only); legend sits below in chart-wrap. -->
			{@const compactBumpSvgH = 92}
			{@const bumpSingleRowHeights = bumpViz
				? isMobileStatementChart
					? [compactBumpSvgH]
					: [statementBumpSlotH > 0 ? statementBumpSlotH : 360]
				: []}
			{@const navValueLabel =
				isStatementView && bumpViz?.dim?.items?.[0]
					? radialTensionLabelForStatement(bumpViz.dim.items[0], $selectedDebate)
					: ''}
			{@const navValueText = navValueLabel ? `VALUE: ${navValueLabel}` : ''}
			{@const hasSelectedDebate = Boolean(String($selectedDebateId ?? '').trim())}
			{@const showMobileCompare = viewportMobile && hasSelectedDebate}
			{@const radialFullBleed =
				!isStatementView && !hasSelectedDebate}

			<div
				class="flex h-[100vh] min-h-0 flex-col rounded-lg bg-slate-100 ring-1 ring-slate-300"
				class:overflow-hidden={!radialFullBleed}
				class:overflow-visible={radialFullBleed}
			>
				<ExperienceTopBar
					topics={$debateTopicOptions}
					selectedDebateId={$selectedDebateId}
					valueText={navValueText}
					showValue={viewportMobile && Boolean(navValueText)}
					onSelectDebate={handleDebateTopicSelect}
					onClearValue={isStatementView && bumpViz?.dim?.items?.[0]
						? goToDebateStatements
						: undefined}
				/>

				{#if showMobileCompare}
					<DebateCompareControls
						{visibleModels}
						selectedModels={$selectedModels}
						selectedDebateId={$selectedDebateId}
						{allModelsShowing}
						compact
						onModelToggle={handleModelToggle}
						onCompare={() => handleDebateStart()}
					/>
				{/if}

				<div
					class="flex min-h-0 flex-1 flex-col md:flex-row"
					class:overflow-hidden={!radialFullBleed}
					class:overflow-visible={radialFullBleed}
				>
					<!-- Dashboard left tray: selector stack anchored to bottom (text panel not in scope). -->
					<aside
						class="box-border flex min-h-0 w-full max-w-full flex-1 basis-0 flex-col overflow-hidden border-t border-slate-600 bg-[#3B3A3A] order-2 md:order-1 md:h-auto md:w-[35vw] md:min-w-[400px] md:max-w-[500px] md:flex-none md:basis-auto md:border-r md:border-t-0"
					>
						<div class="flex min-h-0 flex-1 flex-col">
							<div
								class="left-tray-feed-scroll min-h-0 flex-1 overflow-y-auto space-y-3 bg-[#3B3A3A] px-4 py-4"
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
													class="left-tray-chat-bubble {message.debatePrompt ||
													message.valueStatement
														? 'left-tray-transparent-bubble'
														: ''}"
												>
													<p class="text-center whitespace-pre-line">{message.text}</p>
												</div>
											</div>
										{:else if message.type === 'section_title'}
											<p
												class="left-tray-feed-section-title left-tray-feed-section-title--after-chunk text-center text-xs font-semibold uppercase tracking-wide text-slate-200 {message.text ===
												'Value Statement'
													? 'left-tray-feed-section-title--value'
													: ''}"
											>
												{message.text}
											</p>
										{:else if message.type === 'topic_choices'}
											<div class="left-tray-topic-block space-y-2 px-2">
												<div class="flex w-full justify-center">
													<div class="left-tray-chat-bubble">
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
										{:else if message.type === 'debate_suggestion'}
											{#if Array.isArray(message.debateOptions) && message.debateOptions.length}
												<div class="left-tray-topic-block space-y-3 px-2">
													<p
														class="left-tray-feed-section-title--after-chunk text-center text-xs font-semibold uppercase tracking-wide text-slate-200"
													>
														Questions Exploring This Value
													</p>
													<div class="flex flex-col gap-2">
														{#each message.debateOptions as opt (opt.id)}
															<button
																type="button"
																class="left-tray-explore-question-btn w-full rounded-full bg-[#4b4b4e] border-1 border-[#4b4b4e] px-4 py-2.5 text-center text-sm font-medium leading-snug text-white transition-colors hover:border-white hover:border-1 focus-visible:outline-none"
																onclick={() => handlePickDebateQuestionOnly(opt.id)}
															>
																{opt.label}
															</button>
														{/each}
													</div>
												</div>
											{/if}
										{:else if message.type === 'debate_selection_card'}
											{@const leftModel = String(message.suggestedModels?.[0] ?? '')}
											{@const rightModel = String(message.suggestedModels?.[1] ?? '')}
											<div class="left-tray-topic-block space-y-2 px-2">
												<p
													class="left-tray-feed-section-title--after-chunk text-center text-xs font-semibold uppercase tracking-wide text-slate-200"
												>
													Question
												</p>
												<div class="flex w-full justify-center">
													<div
														class="left-tray-chat-bubble flex min-h-11 items-center justify-center text-center"
													>
														{String(
															DEBATE_BY_ID.get(String(message.debateId ?? ''))?.question ??
																''
														)}
													</div>
												</div>
												<div class="my-4 flex items-center justify-center gap-2">
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
												</div>
											</div>
										{:else if message.type === 'why_narration'}
											<div class="flex w-full justify-center">
												<div class="left-tray-chat-bubble left-tray-transparent-bubble">
													<p class="text-center">
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
												<div class="left-tray-chat-bubble">
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
								{#if feedTypingVisible}
									<LeftTrayTypingIndicator
										centered={LEFT_TRAY_MODEL_BUBBLE_LAYOUT === 'center'}
									/>
								{/if}
							</div>
							<div class="hidden shrink-0 md:block">
								<DebateCompareControls
									{visibleModels}
									selectedModels={$selectedModels}
									selectedDebateId={$selectedDebateId}
									{allModelsShowing}
									onModelToggle={handleModelToggle}
									onCompare={() => handleDebateStart()}
								/>
							</div>
						</div>
					</aside>

					<div
						class="relative flex min-h-0 min-w-0 max-w-full flex-1 basis-0 flex-col bg-white order-1 md:order-2 md:basis-auto md:h-auto"
						class:overflow-hidden={isStatementView}
						class:overflow-visible={!isStatementView}
					>
						{#if !viewportMobile && navValueText}
							<VizValueHeader
								valueText={navValueText}
								onClearValue={isStatementView && bumpViz?.dim?.items?.[0]
									? goToDebateStatements
									: undefined}
							/>
						{/if}
						{#if isStatementView && selectedSurveyQuestion}
							<div
								class="mx-auto mb-2.5 mt-3 w-[calc(100%-1.5rem)] max-w-[min(100%,calc(72rem-40px))] shrink-0 rounded-2xl border border-[#3B3A3A]/25 bg-[#3B3A3A]/10 px-3 py-2.5 text-left shadow-sm md:mb-6 md:w-[calc(100%-2rem)] md:px-4 md:py-4"
							>
								<p
									class="mb-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500"
								>
									SURVEY QUESTION
								</p>
								<p class="text-[13px] leading-relaxed text-slate-800 md:text-sm">
									{selectedSurveyQuestion}
								</p>
							</div>
						{/if}

						<div
							class="flex min-h-0 flex-1 flex-col bg-white"
							class:overflow-hidden={isStatementView}
							class:overflow-visible={!isStatementView}
						>
							{#if isStatementView}
								{#if bumpViz}
									<div
										class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white"
									>
										<div
											class="mx-auto box-border flex w-full max-w-[min(100%,calc(72rem-40px))] flex-col items-stretch px-3 pb-1 pt-0 md:min-h-0 md:min-w-0 md:flex-1 md:px-4 md:pb-4 md:pt-3"
										>
											<h2
												class="hidden"
											>
												{statementLabel(bumpViz.dim.items[0])}
											</h2>
											<div
												bind:clientWidth={chartWidth}
												bind:clientHeight={statementBumpSlotH}
												class="box-border flex w-full max-w-full flex-col self-stretch {isMobileStatementChart
													? 'shrink-0'
													: 'min-h-0 min-w-0 flex-1'}"
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
													showCompactLegend={!isMobileStatementChart}
												/>
											</div>
									{#if isMobileStatementChart}
										{@const legendModelFilter = Array.isArray($selectedModels)
											? Array.from(
													new Set(
														$selectedModels
															.map((m) => String(m ?? '').trim())
															.filter(Boolean)
													)
											)
											: []}
										{@const statementLegendModels =
											legendModelFilter.length > 0
												? bumpViz.modelSeries.filter((s) =>
														legendModelFilter.includes(s.fundModel)
													)
												: bumpViz.modelSeries}
										<ul
											class="statement-mobile-legend"
											aria-label="Models in chart"
										>
											{#each statementLegendModels as ms (ms.fundModel)}
												<li class="statement-mobile-legend-item">
													<span
														class="statement-mobile-legend-swatch"
														style={`background-color: ${modelColor(ms.fundModel)};`}
														aria-hidden="true"
													></span>
													<span class="statement-mobile-legend-label"
														>{ms.fundModel}</span
													>
												</li>
											{/each}
										</ul>
									{/if}
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
									class="relative flex min-h-0 flex-1 flex-col overflow-visible bg-white {radialFullBleed
										? 'p-0'
										: 'p-2'}"
								>
									<div class="relative min-h-0 w-full flex-1 overflow-visible">
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
											statementSelectEnabled={radialStatementSelectEnabled}
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
	@media (max-width: 767px) {
		.left-tray-feed-scroll {
			padding-left: 11px;
			padding-right: 11px;
		}

		.left-tray-topic-block {
			padding-left: 0;
			padding-right: 0;
		}

		.left-tray-chat-bubble {
			width: 100%;
			padding-left: 7px;
			padding-right: 7px;
		}
	}

	.left-tray-chat-bubble {
		width: 90%;
		border-radius: 1rem;
		background-color: #4b4b4e;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		line-height: 1.625;
		color: #fff;
		box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
	}

	/* Value statement, scenario, threshold, and WHY — text only, no bubble chrome. */
	.left-tray-chat-bubble.left-tray-transparent-bubble {
		background-color: transparent;
		box-shadow: none;
		border: none;
	}

	/* ADVICE / THRESHOLD / WHY / Value Statement — section header rhythm. */
	.left-tray-feed-section-title {
		margin-top: calc(1.75rem + 10px);
		margin-bottom: -10px;
	}

	.left-tray-feed-section-title--value {
		margin-bottom: -10px;
	}

	/* Same gap from chunk divider line to header as Value Statement (1.75rem). */
	.left-tray-feed-section-title--after-chunk {
		margin-top: 1.75rem;
		margin-bottom: 1rem;
	}

	.left-tray-explore-question-btn {
		cursor: pointer;
	}

	.statement-mobile-legend {
		display: flex;
		flex-wrap: nowrap;
		justify-content: center;
		align-items: center;
		gap: 0.25rem 0.5rem;
		width: 100%;
		max-width: 100%;
		margin: 20px 0 0;
		padding: 0;
		list-style: none;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		flex-shrink: 0;
	}

	.statement-mobile-legend::-webkit-scrollbar {
		display: none;
	}

	.statement-mobile-legend-item {
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		gap: 0.25rem;
		white-space: nowrap;
	}

	.statement-mobile-legend-swatch {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.statement-mobile-legend-label {
		font-size: 0.6875rem;
		font-weight: 500;
		color: #334155;
		line-height: 1;
	}

</style>
