<script lang="ts">
	import type { Instruction, CSR } from '$lib/types';
	import BitVector from './BitVector.svelte';

	interface Props {
		item: Instruction | CSR;
	}

	let { item }: Props = $props();

	let expanded = $state(false);

	function isInstruction(item: Instruction | CSR): item is Instruction {
		return item.type === 'instruction' || item.type === 'pseudo';
	}

	function formatExtension(ext: string): string {
		return ext
			.replace('rv_', '')
			.replace('rv32_', '32/')
			.replace('rv64_', '64/')
			.replace('unratified/', '')
			.toUpperCase();
	}

	function formatOperands(operands: string[]): string {
		return operands
			.map((op) => {
				if (op.startsWith('imm') || op.startsWith('bimm') || op.startsWith('simm') || op.startsWith('jimm')) {
					return 'imm';
				}
				if (op.startsWith('c_')) {
					return op.replace('c_', '');
				}
				return op;
			})
			.join(', ');
	}

	function getTypeLabel(type: string): string {
		switch (type) {
			case 'instruction':
				return 'INSTR';
			case 'pseudo':
				return 'PSEUDO';
			case 'csr':
				return 'CSR';
			default:
				return type.toUpperCase();
		}
	}

	function getTypeClass(type: string): string {
		return `type-${type}`;
	}
</script>

<article class="card" class:expanded>
	<button class="card-header" onclick={() => (expanded = !expanded)}>
		<div class="card-main">
			<span class="name">{item.name}</span>
			{#if isInstruction(item)}
				<span class="operands">{formatOperands(item.operands)}</span>
			{:else}
				<span class="address">{item.address}</span>
			{/if}
		</div>
		<div class="card-meta">
			{#if isInstruction(item)}
				<span class="extension">{formatExtension(item.extension)}</span>
			{:else}
				<span class="privilege">{item.privilege}</span>
			{/if}
			<span class="type {getTypeClass(item.type)}">{getTypeLabel(item.type)}</span>
			<svg
				class="chevron"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="m6 9 6 6 6-6" />
			</svg>
		</div>
	</button>

	{#if expanded}
		<div class="card-details">
			{#if isInstruction(item) && item.encoding.length > 0}
				<div class="encoding-section">
					<BitVector encoding={item.encoding} operands={item.operands} />
				</div>
			{/if}

			{#if item.description}
				<p class="description">{item.description}</p>
			{:else}
				<p class="description muted">No description available.</p>
			{/if}

			{#if isInstruction(item)}
				<div class="details-grid">
					<div class="detail">
						<span class="detail-label">Extension</span>
						<span class="detail-value">{item.extension}</span>
					</div>
					<div class="detail">
						<span class="detail-label">Operands</span>
						<span class="detail-value mono">{item.operands.join(', ') || 'none'}</span>
					</div>
				</div>
			{:else}
				<div class="details-grid">
					<div class="detail">
						<span class="detail-label">Address</span>
						<span class="detail-value mono">{item.address}</span>
					</div>
					<div class="detail">
						<span class="detail-label">Privilege</span>
						<span class="detail-value">{item.privilege}</span>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</article>

<style>
	.card {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		transition: border-color 0.15s;
	}

	.card:hover {
		border-color: var(--border-hover);
	}

	.card.expanded {
		border-color: var(--accent);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.875rem 1rem;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		color: inherit;
	}

	.card-main {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		min-width: 0;
	}

	.name {
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 1rem;
		color: var(--text);
	}

	.operands,
	.address {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.card-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.extension,
	.privilege {
		font-size: 0.75rem;
		color: var(--text-muted);
		padding: 0.125rem 0.5rem;
		background: var(--bg-tertiary);
		border-radius: 4px;
	}

	.type {
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
	}

	.type-instruction {
		background: var(--type-instr-bg);
		color: var(--type-instr-text);
	}

	.type-pseudo {
		background: var(--type-pseudo-bg);
		color: var(--type-pseudo-text);
	}

	.type-csr {
		background: var(--type-csr-bg);
		color: var(--type-csr-text);
	}

	.chevron {
		width: 1rem;
		height: 1rem;
		color: var(--text-muted);
		transition: transform 0.15s;
	}

	.expanded .chevron {
		transform: rotate(180deg);
	}

	.card-details {
		padding: 0 1rem 1rem;
		border-top: 1px solid var(--border);
	}

	.encoding-section {
		margin: 1rem 0;
	}

	.description {
		margin: 1rem 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.description.muted {
		color: var(--text-muted);
		font-style: italic;
	}

	.details-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.75rem;
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.detail-label {
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.detail-value {
		font-size: 0.875rem;
		color: var(--text);
	}

	.detail-value.mono {
		font-family: var(--font-mono);
	}
</style>
