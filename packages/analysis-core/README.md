# analysis-core

Private workspace imported by frontend/serverless, traditional and event-driven. There is one implementation of every PDF check and one set of AI prompts/model/parameters/output schema.

Use subpath imports to keep server-only PDF/OpenAI dependencies out of browser bundles:

```ts
import { analyzePdf } from "@academic-analyzer/analysis-core/pdf/analyzePdf";
import { createAnalyzeDocuments } from "@academic-analyzer/analysis-core/ai";
import type { CheckResult } from "@academic-analyzer/analysis-core/types";
import { MAX_ASSIGNMENT_LENGTH } from "@academic-analyzer/analysis-core/constants";
```

`createAnalyzeDocuments(() => client)` takes the existing OpenAI client getter. PDF checks are under `src/pdf`; prompts and response schema are in `src/ai.ts`; profiles are in `src/docs`; measurement context is in `src/instrumentation/analysis.ts`. Authentication, routes, Redis queues and object storage remain in each app.

Run `npm run build:core` from the monorepo root after edits. Use the core `dev` script to watch TypeScript changes; profile JSON changes require a full build to copy assets. No registry publishing or package version bump is needed for local workspaces.


Shared HTTP/CORS and IP rate limiting live in [backend-common](../backend-common/README.md).
