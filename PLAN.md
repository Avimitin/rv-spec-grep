# RISC-V Spec Grep - Implementation Plan

## Project Overview
A static site for searching RISC-V instructions and CSRs, displaying opcodes, bit vector representations, and specification descriptions.

## Architecture

```
rv-spec-grep/
├── flake.nix                 # Nix flake for dev environment
├── flake.lock
├── package.json
├── svelte.config.js
├── vite.config.ts
├── src/
│   ├── routes/
│   │   └── +page.svelte      # Main search page
│   ├── lib/
│   │   ├── components/
│   │   │   ├── SearchBox.svelte
│   │   │   ├── InstructionCard.svelte
│   │   │   └── BitVector.svelte
│   │   ├── data/
│   │   │   └── instructions.json  # Generated at build time
│   │   └── types.ts
│   └── app.css               # Minimal, elegant styles
└── scripts/
    └── build-data.ts         # Fetches & parses upstream repos
```

## Data Pipeline

### Build-time Data Fetching (`scripts/build-data.ts`)
1. Clone `riscv/riscv-opcodes` to temp directory
2. Clone `riscv/riscv-isa-manual` to temp directory
3. Parse all `extensions/rv_*` files for instruction encodings
4. Parse `csrs.csv` and `csrs32.csv` for CSR definitions
5. Parse AsciiDoc files in `src/` for instruction/CSR descriptions
6. Generate `src/lib/data/instructions.json` with merged data

### Data Structure
```typescript
interface Instruction {
  name: string;
  extension: string;       // e.g., "rv_i", "rv_m"
  operands: string[];      // e.g., ["rd", "rs1", "rs2"]
  encoding: BitField[];    // bit range assignments
  opcode: string;          // hex opcode
  description: string;     // from spec
  type: "instruction" | "csr";
}

interface BitField {
  high: number;
  low: number;
  value: number | string;
}
```

## UI Components

### SearchBox
- Fuzzy search with Fuse.js
- Instant filtering as user types
- Keyboard navigation support

### InstructionCard
- Displays instruction name and extension
- Shows operand list
- Expandable description section

### BitVector
- Visual 32-bit representation
- Color-coded fields (opcode, funct3, funct7, etc.)
- Hover to show field names and values

## Styling
- CSS variables for theming
- Monospace fonts for encodings
- Clean, minimal design
- Dark/light mode support (prefers-color-scheme)

## Nix Environment (`flake.nix`)
Provides:
- Node.js 20
- Git (for cloning repos at build)
- Development shell with all dependencies

## Implementation Steps

1. **Setup Nix Environment**
   - Create `flake.nix` with Node.js and dev tools
   - Add `direnv` support via `.envrc`

2. **Initialize SvelteKit Project**
   - Create SvelteKit static adapter project
   - Configure TypeScript
   - Add Fuse.js for fuzzy search

3. **Build Data Parser**
   - Implement opcode file parser
   - Implement CSR CSV parser
   - Implement AsciiDoc description extractor
   - Integrate into prebuild script

4. **Create UI Components**
   - SearchBox with debounced input
   - InstructionCard with expandable details
   - BitVector visual component

5. **Style the Application**
   - Minimal CSS with variables
   - Responsive layout
   - Dark/light theme

6. **Build & Deploy Setup**
   - Configure static adapter
   - Add build script that runs data generation first

## Key Files to Create

| File | Purpose |
|------|---------|
| `flake.nix` | Nix development environment |
| `scripts/build-data.ts` | Data fetching and parsing |
| `src/routes/+page.svelte` | Main search interface |
| `src/lib/components/SearchBox.svelte` | Search input component |
| `src/lib/components/InstructionCard.svelte` | Result display |
| `src/lib/components/BitVector.svelte` | Bit encoding visualization |
| `src/app.css` | Global styles |
