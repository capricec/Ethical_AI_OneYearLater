<script>
	/** @type {{ centered?: boolean }} */
	let { centered = true } = $props();
</script>

<div
	class="flex w-full"
	class:justify-center={centered}
	class:justify-start={!centered}
	role="status"
	aria-live="polite"
	aria-label="Message incoming"
>
	<div class="typing-bubble" aria-hidden="true">
		<span class="typing-dot"></span>
		<span class="typing-dot"></span>
		<span class="typing-dot"></span>
	</div>
</div>

<style>
	.typing-bubble {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		min-width: 3.5rem;
		padding: 10px 14px;
		border-radius: 1rem;
		background: #4b4b4e;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.typing-dot {
		width: 7px;
		height: 7px;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.55);
		animation: typing-bounce 1.1s ease-in-out infinite;
	}

	.typing-dot:nth-child(2) {
		animation-delay: 0.15s;
	}

	.typing-dot:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes typing-bounce {
		0%,
		60%,
		100% {
			transform: translateY(0);
			opacity: 0.45;
		}
		30% {
			transform: translateY(-4px);
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.typing-dot {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
