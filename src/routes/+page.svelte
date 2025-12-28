<script lang="ts">
	import Fuse from 'fuse.js';
	import SearchBox from '$lib/components/SearchBox.svelte';
	import InstructionCard from '$lib/components/InstructionCard.svelte';
	import type { Instruction, CSR, InstructionData } from '$lib/types';

	// This will be replaced with actual data at build time
	import instructionData from '$lib/data/instructions.json';

	const data = instructionData as InstructionData;

	type SearchItem = (Instruction | CSR) & { id: string };

	// Prepare searchable items
	const allItems: SearchItem[] = [
		...data.instructions.map((i, idx) => ({ ...i, id: `instr-${idx}` })),
		...data.csrs.map((c, idx) => ({ ...c, id: `csr-${idx}` })),
	];

	// Initialize Fuse.js for fuzzy search
	const fuse = new Fuse(allItems, {
		keys: [
			{ name: 'name', weight: 2 },
			{ name: 'extension', weight: 0.5 },
			{ name: 'description', weight: 0.3 },
			{ name: 'operands', weight: 0.3 },
		],
		threshold: 0.3,
		includeScore: true,
		minMatchCharLength: 1,
	});

	let query = $state('');
	let results = $state<SearchItem[]>([]);
	let showStats = $state(true);

	function search(q: string) {
		query = q;
		if (!q.trim()) {
			results = [];
			showStats = true;
			return;
		}

		showStats = false;
		const searchResults = fuse.search(q, { limit: 50 });
		results = searchResults.map((r) => r.item);
	}

	// Show some popular instructions on load
	const popularInstructions = allItems
		.filter((i) => ['add', 'sub', 'lw', 'sw', 'beq', 'jal', 'addi', 'lui'].includes(i.name))
		.slice(0, 8);
</script>

<svelte:head>
	<title>RISC-V Spec Grep</title>
</svelte:head>

<main>
	<header>
		<h1>RISC-V Spec Grep</h1>
		<p class="subtitle">Search instructions and CSRs</p>
	</header>

	<div class="search-container">
		<SearchBox value={query} onInput={search} />
	</div>

	{#if showStats}
		<div class="stats">
			<span>{data.instructions.length} instructions</span>
			<span class="sep">|</span>
			<span>{data.csrs.length} CSRs</span>
		</div>

		<section class="examples">
			<h2>Popular Instructions</h2>
			<div class="results-list">
				{#each popularInstructions as item (item.id)}
					<InstructionCard {item} />
				{/each}
			</div>
		</section>
	{:else if results.length > 0}
		<div class="results-header">
			<span>{results.length} result{results.length === 1 ? '' : 's'}</span>
		</div>
		<div class="results-list">
			{#each results as item (item.id)}
				<InstructionCard {item} />
			{/each}
		</div>
	{:else if query}
		<div class="no-results">
			<p>No results found for "{query}"</p>
			<p class="hint">Try searching for instruction names like "add", "lw", or CSRs like "mstatus"</p>
		</div>
	{/if}

	<footer>
		<p>
			Data from
			<a href="https://github.com/riscv/riscv-opcodes" target="_blank" rel="noopener">riscv-opcodes</a>
			and
			<a href="https://github.com/riscv/riscv-isa-manual" target="_blank" rel="noopener">riscv-isa-manual</a>
		</p>
		<p class="generated">Generated: {new Date(data.generatedAt).toLocaleDateString()}</p>
	</footer>
</main>

<style>
	main {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem 1rem;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		margin: 0;
		color: var(--text);
	}

	.subtitle {
		color: var(--text-muted);
		margin: 0.5rem 0 0;
		font-size: 0.9375rem;
	}

	.search-container {
		margin-bottom: 1.5rem;
	}

	.stats {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		color: var(--text-muted);
		font-size: 0.875rem;
		margin-bottom: 2rem;
	}

	.sep {
		opacity: 0.5;
	}

	.examples h2 {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0 0 1rem;
	}

	.results-header {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-bottom: 1rem;
	}

	.results-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.no-results {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--text-muted);
	}

	.no-results p:first-child {
		font-size: 1.125rem;
		margin-bottom: 0.5rem;
	}

	.hint {
		font-size: 0.875rem;
	}

	footer {
		margin-top: auto;
		padding-top: 3rem;
		text-align: center;
		font-size: 0.8125rem;
		color: var(--text-muted);
	}

	footer a {
		color: var(--accent);
		text-decoration: none;
	}

	footer a:hover {
		text-decoration: underline;
	}

	.generated {
		margin-top: 0.25rem;
		font-size: 0.75rem;
		opacity: 0.7;
	}
</style>
