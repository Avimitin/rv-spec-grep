export interface BitField {
	high: number;
	low: number;
	value: number | string;
	name?: string;
}

export interface Instruction {
	name: string;
	extension: string;
	operands: string[];
	encoding: BitField[];
	format?: string;
	description: string;
	type: 'instruction' | 'csr' | 'pseudo';
}

export interface CSR {
	name: string;
	address: string;
	privilege: string;
	description: string;
	type: 'csr';
}

export type SearchResult = Instruction | CSR;

export interface InstructionData {
	instructions: Instruction[];
	csrs: CSR[];
	version: string;
	generatedAt: string;
}
