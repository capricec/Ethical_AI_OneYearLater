<script>
	import StatementScaleSlider from '$lib/components/StatementScaleSlider.svelte';
	import { archetypeResponseMatrix, encoding } from '$lib/data/dataset.js';
	import {
		archetypeSurveyResponses,
		buildItemScaleMeta,
		buildIdeologyDistinctivenessWeightShares,
		completeIdeologySurveyResponses
	} from '$lib/data/archetypeSimilarity.js';
	import {
		buildEncodingItemById,
		builderStatementLabelForStatement
	} from '$lib/data/fullSurveyQuestion.js';
	import fullSurveyStatements from '../../../data/full_survey_statements.json';
	import statementModelAveragesRaw from '../../../data/statement_model_averages.json';

	/** @type {{
		open: boolean,
		draftResponses: Record<string, number>,
		onDraftChange?: (responses: Record<string, number>) => void,
		onSave?: (responses: Record<string, number>) => void,
		onClose?: () => void
	}} */
	let {
		open = false,
		draftResponses = {},
		onDraftChange,
		onSave,
		onClose
	} = $props();

	const statements = Array.isArray(fullSurveyStatements?.statements)
		? fullSurveyStatements.statements
		: [];
	const averagesRows = Array.isArray(statementModelAveragesRaw?.rows)
		? statementModelAveragesRaw.rows
		: [];
	const scaleMeta = buildItemScaleMeta(encoding);
	const encodingItemById = buildEncodingItemById(encoding);

	const weightedStatements = $derived.by(() => {
		const { shares } = buildIdeologyDistinctivenessWeightShares(averagesRows, scaleMeta);
		const stmtById = new Map(statements.map((s) => [s.item_id, s]));
		/** @type {{ item_id: string, scale?: object, meanings?: object }[]} */
		const ordered = [];
		for (const share of shares) {
			const stmt = stmtById.get(share.itemId);
			if (!stmt) continue;
			ordered.push({ ...stmt });
		}
		return ordered;
	});

	const archetypeTabs = $derived.by(() => {
		const ids = Array.isArray(archetypeResponseMatrix?.archetypes)
			? archetypeResponseMatrix.archetypes
			: [];
		const titles = Array.isArray(archetypeResponseMatrix?.titles)
			? archetypeResponseMatrix.titles
			: [];
		return ids.map((id, i) => ({
			id: String(id),
			title: String(titles[i] ?? id),
			isCustom: false
		}));
	});

	const presetTabs = $derived([
		{ id: 'custom', title: 'Custom', isCustom: true },
		...archetypeTabs
	]);

	let activeTab = $state('custom');

	$effect(() => {
		if (!open) return;
		activeTab = 'custom';
	});

	function loadArchetypeIntoDraft(archetypeId) {
		const responses = archetypeSurveyResponses(archetypeResponseMatrix, archetypeId, scaleMeta);
		onDraftChange?.({ ...responses });
	}

	function handleTabClick(tabId) {
		activeTab = tabId;
		if (tabId === 'custom') return;
		loadArchetypeIntoDraft(tabId);
	}

	function handleSliderChange(itemId, value) {
		onDraftChange?.({ ...draftResponses, [itemId]: value });
		activeTab = 'custom';
	}

	function handleSave() {
		onSave?.(completeIdeologySurveyResponses(draftResponses, averagesRows, scaleMeta));
		onClose?.();
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
			class="flex h-full w-full max-w-3xl flex-col bg-[#232324] shadow-2xl md:max-h-[min(90vh,820px)] md:rounded-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="ideology-builder-title"
		>
			<header class="shrink-0 border-b border-white/10 px-5 pb-5 pt-5 md:px-8 md:pb-6 md:pt-6">
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0 flex-1 pr-2">
						<h2 id="ideology-builder-title" class="text-lg font-bold text-white md:text-xl">
							Ideology Builder
						</h2>
						<p class="mt-2.5 text-xs leading-relaxed text-white/70 md:mt-3 md:text-sm">
							Choose a preset ideology to adjust sliders, then save to add your custom ideology to
							the ranking.
						</p>
					</div>
					<button
						type="button"
						class="shrink-0 text-2xl leading-none text-white/60 hover:text-white"
						aria-label="Close builder"
						onclick={() => onClose?.()}
					>
						×
					</button>
				</div>

				<div class="ideology-tab-scroll mt-6 overflow-x-auto pt-1">
					<div class="flex flex-nowrap items-center gap-0 whitespace-nowrap text-xs md:text-sm">
						{#each presetTabs as tab, idx (tab.id)}
							{#if idx > 0}
								<span class="shrink-0 px-3 text-white/35 select-none" aria-hidden="true">|</span>
							{/if}
							<button
								type="button"
								class="ideology-tab-btn shrink-0 transition-colors {activeTab === tab.id
									? 'font-bold text-white'
									: 'font-medium text-white/50 hover:text-white/80'}"
								onclick={() => handleTabClick(tab.id)}
							>
								{tab.title}
							</button>
						{/each}
						<span class="block shrink-0 w-8 md:w-10" aria-hidden="true"></span>
					</div>
				</div>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-8 md:py-5">
				{#each weightedStatements as stmt (stmt.item_id)}
					{@const lo = Number(stmt.scale?.min ?? 1)}
					{@const hi = Number(stmt.scale?.max ?? 6)}
					{@const current = draftResponses[stmt.item_id] ?? Math.round((lo + hi) / 2)}
					{@const label = builderStatementLabelForStatement(stmt.item_id, encodingItemById)}
					<StatementScaleSlider
						id={`slider-${stmt.item_id}`}
						{label}
						min={lo}
						max={hi}
						minLabel={stmt.meanings?.min ?? ''}
						maxLabel={stmt.meanings?.max ?? ''}
						value={current}
						onChange={(v) => handleSliderChange(stmt.item_id, v)}
					/>
				{/each}
			</div>

			<footer class="shrink-0 border-t border-white/10 px-5 py-5 md:px-8 md:py-6">
				<button
					type="button"
					class="w-full rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 md:py-3.5"
					onclick={handleSave}
				>
					Save custom ideology
				</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.ideology-tab-scroll {
		scrollbar-width: none;
		-ms-overflow-style: none;
		scroll-padding-inline-end: 2rem;
		margin-inline: -0.25rem;
		padding-inline: 0.25rem 0.5rem;
	}

	.ideology-tab-scroll::-webkit-scrollbar {
		display: none;
	}

	.ideology-tab-btn:focus {
		outline: none;
	}

	.ideology-tab-btn:focus-visible {
		outline: 2px solid rgba(255, 255, 255, 0.55);
		outline-offset: 3px;
		border-radius: 0.125rem;
	}
</style>
