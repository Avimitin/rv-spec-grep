<script lang="ts">
	import type { BitField } from '$lib/types';

	interface Props {
		encoding: BitField[];
		operands: string[];
	}

	let { encoding, operands }: Props = $props();

	// Field color palette
	const FIELD_COLORS = [
		'var(--field-1)',
		'var(--field-2)',
		'var(--field-3)',
		'var(--field-4)',
		'var(--field-5)',
		'var(--field-6)',
	];

	interface VisualField {
		high: number;
		low: number;
		width: number;
		value: string;
		color: string;
		isOpcode: boolean;
	}

	// Known field bit ranges for labeling
	const KNOWN_FIELDS: Record<string, { high: number; low: number }> = {
		opcode: { high: 6, low: 0 },
		rd: { high: 11, low: 7 },
		funct3: { high: 14, low: 12 },
		rs1: { high: 19, low: 15 },
		rs2: { high: 24, low: 20 },
		funct7: { high: 31, low: 25 },
	};

	function buildVisualFields(): VisualField[] {
		// Create a 32-bit array to track which bits are assigned
		const bits: (VisualField | null)[] = Array(32).fill(null);
		const fields: VisualField[] = [];

		// Sort encoding by high bit descending
		const sortedEncoding = [...encoding].sort((a, b) => b.high - a.high);

		let colorIndex = 0;
		for (const field of sortedEncoding) {
			const width = field.high - field.low + 1;
			const value = typeof field.value === 'number'
				? field.value.toString(2).padStart(width, '0')
				: field.value;

			const isOpcode = field.low === 0 && field.high <= 6;
			const color = isOpcode ? 'var(--field-opcode)' : FIELD_COLORS[colorIndex % FIELD_COLORS.length];

			const visualField: VisualField = {
				high: field.high,
				low: field.low,
				width,
				value,
				color,
				isOpcode,
			};

			fields.push(visualField);

			// Mark bits as assigned
			for (let i = field.low; i <= field.high; i++) {
				bits[i] = visualField;
			}

			if (!isOpcode) colorIndex++;
		}

		// Fill in gaps with operand fields
		const operandFields = operands.filter(op => KNOWN_FIELDS[op]);
		for (const op of operandFields) {
			const range = KNOWN_FIELDS[op];
			if (!range) continue;

			// Check if this range is already filled
			let filled = false;
			for (let i = range.low; i <= range.high; i++) {
				if (bits[i]) {
					filled = true;
					break;
				}
			}

			if (!filled) {
				const width = range.high - range.low + 1;
				const visualField: VisualField = {
					high: range.high,
					low: range.low,
					width,
					value: op,
					color: 'var(--field-operand)',
					isOpcode: false,
				};
				fields.push(visualField);
				for (let i = range.low; i <= range.high; i++) {
					bits[i] = visualField;
				}
			}
		}

		// Sort by position (high bit descending)
		return fields.sort((a, b) => b.high - a.high);
	}

	function getLabel(field: VisualField): string {
		if (field.isOpcode) return 'opcode';

		// Check if value is an operand name
		if (/^[a-z]+\d?$/.test(field.value)) {
			return field.value;
		}

		// Check known field positions
		for (const [name, range] of Object.entries(KNOWN_FIELDS)) {
			if (field.high === range.high && field.low === range.low) {
				return name;
			}
		}

		// For small fields, show the bits
		if (field.width <= 3) {
			return field.value;
		}

		return '';
	}

	const visualFields = $derived(buildVisualFields());
	const totalWidth = $derived(visualFields.reduce((sum, f) => sum + f.width, 0));
</script>

<div class="bitvector">
	<div class="bit-header">
		{#each Array(32) as _, i}
			{@const bit = 31 - i}
			{#if bit % 4 === 3 || bit === 0}
				<span class="bit-num" style="left: {((31 - bit) / 32) * 100}%">{bit}</span>
			{/if}
		{/each}
	</div>
	<div class="bit-fields">
		{#each visualFields as field}
			<div
				class="field"
				style="width: {(field.width / 32) * 100}%; background: {field.color}"
				title="{getLabel(field)}: bits [{field.high}:{field.low}] = {field.value}"
			>
				<span class="field-value">{field.value}</span>
				{#if getLabel(field) && getLabel(field) !== field.value}
					<span class="field-label">{getLabel(field)}</span>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.bitvector {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		user-select: none;
	}

	.bit-header {
		position: relative;
		height: 1rem;
		margin-bottom: 2px;
	}

	.bit-num {
		position: absolute;
		transform: translateX(-50%);
		color: var(--text-muted);
		font-size: 0.625rem;
	}

	.bit-fields {
		display: flex;
		height: 2.5rem;
		border-radius: 4px;
		overflow: hidden;
		border: 1px solid var(--border);
	}

	.field {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2px;
		border-right: 1px solid var(--border);
		min-width: 0;
		overflow: hidden;
	}

	.field:last-child {
		border-right: none;
	}

	.field-value {
		font-weight: 500;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.field-label {
		font-size: 0.5625rem;
		color: var(--text-muted);
		text-transform: uppercase;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
</style>
