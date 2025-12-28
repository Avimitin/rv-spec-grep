<script lang="ts">
	interface Props {
		value: string;
		placeholder?: string;
		onInput: (value: string) => void;
	}

	let { value = $bindable(), placeholder = 'Search instructions or CSRs...', onInput }: Props = $props();

	let inputEl: HTMLInputElement;

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		onInput(target.value);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			value = '';
			onInput('');
		}
	}

	function clear() {
		value = '';
		onInput('');
		inputEl?.focus();
	}

	export function focus() {
		inputEl?.focus();
	}
</script>

<div class="search-box">
	<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		<circle cx="11" cy="11" r="8" />
		<path d="m21 21-4.35-4.35" />
	</svg>
	<input
		bind:this={inputEl}
		type="text"
		{value}
		{placeholder}
		oninput={handleInput}
		onkeydown={handleKeydown}
		spellcheck="false"
		autocomplete="off"
	/>
	{#if value}
		<button class="clear-btn" onclick={clear} aria-label="Clear search">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6 6 18M6 6l12 12" />
			</svg>
		</button>
	{/if}
</div>

<style>
	.search-box {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 8px;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.search-box:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-shadow);
	}

	.search-icon {
		width: 1.25rem;
		height: 1.25rem;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	input {
		flex: 1;
		border: none;
		background: transparent;
		font-size: 1rem;
		font-family: inherit;
		color: var(--text);
		outline: none;
	}

	input::placeholder {
		color: var(--text-muted);
	}

	.clear-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border: none;
		background: var(--bg-tertiary);
		border-radius: 4px;
		cursor: pointer;
		color: var(--text-muted);
		transition: background 0.15s, color 0.15s;
	}

	.clear-btn:hover {
		background: var(--accent);
		color: white;
	}

	.clear-btn svg {
		width: 0.875rem;
		height: 0.875rem;
	}
</style>
