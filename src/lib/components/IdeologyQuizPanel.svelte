<script>
	import { archetypeResponseMatrix, encoding } from '$lib/data/dataset.js';
	import { ideologyBuilderResponsesFromFull, buildItemScaleMeta } from '$lib/data/archetypeSimilarity.js';
	import { computeQuizResults, computeCustomSurveyResults, getQuizQuestions, isCompleteQuizAnswers } from '$lib/data/quizScoring.js';
	import { customIdeologyQuizAnswers, customIdeologyResponses, customIdeologySource, clearIdeologyQuizAnswers } from '$lib/stores/ideologyProfileState.js';
	import { modelColor } from '$lib/viz/modelColors.js';
	import statementModelAveragesRaw from '../../../data/statement_model_averages.json';

	/** @type {{
		open: boolean,
		models: string[],
		externalResults?: {
			surveyResponses: Record<string, number>,
			quizAnswers?: Record<string, 'A' | 'B'> | null
		} | null,
		onExternalResultsConsumed?: () => void,
		onClose?: () => void,
		onQuizComplete?: (
			responses: Record<string, number>,
			answers: Record<string, 'A' | 'B'>,
			topMatchModel?: string
		) => void,
		onRefine?: (draftResponses: Record<string, number>, answers: Record<string, 'A' | 'B'>) => void,
		onEditBuilder?: () => void
	}} */
	let {
		open = false,
		models = [],
		externalResults = null,
		onExternalResultsConsumed,
		onClose,
		onQuizComplete,
		onRefine,
		onEditBuilder
	} = $props();

	const questions = getQuizQuestions();
	const averagesRows = Array.isArray(statementModelAveragesRaw?.rows)
		? statementModelAveragesRaw.rows
		: [];
	const scaleMeta = buildItemScaleMeta(encoding);

	let step = $state(0);
	/** @type {Record<string, 'A' | 'B'>} */
	let answers = $state({});
	let showResults = $state(false);
	let quizOpened = $state(false);
	/** @type {{ surveyResponses: Record<string, number>, quizAnswers: Record<string, 'A' | 'B'> | null } | null} */
	let builderResultsSnapshot = $state(null);
	/** @type {'quiz' | 'builder' | null} */
	let resultsInsightMode = $state(null);

	const currentQuestion = $derived(questions[step] ?? null);
	const answeredCount = $derived(
		questions.filter((q) => answers[q.id] === 'A' || answers[q.id] === 'B').length
	);
	const allAnswered = $derived(answeredCount === questions.length && questions.length > 0);
	const canRetakeQuiz = $derived(isCompleteQuizAnswers(answers));

	const results = $derived.by(() => {
		if (builderResultsSnapshot) {
			return computeCustomSurveyResults(
				builderResultsSnapshot.surveyResponses,
				encoding,
				averagesRows,
				models,
				{ insightMode: 'builder' }
			);
		}
		if (!showResults) return null;

		const mode = resultsInsightMode ?? 'quiz';

		if (mode === 'quiz' && allAnswered) {
			return computeQuizResults(answers, archetypeResponseMatrix, encoding, averagesRows, models);
		}

		if (mode === 'builder') {
			const survey = $customIdeologyResponses;
			if (!survey || !Object.keys(survey).length) return null;
			return computeCustomSurveyResults(survey, encoding, averagesRows, models, {
				insightMode: 'builder'
			});
		}

		return null;
	});

	const showingResults = $derived(Boolean(results));

	$effect(() => {
		if (!open) {
			quizOpened = false;
			builderResultsSnapshot = null;
			resultsInsightMode = null;
			return;
		}
		if (quizOpened) return;
		quizOpened = true;

		if (externalResults?.surveyResponses) {
			builderResultsSnapshot = {
				surveyResponses: { ...externalResults.surveyResponses },
				quizAnswers: externalResults.quizAnswers ? { ...externalResults.quizAnswers } : null
			};
			answers = externalResults.quizAnswers ? { ...externalResults.quizAnswers } : {};
			resultsInsightMode = 'builder';
			showResults = true;
			onExternalResultsConsumed?.();
			return;
		}

		const saved = $customIdeologyQuizAnswers;
		if (isCompleteQuizAnswers(saved)) {
			answers = { ...saved };
			resultsInsightMode = $customIdeologySource === 'quiz' ? 'quiz' : 'builder';
			showResults = true;
			step = Math.max(0, questions.length - 1);
			return;
		}
		step = 0;
		answers = {};
		resultsInsightMode = null;
		showResults = false;
	});

	/** @param {Record<string, 'A' | 'B'>} nextAnswers */
	function finishQuiz(nextAnswers) {
		answers = nextAnswers;
		resultsInsightMode = 'quiz';
		showResults = true;
		const computed = computeQuizResults(
			nextAnswers,
			archetypeResponseMatrix,
			encoding,
			averagesRows,
			models
		);
		if (computed) {
			onQuizComplete?.(
				{ ...computed.completeSurveyResponses },
				{ ...nextAnswers },
				computed.topMatch.model
			);
		}
	}

	/** @param {'A' | 'B'} choice */
	function selectChoice(choice) {
		if (!currentQuestion || showResults) return;
		const nextAnswers = { ...answers, [currentQuestion.id]: choice };
		if (step < questions.length - 1) {
			answers = nextAnswers;
			step += 1;
			return;
		}
		finishQuiz(nextAnswers);
	}

	function goBack() {
		if (showResults) return;
		if (step > 0) step -= 1;
	}

	function handleRefine() {
		if (!results) return;
		const draft = ideologyBuilderResponsesFromFull(results.completeSurveyResponses, scaleMeta);
		onRefine?.(draft, { ...answers });
	}

	function retakeQuiz() {
		clearIdeologyQuizAnswers();
		builderResultsSnapshot = null;
		resultsInsightMode = null;
		step = 0;
		answers = {};
		showResults = false;
	}

	function handleEditBuilder() {
		builderResultsSnapshot = null;
		showResults = false;
		onClose?.();
		onEditBuilder?.();
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-[150] flex items-stretch justify-center bg-black/50 p-0 md:items-center md:p-6"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose?.();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose?.();
		}}
	>
		<div
			class="flex h-full w-full max-w-2xl flex-col bg-[#232324] shadow-2xl md:max-h-[min(90vh,760px)] md:rounded-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="ideology-quiz-title"
		>
			<header class="relative shrink-0 border-b border-white/10 px-5 pb-4 pt-5 md:px-8 md:pt-6">
				<div
					class={showingResults ? 'pr-44 md:pr-52' : 'pr-10 md:pr-12'}
				>
					<h2 id="ideology-quiz-title" class="text-lg font-bold text-white md:text-xl">
						{showingResults ? 'Your ideology results' : 'Which AI Model Aligns With You?'}
					</h2>
					{#if !showingResults}
						<p class="mt-2 text-xs leading-relaxed text-white/70 md:text-sm">
							Choose the option that best matches your view on each scenario.
						</p>
					{/if}
				</div>
				<div class="absolute right-5 top-5 flex items-center gap-2 md:right-8 md:top-6">
					{#if showingResults && results}
						<button
							type="button"
							class="translate-y-px text-xs font-medium leading-none text-white/65 underline-offset-2 hover:text-white hover:underline"
							onclick={handleRefine}
						>
							Refine in builder
						</button>
					{/if}
					<button
						type="button"
						class="flex h-8 w-8 shrink-0 items-center justify-center text-2xl leading-none text-white/60 hover:text-white"
						aria-label="Close quiz"
						onclick={() => onClose?.()}
					>
						×
					</button>
				</div>
				{#if !showingResults && questions.length}
					<div class="mt-4 flex items-center gap-3">
						<div
							class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/15"
							role="progressbar"
							aria-valuemin="0"
							aria-valuemax={questions.length}
							aria-valuenow={step + 1}
						>
							<div
								class="h-full rounded-full bg-white/80 transition-all"
								style={`width: ${((step + 1) / questions.length) * 100}%`}
							></div>
						</div>
						<span class="shrink-0 text-xs tabular-nums text-white/55">
							{step + 1}/{questions.length}
						</span>
					</div>
				{/if}
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-6">
				{#if showingResults && results}
					<section class="w-full rounded-xl bg-white/10 px-4 py-4 ring-1 ring-white/15">
						<p class="text-[10px] font-bold uppercase tracking-wider text-white/50">Top match</p>
						<div class="mt-2 flex items-center gap-3">
							<div
								class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
								style={`background-color: ${modelColor(results.topMatch.model)};`}
							>
								{results.topMatch.similarityPct}%
							</div>
							<h3 class="text-[13px] font-bold text-white md:text-lg">{results.topMatch.model}</h3>
						</div>
					</section>

					{#if results.strongestAgreement.length}
						<section class="mt-5">
							<p class="text-[10px] font-bold uppercase tracking-wider text-white/50">
								Areas of strongest agreement
							</p>
							<ul class="mt-3 space-y-2">
								{#each results.strongestAgreement as item (item.id)}
									<li class="rounded-lg bg-white/5 px-3 py-2.5 text-sm leading-snug text-white/90">
										<p class="font-medium text-white">{item.prompt}</p>
										{#if item.userChoiceLabel}
											<p class="mt-1 text-xs leading-snug text-white/60">
												You chose: {item.userChoiceLabel}
											</p>
										{/if}
									</li>
								{/each}
							</ul>
						</section>
					{/if}

					{#if results.strongestDisagreement.length}
						<section class="mt-5">
							<p class="text-[10px] font-bold uppercase tracking-wider text-white/50">
								Areas of strongest disagreement
							</p>
							<ul class="mt-3 space-y-2">
								{#each results.strongestDisagreement as item (item.id)}
									<li class="rounded-lg bg-white/5 px-3 py-2.5 text-sm leading-snug text-white/90">
										<p class="font-medium text-white">{item.prompt}</p>
										{#if item.userChoiceLabel}
											<p class="mt-1 text-xs leading-snug text-white/60">
												You chose: {item.userChoiceLabel}
											</p>
										{/if}
									</li>
								{/each}
							</ul>
						</section>
					{/if}

					{#if results.runnerUp}
						<section class="mt-10 w-full rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15">
							<p class="text-[9px] font-bold uppercase tracking-wider text-white/45">Runner-up</p>
							<div class="mt-1.5 flex items-center gap-2.5">
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
									style={`background-color: ${modelColor(results.runnerUp.model)};`}
								>
									{results.runnerUp.similarityPct}%
								</div>
								<h3 class="text-xs font-semibold text-white md:text-sm">{results.runnerUp.model}</h3>
							</div>
						</section>
					{/if}
				{:else if currentQuestion}
					<p class="text-base font-semibold leading-snug text-white md:text-lg">
						{currentQuestion.prompt}
					</p>
					<div class="mt-5 space-y-3">
						<button
							type="button"
							class="quiz-option w-full rounded-xl border px-4 py-4 text-left transition-colors {answers[
								currentQuestion.id
							] === 'A'
								? 'border-white bg-white text-slate-900'
								: 'border-white/20 bg-white/5 text-white hover:border-white/35 hover:bg-white/10'}"
							onclick={() => selectChoice('A')}
						>
							<span class="mb-1 block text-[10px] font-bold uppercase tracking-wider opacity-60"
								>Option A</span
							>
							<span class="text-sm leading-snug md:text-base">{currentQuestion.option_a}</span>
						</button>
						<button
							type="button"
							class="quiz-option w-full rounded-xl border px-4 py-4 text-left transition-colors {answers[
								currentQuestion.id
							] === 'B'
								? 'border-white bg-white text-slate-900'
								: 'border-white/20 bg-white/5 text-white hover:border-white/35 hover:bg-white/10'}"
							onclick={() => selectChoice('B')}
						>
							<span class="mb-1 block text-[10px] font-bold uppercase tracking-wider opacity-60"
								>Option B</span
							>
							<span class="text-sm leading-snug md:text-base">{currentQuestion.option_b}</span>
						</button>
					</div>
				{:else}
					<p class="text-sm text-white/70">No quiz questions configured.</p>
				{/if}
			</div>

			<footer class="shrink-0 border-t border-white/10 px-5 py-4 md:px-8 md:py-5">
				{#if showingResults && results}
					<div class="flex items-stretch gap-2">
						{#if canRetakeQuiz}
							<button
								type="button"
								class="shrink-0 rounded-full border border-white/20 px-3 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/10"
								onclick={retakeQuiz}
							>
								Retake quiz
							</button>
						{:else}
							<button
								type="button"
								class="shrink-0 rounded-full border border-white/20 px-3 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/10"
								onclick={handleEditBuilder}
							>
								Edit profile
							</button>
						{/if}
						<button
							type="button"
							class="min-w-0 flex-1 rounded-full bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100"
							onclick={() => onClose?.()}
						>
							<span class="md:hidden">View All Comparisons</span>
							<span class="hidden md:inline">View all Ideological Comparisons</span>
						</button>
					</div>
				{:else}
					<button
						type="button"
						class="rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40"
						disabled={step === 0}
						onclick={goBack}
					>
						Back
					</button>
				{/if}
			</footer>
		</div>
	</div>
{/if}

<style>
	.quiz-option:focus {
		outline: none;
	}

	.quiz-option:focus-visible {
		outline: 2px solid rgba(255, 255, 255, 0.55);
		outline-offset: 2px;
	}
</style>
