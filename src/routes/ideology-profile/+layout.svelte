<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import SiteHamburgerMenu from '$lib/components/SiteHamburgerMenu.svelte';
	import IdeologyProfileTray from '$lib/components/IdeologyProfileTray.svelte';
	import IdeologyBuilderPanel from '$lib/components/IdeologyBuilderPanel.svelte';
	import IdeologyQuizPanel from '$lib/components/IdeologyQuizPanel.svelte';
	import StatementsRadialChart from '$lib/viz/StatementsRadialChart.svelte';
	import { MODEL_ORDER } from '$lib/viz/modelColors.js';
	import { STATEMENT_ORDER_SUBSCALE } from '$lib/data/computeStatementsViz.js';
	import {
		selectedModel,
		statementsViz,
		setRadialStatementOrder,
		setSelectedStatementId,
		setSelectedDebateId,
		setSubscaleFilter
	} from '$lib/stores/universalState.js';
	import {
		rankedArchetypes,
		customIdeologyResponses,
		customIdeologySource,
		customIdeologyQuizAnswers,
		ideologyBuilderOpen,
		ideologyQuizOpen,
		ensureIdeologyModelSelected,
		selectIdeologyModel,
		openIdeologyBuilder,
		closeIdeologyBuilder,
		openIdeologyQuiz,
		closeIdeologyQuiz,
		setCustomIdeologyResponses,
		setCustomIdeologyFromQuiz,
		hideCustomIdeologyFromRanking
	} from '$lib/stores/ideologyProfileState.js';
	import { get } from 'svelte/store';
	import { appPath } from '$lib/appPaths.js';
	import {
		ROUTE_IDEOLOGY_QUIZ,
		isIdeologyQuizDeepLink,
		isIdeologyQuizRoute
	} from '$lib/routes.js';
	import { modelSurveyResponsesForBuilder, buildItemScaleMeta, ideologyBuilderResponsesFromFull } from '$lib/data/archetypeSimilarity.js';
	import { computeCustomSurveyResults, isCompleteQuizAnswers } from '$lib/data/quizScoring.js';
	import { encoding } from '$lib/data/dataset.js';
	import statementModelAveragesRaw from '../../../data/statement_model_averages.json';

	let { children } = $props();

	const MOBILE_VIEWPORT_MQ = '(max-width: 767px)';
	const scaleMeta = buildItemScaleMeta(encoding);
	const averagesRows = Array.isArray(statementModelAveragesRaw?.rows)
		? statementModelAveragesRaw.rows
		: [];

	let viewportMobile = $state(false);
	let radialCellW = $state(0);
	let radialCellH = $state(0);
	let builderDraft = $state(/** @type {Record<string, number>} */ ({}));
	/** @type {Record<string, 'A' | 'B'> | null} */
	let pendingQuizAnswers = $state(null);
	/** @type {{ surveyResponses: Record<string, number>, quizAnswers: Record<string, 'A' | 'B'> | null } | null} */
	let pendingIdeologyResults = $state(null);

	const visibleModels = $derived(
		MODEL_ORDER.filter((m) =>
			($statementsViz?.modelSeries ?? []).some((s) => s.fundModel === m)
		)
	);

	const radialSquare = $derived.by(() => {
		const w = Math.max(radialCellW, 1) - 16;
		if (viewportMobile) {
			return Math.max(260, Math.min(360, Math.floor(w)));
		}
		return Math.max(
			260,
			Math.floor(Math.min(w, Math.max(radialCellH, 1) - 16))
		);
	});

	const ideologyModel = $derived(String($selectedModel ?? '').trim());

	const ideologySelectedModels = $derived(
		ideologyModel ? [ideologyModel] : []
	);

	onMount(() => {
		setSelectedDebateId(null);
		setSelectedStatementId(null);
		setSubscaleFilter(null);
		setRadialStatementOrder(STATEMENT_ORDER_SUBSCALE);
		ensureIdeologyModelSelected();

		const mq = window.matchMedia(MOBILE_VIEWPORT_MQ);
		const syncViewport = () => {
			viewportMobile = mq.matches;
		};
		syncViewport();
		mq.addEventListener('change', syncViewport);
		return () => mq.removeEventListener('change', syncViewport);
	});

	$effect(() => {
		const pathname = $page.url.pathname;
		if (isIdeologyQuizRoute(pathname)) {
			openIdeologyQuiz();
			return;
		}
		if (!isIdeologyQuizDeepLink($page.url.searchParams)) return;
		openIdeologyQuiz();
		goto(appPath(ROUTE_IDEOLOGY_QUIZ), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	});

	function handleOpenBuilder() {
		pendingQuizAnswers = null;
		const model = ensureIdeologyModelSelected();
		const existing = $customIdeologyResponses;
		builderDraft =
			existing && Object.keys(existing).length
				? ideologyBuilderResponsesFromFull(existing, scaleMeta)
				: modelSurveyResponsesForBuilder(model, averagesRows, scaleMeta);
		openIdeologyBuilder();
	}

	function handleBuilderDraftChange(responses) {
		builderDraft = { ...responses };
	}

	function handleBuilderSave(responses) {
		const prevSource = get(customIdeologySource);
		const quizAnswers = pendingQuizAnswers ?? get(customIdeologyQuizAnswers);
		const source =
			pendingQuizAnswers || prevSource === 'quiz' || prevSource === 'refined'
				? 'refined'
				: 'builder';
		const savedQuizAnswers = isCompleteQuizAnswers(quizAnswers) ? { ...quizAnswers } : null;
		setCustomIdeologyResponses(responses, true, source, savedQuizAnswers);
		builderDraft = { ...responses };
		pendingQuizAnswers = null;

		pendingIdeologyResults = {
			surveyResponses: { ...responses },
			quizAnswers: savedQuizAnswers
		};
		closeIdeologyBuilder();
		openIdeologyQuiz();
	}

	function handleQuizAdd(responses, quizAnswers, topMatchModel) {
		setCustomIdeologyFromQuiz(responses, quizAnswers);
		const model = String(topMatchModel ?? '').trim();
		if (model) selectIdeologyModel(model);
	}

	function handleIdeologyResultsClose() {
		closeIdeologyQuiz();
		pendingIdeologyResults = null;
	}

	function handleIdeologyResultsConsumed() {
		const payload = pendingIdeologyResults;
		if (!payload) return;
		const computed = computeCustomSurveyResults(
			payload.surveyResponses,
			encoding,
			averagesRows,
			visibleModels,
			{ insightMode: 'builder' }
		);
		if (computed?.topMatch.model) selectIdeologyModel(computed.topMatch.model);
		pendingIdeologyResults = null;
	}

	function handleQuizRefine(draft, quizAnswers) {
		builderDraft = { ...draft };
		pendingQuizAnswers = { ...quizAnswers };
		closeIdeologyQuiz();
		openIdeologyBuilder();
	}
</script>

<svelte:head>
	<title>Ideologic Profiles — Everyday Ethics of AI</title>
</svelte:head>

<div class="min-h-0 overflow-x-hidden bg-slate-100 text-slate-900 md:min-h-screen" data-ideology-profile-root>
	<div
		class="flex min-h-0 flex-col rounded-lg bg-slate-100 ring-1 ring-slate-300 md:h-[100vh] md:overflow-hidden"
	>
		<header
			class="sticky top-0 z-[100] w-full shrink-0 bg-[#4B4B4E] px-3 py-3 md:relative md:px-4"
		>
			<div class="flex items-center justify-end gap-2">
				<div class="shrink-0">
					<SiteHamburgerMenu lightIcon />
				</div>
			</div>
		</header>

		{#if $statementsViz}
			<div
				class="flex flex-col md:min-h-0 md:flex-1 md:flex-row md:overflow-hidden"
			>
				<div
					class="relative z-0 order-1 shrink-0 overflow-hidden bg-white md:order-1 md:flex md:min-h-0 md:min-w-0 md:flex-1 md:flex-col"
				>
					<div
						class="flex shrink-0 flex-col items-center justify-center px-2 py-2 md:min-h-0 md:flex-1 md:overflow-hidden md:px-4 md:py-4"
						bind:clientWidth={radialCellW}
						bind:clientHeight={radialCellH}
					>
						<div
							class="relative mx-auto w-full max-w-full md:min-h-0 md:flex-1"
							style={viewportMobile ? `height: ${radialSquare}px` : undefined}
						>
							<StatementsRadialChart
								width={radialSquare}
								height={radialSquare}
								viz={$statementsViz}
								selectedModel={$selectedModel}
								selectedModels={ideologySelectedModels}
								debatePrimaryTensions={[]}
								radialSortMode={STATEMENT_ORDER_SUBSCALE}
								onRadialSortModeChange={() => {}}
								highlightSubscaleKey={null}
								onSubscaleWedgeClick={() => {}}
								statementSelectEnabled={false}
								onStatementSelect={() => {}}
							/>
						</div>
					</div>
				</div>

				<aside
					class="order-2 w-full max-w-full shrink-0 border-t border-slate-300 bg-slate-100 md:order-2 md:flex md:min-h-0 md:w-[35vw] md:min-w-[320px] md:max-w-[440px] md:flex-col md:overflow-hidden md:border-l md:border-t-0"
				>
					<IdeologyProfileTray
						models={visibleModels}
						selectedModel={ideologyModel}
						rankings={$rankedArchetypes}
						onSelectModel={selectIdeologyModel}
						onOpenQuiz={openIdeologyQuiz}
						onRefineCustom={handleOpenBuilder}
						onRemoveCustom={hideCustomIdeologyFromRanking}
					/>
				</aside>
			</div>
		{:else}
			<p class="p-4 text-sm text-slate-500">No data.</p>
		{/if}
	</div>
</div>

<IdeologyBuilderPanel
	open={$ideologyBuilderOpen}
	draftResponses={builderDraft}
	onDraftChange={handleBuilderDraftChange}
	onSave={handleBuilderSave}
	onClose={closeIdeologyBuilder}
/>

<IdeologyQuizPanel
	open={$ideologyQuizOpen}
	models={visibleModels}
	externalResults={pendingIdeologyResults}
	onExternalResultsConsumed={handleIdeologyResultsConsumed}
	onClose={handleIdeologyResultsClose}
	onQuizComplete={handleQuizAdd}
	onRefine={handleQuizRefine}
	onEditBuilder={handleOpenBuilder}
/>

{@render children()}
