# Explainable Student Performance AI

Learning Compass helps teachers and students understand academic performance patterns through demo predictions, behavior trends, warnings, and transparent feature contributions.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Recharts

## Where things live

- `artifacts/student-performance-ai/src/App.tsx` — frontend routes, dashboards, login, charts, and API hook usage
- `artifacts/student-performance-ai/src/index.css` — shared visual theme and responsive styles
- `artifacts/api-server/src/routes/student-performance.ts` — API endpoints and demo prediction logic
- `artifacts/api-server/src/data/student-data.ts` — fictional students and timestamped weekly behavior samples
- `lib/api-spec/openapi.yaml` — source of truth for the API contract

## Architecture decisions

- The demo keeps sample data in a small TypeScript module so a beginner can run it without a separate seed command.
- Predictions and explanations are explicitly labeled as demo output and fallback feature contributions.
- API types are generated from OpenAPI before frontend work to keep request and response shapes aligned.

## Product

Teachers can review class risk distribution, search students, inspect individual trends, and view early warnings. Students can review their own metrics, weekly behavior, prediction, explanation, and next-step recommendations.

## User preferences

The implementation should stay beginner-friendly, responsive, and transparent about demo/AI limitations.

## Gotchas

Regenerate API hooks after changing `lib/api-spec/openapi.yaml`. Restart the API workflow after changing server route code so its bundled output refreshes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
