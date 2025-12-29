# RISC-V Spec Grep - Technical Manual

**Version:** 1.0.0
**Date:** December 2025

## 1. Introduction

**RV Spec Grep** is a specialized, web-based search engine designed for RISC-V developers, compiler engineers, and hardware designers. It provides an instant, offline-capable interface to search and explore the RISC-V instruction set architecture (ISA) and Control and Status Registers (CSRs).

Unlike static PDF manuals, this tool aggregates data from multiple official sources into a unified, queryable database, presenting instruction encodings, operand descriptions, and normative text in a consistent format.

### 1.1 Technology Stack

*   **Framework:** [SvelteKit](https://kit.svelte.dev/) (v2) with [Svelte 5](https://svelte.dev/docs/svelte-5-preview) (Runes syntax).
*   **Language:** TypeScript.
*   **Search Engine:** [Fuse.js](https://www.fusejs.io/) (Client-side fuzzy search).
*   **Build System:** Vite.
*   **Data Processing:** Node.js custom scripts.
*   **Deployment:** GitHub Pages (via `@sveltejs/adapter-static`).
*   **Package Manager:** pnpm.

---

## 2. Architecture Overview

The application follows a **Static Site Generation (SSG)** architecture with **Client-Side Rendering (CSR)** for interactivity.

### 2.1 High-Level Data Flow

1.  **Build Time (Data Ingestion):**
    *   The `scripts/build-data.ts` script runs.
    *   It clones official RISC-V repositories (`riscv-opcodes`, `riscv-isa-manual`).
    *   It parses raw text, CSV, and AsciiDoc files.
    *   It correlates definitions with descriptions.
    *   It generates a monolithic JSON artifact: `src/lib/data/instructions.json`.

2.  **Build Time (App Compilation):**
    *   Vite bundles the Svelte application.
    *   The JSON artifact is imported directly into the bundle.
    *   SvelteKit prerenders the HTML entry point.

3.  **Runtime (Client Browser):**
    *   The browser loads the bundled application.
    *   The entire dataset (~hundreds of KB) is loaded into memory.
    *   Fuse.js builds a search index in the main thread.
    *   User keystrokes trigger instant search filtering without server round-trips.

---

## 3. Data Generation Pipeline

The core value of this project lies in its data generation script: `scripts/build-data.ts`. This script acts as an ETL (Extract, Transform, Load) pipeline.

### 3.1 Sources

*   **`riscv-opcodes`**: The authoritative source for instruction encodings and naming.
    *   *Format:* Custom text format describing bitmasks and operands.
    *   *URL:* `https://github.com/riscv/riscv-opcodes`
*   **`riscv-isa-manual`**: The human-readable specification.
    *   *Format:* AsciiDoc (`.adoc`).
    *   *URL:* `https://github.com/riscv/riscv-isa-manual`

### 3.2 Parsing Logic

#### Instruction Parsing (`parseOpcodeFile`)
The script recursively reads files in the `extensions` directory of `riscv-opcodes`. It ignores comments (`#`) and directives (`$import`).
*   **Encoding:** It parses bit assignments (e.g., `31..25=0`, `6=1`) and operands (e.g., `rs1`, `rd`, `imm12`) into a structured `BitField` array.
*   **Pseudo-ops:** Handles `$pseudo_op` definitions to map aliases (e.g., `ret`) to base instructions.

#### CSR Parsing (`parseCSVFile`)
Reads `csrs.csv` to extract CSR names, addresses, and inferred privilege levels based on memory mapping (e.g., `0x300-0x3FF` -> Machine Mode).

#### Description Extraction (`extractDescriptionsFromAdoc`)
This is the most complex step. It uses heuristics to scrape text from the ISA manual:
1.  **Normative Anchors:** Looks for `[#norm:...]` tags used in the spec to denote normative behavior.
2.  **Section Headings:** Matches instruction names in headers (e.g., `=== ADD`).
3.  **Prose Pattern Matching:** Scans for sentences like "The ADD instruction performs..." or "The mstatus CSR controls...".
4.  **Cleaning:** Strips AsciiDoc formatting (bold, italics, links) to produce plain text.

### 3.3 Data Schema (`src/lib/types.ts`)

The output is a JSON object matching the `InstructionData` interface:

```typescript
interface Instruction {
  name: string;        // e.g., "add"
  extension: string;   // e.g., "rv_i"
  operands: string[];  // e.g., ["rd", "rs1", "rs2"]
  encoding: BitField[]; // Array of bit definitions
  description: string; // Extracted documentation
  type: 'instruction' | 'csr' | 'pseudo';
}

interface CSR {
  name: string;
  address: string;     // e.g., "0x300"
  privilege: string;   // e.g., "M" (Machine), "S" (Supervisor)
  description: string;
  type: 'csr';
}
```

---

## 4. Frontend Implementation

The frontend is a lightweight Single Page Application using Svelte 5.

### 4.1 State Management (Svelte 5 Runes)

The application uses the new "Runes" reactivity model introduced in Svelte 5.
*   **`$state`**: Used for mutable state variables (e.g., `let query = $state('')`).
*   **`$bindable`**: Used for two-way binding in components (e.g., `<SearchBox bind:value={query} />`).

### 4.2 Search Implementation (`src/routes/+page.svelte`)

Search is handled by `Fuse.js`, configured for a balance between performance and accuracy:
*   **Weights:**
    *   `name`: 2.0 (Highest priority, exact mnemonic matches)
    *   `extension`: 0.5 (Find all instructions in "rv64_m")
    *   `description`: 0.3 (Search within documentation)
    *   `operands`: 0.3 (Find instructions using "f5")
*   **Threshold:** `0.3` (Allows some fuzziness but filters irrelevant noise).

### 4.3 Component Hierarchy

*   `src/routes/+page.svelte` (Controller)
    *   `SearchBox.svelte`: Input field with clear functionality.
    *   `InstructionCard.svelte`: The main display unit.
        *   `BitVector.svelte` (likely): Renders the graphical representation of the 32-bit instruction word (if implemented).

---

## 5. Development Workflow

### 5.1 Prerequisites
*   Node.js v20+
*   pnpm v9+
*   Git

### 5.2 Setup
```bash
git clone <repository-url>
cd rv-spec-grep
pnpm install
```

### 5.3 Building the Data
Before running the app, you must generate the data file. This requires an internet connection to clone the upstream repos.
```bash
pnpm run build:data
```
*Artifact:* `src/lib/data/instructions.json`

### 5.4 Development Server
```bash
pnpm run dev
```
Runs Vite in watch mode. Note that changes to `scripts/build-data.ts` require a manual re-run of `pnpm run build:data` and a server restart to reflect in the app.

### 5.5 Production Build
```bash
pnpm run build
```
This command:
1.  Runs `build:data` to ensure fresh data.
2.  Runs `vite build` to compile assets to the `build/` directory.

---

## 6. CI/CD & Deployment

### 6.1 GitHub Pages Workflow
The project includes a GitHub Actions workflow `.github/workflows/deploy.yml`.

*   **Trigger:** Push to `main` or `master`.
*   **Steps:**
    1.  Checkout code.
    2.  Install Node.js & pnpm.
    3.  `pnpm install`.
    4.  `pnpm run build` (Generates data + builds app).
    5.  Uploads `build/` artifact.
    6.  Deploys to GitHub Pages environment.

### 6.2 Configuration
*   **`svelte.config.js`**: Configured with `adapter-static`.
    *   `fallback: 'index.html'` is set, though strictly not needed for a pure SPA on GitHub Pages (since it uses hash routing or single entry point), but ensures correct behavior if deep linking is handled by a 404 hack (not currently implemented).
    *   `prerender: { entries: ['*'] }`: Ensures the main page is prerendered.

## 7. Future Extensibility

To add support for new extensions:
1.  Wait for them to be added to `riscv-opcodes`.
2.  Update `scripts/build-data.ts` if the file structure in `riscv-opcodes` changes (e.g., new subdirectories).
3.  Re-run the build.

To improve description quality:
1.  Refine the regex heuristics in `extractDescriptionsFromAdoc` within `scripts/build-data.ts`.
