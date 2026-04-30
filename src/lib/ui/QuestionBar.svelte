<script>
	import { tick, untrack } from 'svelte';

	/** @type {{ item_id: string, question: string }[]} */
	let { questions, selectedItemId = null, onSelect } = $props();

	const PLACEHOLDER = 'What ethical questions are you interested in?';

	let filterText = $state('');
	let open = $state(false);
	/** When true, clearing `selectedItemId` in the sync effect must not close the dropdown (bar clear + reopen). */
	let skipCloseDropdownOnClear = $state(false);
	/** @type {HTMLInputElement | null} */
	let inputEl = $state(null);
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
			// Read skip without subscribing: when bar-clear sets skip true then false, we must not
			// re-run this effect and close the dropdown (that was killing open after clear).
			if (!untrack(() => skipCloseDropdownOnClear)) open = false;
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

	async function clearSelection() {
		cancelBlurClose();
		skipCloseDropdownOnClear = true;
		filterText = '';
		onSelect?.(null);
		await tick();
		open = true;
		// Do not focus the input: avoids a stuck caret with no visible list; list shows open above.
		skipCloseDropdownOnClear = false;
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

<div class="relative w-full min-w-0">
	<label class="relative block w-full min-w-0">
		<span class="sr-only">Ethical question</span>
		<div
			class="relative flex min-h-[2.75rem] items-center rounded-md border-2 border-[#595959] bg-white transition"
		>
			<input
				bind:this={inputEl}
				id="question-bar-input"
				type="text"
				autocomplete="off"
				placeholder={PLACEHOLDER}
				class="box-border min-h-[2.75rem] w-full min-w-0 flex-1 rounded-md border-0 bg-transparent py-2.5 pl-6 text-center text-sm font-medium leading-snug text-slate-900 outline-none ring-0 placeholder:font-normal placeholder:text-[#595959] focus:outline-none focus:ring-0 md:text-base {hasSelection
					? 'pr-12'
					: 'pr-6'}"
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
			{#if hasSelection}
				<button
					type="button"
					class="absolute right-1.5 top-1/2 z-10 flex h-9 w-9 shrink-0 -translate-y-1/2 items-center justify-center rounded-md text-xl font-light leading-none text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:bg-slate-100 focus-visible:outline-none"
					aria-label="Clear question selection"
					onmousedown={(e) => e.preventDefault()}
					onclick={clearSelection}
				>
					×
				</button>
			{/if}
		</div>
		{#if open && filteredQuestions.length > 0}
			<ul
				id="question-bar-listbox"
				class="absolute left-0 right-0 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
				role="listbox"
				onmousedown={cancelBlurClose}
			>
				{#each filteredQuestions as q (q.item_id)}
					<li role="presentation">
						<button
							type="button"
							class="w-full px-4 py-3 text-left text-sm text-slate-800 hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none md:text-base {selectedItemId === q.item_id
								? 'bg-slate-50 font-semibold'
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
				class="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-lg md:text-base"
			>
				No questions match.
			</div>
		{/if}
	</label>
</div>
