# Explainable Student Performance AI

Learning Compass is a beginner-friendly React and Flask-style API demo for
student performance monitoring. It combines timestamped academic and learning
activity data with a transparent prediction, behavior trends, early warnings,
and personalized recommendations.

This is demo software for a college mini-project. Predictions are not
authoritative academic decisions. The UI labels every prediction as demo data,
and explanations are labeled as feature contribution estimates rather than
actual SHAP output.

## Demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Teacher | `teacher` | `teacher123` |
| Student | `student` | `student123` |

## Run in this workspace

The workspace already includes the managed workflows. Start or restart:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/student-performance-ai run dev
```

Open the app at the preview URL supplied by Replit.

## Run locally

### Backend

```bash
cd artifacts/api-server
pnpm install
pnpm run dev
```

The API serves on port 5000 when run outside the managed workflow.

### Frontend

```bash
cd artifacts/student-performance-ai
pnpm install
PORT=5173 BASE_PATH=/ pnpm run dev
```

The frontend expects the API at `/api`, so run the backend through the same
host/proxy or configure your local reverse proxy to forward `/api`.

## Beginner project map

```text
artifacts/
├── api-server/
│   └── src/
│       ├── data/student-data.ts       # Fictional sample students and weekly data
│       └── routes/student-performance.ts
└── student-performance-ai/
    └── src/
        ├── App.tsx                    # Pages, routes, dashboard UI, API hooks
        └── index.css                  # Shared theme and responsive styling
lib/
└── api-spec/openapi.yaml              # Source of truth for the typed API
```

## API endpoints

```text
POST /api/login
GET  /api/students
GET  /api/students/:studentId
GET  /api/students/:studentId/behavior
GET  /api/students/:studentId/recommendations
POST /api/predict
POST /api/explain
GET  /api/warnings
GET  /api/dashboard
```

The prediction service uses a beginner-readable weighted Random-Forest-style
demo scoring pipeline. The source is intentionally small and easy to replace
with a real scikit-learn model and SHAP explainer for a research extension.
The explanation endpoint always makes its demo/fallback status explicit.

## Updating the API

Edit `lib/api-spec/openapi.yaml`, then regenerate the typed hooks:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Verification

```bash
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/student-performance-ai run typecheck
pnpm run typecheck
```