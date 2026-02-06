# Repository Guidelines

## Project Structure & Module Organization
- App framework: Next.js (App Router) with TypeScript.
- Main code lives in `src/`.
  - `src/app/`: route entry points (`layout.tsx`, `page.tsx`) and global styles.
  - `src/features/flight-sim/`: feature-first MVC split:
    - `model/` business rules and data transforms
    - `view/` React/Three.js rendering
    - `controller/` orchestration hooks
    - `types/` shared type definitions
- Static assets: `public/` (including `public/terrain/` generated wireframe terrain JSON).
- Utilities/scripts: `scripts/` (for example, terrain conversion).
- Project docs and contracts: `docs/`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start local dev server.
- `npm run build`: production build check.
- `npm run start`: run built app.
- `npm run lint`: run ESLint.
- `npm run typecheck`: run TypeScript checks (`tsc --noEmit`).
- `npm run convert:terrain -- --input <in.json> --output <out.json>`: convert PLATEAU-like data to wireframe terrain JSON.

## Coding Style & Naming Conventions
- Language: TypeScript + React function components.
- Indentation: 2 spaces; keep code straightforward and minimal.
- Preserve MVC boundaries:
  - Model: logic and calculations only
  - View: presentation only
  - Controller: IO and orchestration only
- Naming:
  - Components and files: `PascalCase` (for example `FlightSceneView.tsx`)
  - Hooks: `use*` (for example `useFlightSimulatorController.ts`)
  - Model/type files: `camelCase` + domain suffix (for example `flightModel.ts`, `flightTypes.ts`)

## Testing Guidelines
- There is currently no `npm test` script.
- Minimum validation before PR: `npm run lint`, `npm run typecheck`, and manual verification via `npm run dev`.
- If you add non-trivial logic, include reproducible checks (test file or script) and document how to run them in the PR.

## Commit & Pull Request Guidelines
- Follow the existing commit style: short imperative summary (for example, `Implement flight sim MVP and terrain conversion pipeline`).
- Keep commits focused by concern (model/view/controller/docs).
- PRs should include:
  - clear purpose and scope
  - linked issue/task if available
  - screenshots or short recordings for UI changes
  - note of updated docs in `docs/` when behavior or interfaces change
