import { execSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, basename } from 'path';

interface BitField {
	high: number;
	low: number;
	value: number | string;
	name?: string;
}

interface Instruction {
	name: string;
	extension: string;
	operands: string[];
	encoding: BitField[];
	format?: string;
	description: string;
	type: 'instruction' | 'csr' | 'pseudo';
}

interface CSR {
	name: string;
	address: string;
	privilege: string;
	description: string;
	type: 'csr';
}

const OPCODES_REPO = 'https://github.com/riscv/riscv-opcodes.git';
const MANUAL_REPO = 'https://github.com/riscv/riscv-isa-manual.git';

const KNOWN_OPERANDS = new Set([
	'rd', 'rs1', 'rs2', 'rs3',
	'imm12', 'imm20', 'jimm20',
	'bimm12hi', 'bimm12lo',
	'simm12hi', 'simm12lo',
	'shamtw', 'shamtd', 'shamt',
	'rm', 'aq', 'rl',
	'pred', 'succ',
	'csr', 'zimm',
	'fm',
	// Compressed operands
	'rd_p', 'rs1_p', 'rs2_p',
	'c_nzuimm10', 'c_uimm8sp_s', 'c_uimm8sp', 'c_uimm7lo', 'c_uimm7hi',
	'c_imm6lo', 'c_imm6hi', 'c_nzimm6lo', 'c_nzimm6hi',
	'c_nzuimm5', 'c_nzuimm6lo', 'c_nzuimm6hi',
	'c_uimm8lo', 'c_uimm8hi', 'c_uimm9lo', 'c_uimm9hi',
	'c_nzimm10hi', 'c_nzimm10lo', 'c_nzimm18hi', 'c_nzimm18lo',
	'c_imm12', 'c_bimm9lo', 'c_bimm9hi',
	'c_nzimm5', 'c_spimm',
	'c_index', 'c_rlist', 'c_spimm',
	// Vector operands
	'vd', 'vs1', 'vs2', 'vs3', 'vm', 'nf', 'wd',
	'simm5', 'zimm10', 'zimm11', 'zimm5',
]);

function cloneRepo(url: string, targetDir: string): void {
	console.log(`Cloning ${url}...`);
	execSync(`git clone --depth 1 ${url} ${targetDir}`, { stdio: 'pipe' });
}

function parseOpcodeFile(content: string, extension: string): Instruction[] {
	const instructions: Instruction[] = [];
	const lines = content.split('\n');

	for (const line of lines) {
		const trimmed = line.trim();

		// Skip comments, empty lines, and directives
		if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('@')) continue;

		// Handle $pseudo_op
		if (trimmed.startsWith('$pseudo_op')) {
			const match = trimmed.match(/\$pseudo_op\s+\S+\s+(\w+)\s+(.*)/);
			if (match) {
				const [, name, rest] = match;
				const { operands, encoding } = parseEncodingLine(rest);
				instructions.push({
					name,
					extension,
					operands,
					encoding,
					description: '',
					type: 'pseudo',
				});
			}
			continue;
		}

		// Handle $import (skip for now)
		if (trimmed.startsWith('$import')) continue;

		// Parse regular instruction
		const parts = trimmed.split(/\s+/);
		if (parts.length < 2) continue;

		const name = parts[0];
		// Skip if name contains special characters (likely not an instruction)
		if (!/^[a-z0-9_.]+$/i.test(name)) continue;

		const { operands, encoding } = parseEncodingLine(parts.slice(1).join(' '));

		if (encoding.length > 0) {
			instructions.push({
				name,
				extension,
				operands,
				encoding,
				description: '',
				type: 'instruction',
			});
		}
	}

	return instructions;
}

function parseEncodingLine(line: string): { operands: string[]; encoding: BitField[] } {
	const parts = line.split(/\s+/);
	const operands: string[] = [];
	const encoding: BitField[] = [];

	for (const part of parts) {
		// Check if it's an operand
		if (KNOWN_OPERANDS.has(part)) {
			operands.push(part);
			continue;
		}

		// Check if it's a bit range assignment (e.g., 31..25=0 or 6..2=0x0C)
		const rangeMatch = part.match(/^(\d+)\.\.(\d+)=(.+)$/);
		if (rangeMatch) {
			const [, high, low, value] = rangeMatch;
			encoding.push({
				high: parseInt(high),
				low: parseInt(low),
				value: value.startsWith('0x') ? parseInt(value, 16) : parseInt(value),
			});
			continue;
		}

		// Check if it's a single bit assignment (e.g., 6=1)
		const singleMatch = part.match(/^(\d+)=(.+)$/);
		if (singleMatch) {
			const [, bit, value] = singleMatch;
			encoding.push({
				high: parseInt(bit),
				low: parseInt(bit),
				value: value.startsWith('0x') ? parseInt(value, 16) : parseInt(value),
			});
			continue;
		}

		// Check if it's a named field (e.g., "ignore" or other constants)
		if (part && !part.includes('=') && !KNOWN_OPERANDS.has(part)) {
			// Could be a custom field name - skip for now
		}
	}

	return { operands, encoding };
}

function parseCSVFile(content: string): CSR[] {
	const csrs: CSR[] = [];
	const lines = content.split('\n');

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;

		// CSV format: address, "name"
		// e.g., 0x001, "fflags"
		const match = trimmed.match(/^(0x[0-9A-Fa-f]+),\s*"([^"]+)"/);
		if (match) {
			const [, address, name] = match;
			// Determine privilege from address range
			const addr = parseInt(address, 16);
			let privilege = 'U'; // User
			if (addr >= 0x100 && addr < 0x200) privilege = 'S'; // Supervisor
			else if (addr >= 0x200 && addr < 0x300) privilege = 'H'; // Hypervisor
			else if (addr >= 0x300 && addr < 0x400) privilege = 'M'; // Machine
			else if (addr >= 0x500 && addr < 0x600) privilege = 'S'; // Supervisor
			else if (addr >= 0x600 && addr < 0x700) privilege = 'H'; // Hypervisor
			else if (addr >= 0x700 && addr < 0x800) privilege = 'M'; // Machine
			else if (addr >= 0xB00 && addr < 0xC00) privilege = 'M'; // Machine counters
			else if (addr >= 0xC00 && addr < 0xD00) privilege = 'U'; // User counters (read-only)
			else if (addr >= 0xF00) privilege = 'M'; // Machine info

			csrs.push({
				name,
				address,
				privilege,
				description: '',
				type: 'csr',
			});
		}
	}

	return csrs;
}

function cleanAdocText(text: string): string {
	return text
		// Remove normative anchors but keep text: [#norm:xxx]#text# -> text
		.replace(/\[#norm:[^\]]+\]#([^#]+)#/g, '$1')
		// Remove cross-references: <<label>> or <<label,text>>
		.replace(/<<[^>]+>>/g, '')
		// Remove anchor definitions: [[anchor]]
		.replace(/\[\[[^\]]+\]\]/g, '')
		// Remove inline formatting
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\*([^*]+)\*/g, '$1')
		.replace(/_([^_]+)_/g, '$1')
		.replace(/`([^`]+)`/g, '$1')
		// Remove footnotes
		.replace(/footnote:\[[^\]]*\]/g, '')
		// Remove attributes
		.replace(/^\[%[^\]]+\]\s*/gm, '')
		.replace(/^:.*$/gm, '')
		// Clean up whitespace
		.replace(/\s+/g, ' ')
		.trim();
}

function extractDescriptionsFromAdoc(manualDir: string): { instructions: Map<string, string>; csrs: Map<string, string> } {
	const instrDescriptions = new Map<string, string>();
	const csrDescriptions = new Map<string, string>();

	// Find all .adoc files recursively
	function findAdocFiles(dir: string): string[] {
		const files: string[] = [];
		try {
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = join(dir, entry.name);
				if (entry.isDirectory()) {
					files.push(...findAdocFiles(fullPath));
				} else if (entry.name.endsWith('.adoc')) {
					files.push(fullPath);
				}
			}
		} catch {
			// Directory doesn't exist or can't be read
		}
		return files;
	}

	const adocFiles = findAdocFiles(manualDir);

	for (const file of adocFiles) {
		try {
			const content = readFileSync(file, 'utf-8');

			// Pattern 1: Extract [#norm:instr_op]#description# patterns
			// These are normative statements like [#norm:add_op]#ADD performs the addition...#
			const normMatches = content.matchAll(/\[#norm:([a-z0-9_]+)_(?:op|desc|enc|behavior)[^\]]*\]#([^#]+)#/gi);
			for (const match of normMatches) {
				const instrName = match[1].toLowerCase();
				const desc = cleanAdocText(match[2]);
				if (desc.length > 10) {
					const existing = instrDescriptions.get(instrName) || '';
					if (existing) {
						instrDescriptions.set(instrName, existing + ' ' + desc);
					} else {
						instrDescriptions.set(instrName, desc);
					}
				}
			}

			// Pattern 2: Look for instruction sections with headings
			// ==== ADD or === LUI format
			const sectionMatches = content.matchAll(/^(={2,4})\s+([A-Z][A-Z0-9.]+)\s*$/gm);
			for (const match of sectionMatches) {
				const instrName = match[2].toLowerCase();
				const headingLevel = match[1].length;
				const startIdx = match.index! + match[0].length;

				// Find next heading of same or higher level
				const nextHeadingRegex = new RegExp(`^={2,${headingLevel}}\\s+`, 'm');
				const nextHeadingMatch = content.slice(startIdx).search(nextHeadingRegex);
				const endIdx = nextHeadingMatch === -1 ? startIdx + 2000 : startIdx + nextHeadingMatch;
				const section = content.slice(startIdx, endIdx);

				// Extract all normative statements from this section
				const sectionNorms = section.matchAll(/\[#norm:[^\]]+\]#([^#]+)#/g);
				const normTexts: string[] = [];
				for (const norm of sectionNorms) {
					normTexts.push(cleanAdocText(norm[1]));
				}

				if (normTexts.length > 0) {
					const combined = normTexts.join(' ');
					if (!instrDescriptions.has(instrName) || instrDescriptions.get(instrName)!.length < combined.length) {
						instrDescriptions.set(instrName, combined);
					}
				} else {
					// Fall back to first paragraph if no normative statements
					const paragraphs = section.split('\n\n');
					for (const para of paragraphs) {
						const cleaned = cleanAdocText(para);
						// Skip if it looks like a table or code block
						if (cleaned.length > 30 && !cleaned.includes('|') && !para.trim().startsWith('[')) {
							if (!instrDescriptions.has(instrName)) {
								instrDescriptions.set(instrName, cleaned.slice(0, 500));
							}
							break;
						}
					}
				}
			}

			// Pattern 3: Look for instruction descriptions in prose
			// "The INSTRUCTION instruction does..."
			const proseMatches = content.matchAll(/(?:^|\.\s+)(?:The\s+)?`?([A-Z][A-Z0-9.]*)`?\s+(?:instruction\s+)?(?:performs?|is|computes?|loads?|stores?|writes?|reads?|sets?|clears?|adds?|subtracts?|multiplies?|divides?|shifts?|rotates?|branches?|jumps?|calls?|returns?|atomically|sign-extends?|zero-extends?)([^.]+\.)/gi);
			for (const match of proseMatches) {
				const instrName = match[1].toLowerCase();
				const fullDesc = (match[1] + ' ' + match[2]).trim();
				const cleaned = cleanAdocText(fullDesc);
				if (cleaned.length > 20 && !instrDescriptions.has(instrName)) {
					instrDescriptions.set(instrName, cleaned);
				}
			}

			// Pattern 4: CSR descriptions - look for CSR register documentation
			// Pattern: "The CSR_NAME register..." or sections titled with CSR names
			const csrSectionMatches = content.matchAll(/^(={2,4})\s+(?:The\s+)?`?([a-z][a-z0-9_]*)`?\s+(?:Register|CSR)?\s*$/gim);
			for (const match of csrSectionMatches) {
				const csrName = match[2].toLowerCase();
				const headingLevel = match[1].length;
				const startIdx = match.index! + match[0].length;

				const nextHeadingRegex = new RegExp(`^={2,${headingLevel}}\\s+`, 'm');
				const nextHeadingMatch = content.slice(startIdx).search(nextHeadingRegex);
				const endIdx = nextHeadingMatch === -1 ? startIdx + 1500 : startIdx + nextHeadingMatch;
				const section = content.slice(startIdx, endIdx);

				// Get normative statements or first paragraph
				const sectionNorms = section.matchAll(/\[#norm:[^\]]+\]#([^#]+)#/g);
				const normTexts: string[] = [];
				for (const norm of sectionNorms) {
					normTexts.push(cleanAdocText(norm[1]));
				}

				if (normTexts.length > 0) {
					csrDescriptions.set(csrName, normTexts.join(' '));
				} else {
					const paragraphs = section.split('\n\n');
					for (const para of paragraphs) {
						const cleaned = cleanAdocText(para);
						if (cleaned.length > 30 && !cleaned.includes('|') && !para.trim().startsWith('[')) {
							csrDescriptions.set(csrName, cleaned.slice(0, 500));
							break;
						}
					}
				}
			}

			// Pattern 5: Inline CSR descriptions
			// "The `csrname` CSR is..."
			const csrProseMatches = content.matchAll(/(?:^|\.\s+)(?:The\s+)?`([a-z][a-z0-9_]*)`\s+(?:CSR|register)\s+(?:is|contains?|holds?|provides?|controls?)([^.]+\.)/gi);
			for (const match of csrProseMatches) {
				const csrName = match[1].toLowerCase();
				const fullDesc = ('The ' + csrName + ' register ' + match[2]).trim();
				const cleaned = cleanAdocText(fullDesc);
				if (cleaned.length > 20 && !csrDescriptions.has(csrName)) {
					csrDescriptions.set(csrName, cleaned);
				}
			}

		} catch {
			// Skip files that can't be read
		}
	}

	return { instructions: instrDescriptions, csrs: csrDescriptions };
}

async function main() {
	const tmpBase = mkdtempSync(join(tmpdir(), 'rv-spec-grep-'));
	const opcodesDir = join(tmpBase, 'opcodes');
	const manualDir = join(tmpBase, 'manual');

	try {
		// Clone repositories
		cloneRepo(OPCODES_REPO, opcodesDir);
		cloneRepo(MANUAL_REPO, manualDir);

		// Parse opcode files
		const extensionsDir = join(opcodesDir, 'extensions');
		const extensionFiles = readdirSync(extensionsDir).filter(
			(f) => f.startsWith('rv') && !f.includes('.')
		);

		const instructions: Instruction[] = [];

		for (const file of extensionFiles) {
			const filePath = join(extensionsDir, file);
			try {
				const content = readFileSync(filePath, 'utf-8');
				const parsed = parseOpcodeFile(content, file);
				instructions.push(...parsed);
			} catch {
				console.warn(`Failed to parse ${file}`);
			}
		}

		// Also check unratified extensions
		const unratifiedDir = join(extensionsDir, 'unratified');
		if (existsSync(unratifiedDir)) {
			const unratifiedFiles = readdirSync(unratifiedDir).filter(
				(f) => f.startsWith('rv') && !f.includes('.')
			);
			for (const file of unratifiedFiles) {
				const filePath = join(unratifiedDir, file);
				try {
					const content = readFileSync(filePath, 'utf-8');
					const parsed = parseOpcodeFile(content, `unratified/${file}`);
					instructions.push(...parsed);
				} catch {
					console.warn(`Failed to parse unratified/${file}`);
				}
			}
		}

		// Parse CSR files
		let csrs: CSR[] = [];
		const csrFile = join(opcodesDir, 'csrs.csv');
		if (existsSync(csrFile)) {
			const content = readFileSync(csrFile, 'utf-8');
			csrs = parseCSVFile(content);
		}

		// Extract descriptions from manual
		const { instructions: instrDescriptions, csrs: csrDescriptions } = extractDescriptionsFromAdoc(join(manualDir, 'src'));

		// Merge descriptions with instructions
		for (const instr of instructions) {
			const desc = instrDescriptions.get(instr.name.toLowerCase());
			if (desc) {
				instr.description = desc;
			}
		}

		// Merge descriptions with CSRs
		for (const csr of csrs) {
			const desc = csrDescriptions.get(csr.name.toLowerCase());
			if (desc) {
				csr.description = desc;
			}
		}

		// Deduplicate instructions by name (keep first occurrence)
		const seenInstructions = new Map<string, Instruction>();
		for (const instr of instructions) {
			if (!seenInstructions.has(instr.name)) {
				seenInstructions.set(instr.name, instr);
			}
		}

		const finalInstructions = Array.from(seenInstructions.values());
		const withDesc = finalInstructions.filter(i => i.description).length;
		const csrsWithDesc = csrs.filter(c => c.description).length;

		const data = {
			instructions: finalInstructions,
			csrs,
			version: '1.0.0',
			generatedAt: new Date().toISOString(),
		};

		// Write output
		const outputPath = join(process.cwd(), 'src', 'lib', 'data', 'instructions.json');
		const outputDir = join(process.cwd(), 'src', 'lib', 'data');

		// Ensure directory exists
		execSync(`mkdir -p ${outputDir}`);

		writeFileSync(outputPath, JSON.stringify(data, null, 2));

		console.log(`Generated ${data.instructions.length} instructions (${withDesc} with descriptions) and ${data.csrs.length} CSRs (${csrsWithDesc} with descriptions)`);
		console.log(`Output written to ${outputPath}`);
	} finally {
		// Cleanup
		rmSync(tmpBase, { recursive: true, force: true });
	}
}

main().catch(console.error);
