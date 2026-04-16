<script>
	/** @type {{ item_id: string, question: string }[]} */
	let { questions, selectedItemId = null, onSelect } = $props();

	const PLACEHOLDER = 'What ethical questions are you interested in?';

	let filterText = $state('');
	let open = $state(false);
	/** @type {ReturnType<typeof setTimeout> | null} */
	let blurCloseTimer = null;

	const selectedQuestion = $derived(
		selectedItemId
			? questions.find((q) => q.item_id === selectedItemId)?.question ?? ''
			: ''
	);

	$effect(() => {
		if (selectedItemId) {
			const q = questions.find((x) => x.item_id === selectedItemId);
			if (q) filterText = q.question;
		} else {
			// Tray / elsewhere cleared statement — reset bar to match (empty + no typed query).
			filterText = '';
			open = false;
		}
	});

	const normalizedQuery = $derived(filterText.trim().toLowerCase());

	const filteredQuestions = $derived(
		normalizedQuery === ''
			? questions
			: questions.filter((q) => q.question.toLowerCase().includes(normalizedQuery))
	);

	const hasSelection = $derived(
		selectedItemId != null && String(selectedItemId).trim() !== ''
	);

	function pickQuestion(/** @type {{ item_id: string, question: string }} */ q) {
		filterText = q.question;
		open = false;
		onSelect?.(q.item_id);
	}

	function clearSelection() {
		filterText = '';
		open = false;
		onSelect?.(null);
	}

	function handleInput() {
		open = true;
	}

	function handleFocus() {
		open = true;
		if (!filterText.trim() && selectedQuestion) {
			filterText = selectedQuestion;
		}
	}

	function handleBlur() {
		blurCloseTimer = setTimeout(() => {
			open = false;
			blurCloseTimer = null;
		}, 150);
	}

	function cancelBlurClose() {
		if (blurCloseTimer) {
			clearTimeout(blurCloseTimer);
			blurCloseTimer = null;
		}
	}

	/** @param {KeyboardEvent} e */
	function handleKeydown(e) {
		if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<div class="relative flex min-w-0 flex-1 items-stretch gap-2">
	<label class="relative min-w-0 flex-1">
		<span class="sr-only">Ethical question</span>
		<input
			type="text"
			autocomplete="off"
			placeholder={PLACEHOLDER}
			class="box-border w-full min-w-0 rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-3 text-sm font-normal text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-400"
			bind:value={filterText}
			oninput={handleInput}
			onfocus={handleFocus}
			onblur={handleBlur}
			onkeydown={handleKeydown}
			aria-autocomplete="list"
			aria-expanded={open}
			aria-controls="question-bar-listbox"
			role="combobox"
		/>
		{#if open && filteredQuestions.length > 0}
			<ul
				id="question-bar-listbox"
				class="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
				role="listbox"
				onmousedown={cancelBlurClose}
			>
				{#each filteredQuestions as q (q.item_id)}
					<li role="presentation">
						<button
							type="button"
							class="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none {selectedItemId === q.item_id
								? 'bg-slate-50 font-medium'
								: 'font-normal'}"
							role="option"
							aria-selected={selectedItemId === q.item_id}
							onmousedown={(e) => e.preventDefault()}
							onclick={() => pickQuestion(q)}
						>
							{q.question}
						</button>
					</li>
				{/each}
			</ul>
		{:else if open && normalizedQuery !== '' && filteredQuestions.length === 0}
			<div
				class="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg"
			>
				No questions match.
			</div>
		{/if}
	</label>
	{#if hasSelection}
		<button
			type="button"
			class="flex h-[42px] w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-light leading-none text-slate-500 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
			aria-label="Clear question selection"
			onclick={clearSelection}
		>
			×
		</button>
	{/if}
</div>
