# simple-wire
simple-wire is an opinionated, lightweight framework for building typescript backends. The main goal of simple-wire is to provide a solid bare minimum structure to help you sustain your delivery speed as your application grows in an unopinionated world such as ExpressJS.

simple-wire's philosophy is that you only need three design patterns to keep delivering efficiently as your application grows:

1. Separate Domain and Presentation Layers
2. Split Domain into Department Slices
3. Use Dependency Injection


## Project Structure

```
src/
├── index.ts                     # App entrypoint — calls buildApp(), mounts controllers
├── setup/
│   ├── app.ts                   # buildApp() function — DI wiring
│   ├── config.ts                # Zod-validated environment config
│   ├── db.ts                    # Drizzle DB client factory + schema aggregator
│   └── async-context.ts        # Per-request context (requestId, etc.)
├── controllers/
│   ├── welcome.controller.ts   # GET / — serves the HTML welcome page
│   └── users.controller.ts     # HTTP route handlers
└── domain/
    └── identity/               # Example domain slice
        ├── identity.schema.ts  # Drizzle table definition + Zod types
        ├── identity.repo.ts    # DB access interface + Drizzle implementation
        └── identity.service.ts # Business logic
```

## Architecture

### Entrypoint (`src/index.ts`)

Calls `buildApp()` to wire all dependencies, then mounts controllers on Express manually (no `mountControllers` helper — the async context middleware and router are wired inline):

```typescript
import express from "express";
import { buildApp } from "@/setup/app";
import { AsyncContext } from "@/setup/async-context";

const app = buildApp();
const expressApp = express();
expressApp.use(express.json());

expressApp.use((req, _res, next) => {
  app.asyncStorage.run(new AsyncContext(req), () => next());
});

const router = Router();
for (const controller of app.controllers) {
  controller.register(router);
}
expressApp.use(router);
```

### App Builder (`src/setup/app.ts`)

The synchronous `buildApp()` function owns all dependency instantiation and returns a plain object:

```typescript
export function buildApp(): App {
  const cfg = ConfigSchema.parse(process.env);
  const asyncStorage = new AsyncLocalStorage<AsyncContext>();
  const getAsyncContext = createAsyncContextGetter(asyncStorage);

  const logger = new PinoLogger(cfg, getAsyncContext);
  const db = createDbClient(cfg);

  const identityRepo = new DrizzleIdentityRepo(db);
  const identityService = new IdentityService(logger, identityRepo);

  const controllers: SWController[] = [
    new WelcomeController(),
    new UsersController(logger, identityService),
  ];

  return {
    cfg,
    logger,
    db,
    asyncStorage,
    controllers,
    shutdown: async () => {},
  };
}
```

`WelcomeController` is registered first so `GET /` is handled before any other routes. To remove the welcome page, delete that line and its import.

### Dependency Injection

All classes receive their dependencies via constructor injection using positional parameters:

```typescript
export class IdentityService {
  constructor(
    private readonly logger: SWLogger,
    private readonly identityRepo: IdentityRepo,
  ) {}
}
```

Dependencies are wired manually in `buildApp()` — no DI container is imposed.

### Controllers

Controllers implement the `SWController` interface and register their routes via `register(router)`:

```typescript
import { Router } from "express";

export class UsersController implements SWController {
  register(router: Router): void {
    router.get("/users", this.listUsers);
    router.post("/users", this.createUser);
  }
}
```

Routes are automatically registered on Express at startup — no manual `app.get(...)` calls needed.

### Domain Slices

Each domain owns its schema, repo, and service in one folder. The three-file pattern per slice:

| File | Role |
|---|---|
| `*.schema.ts` | Drizzle table definition + Zod-inferred TypeScript types |
| `*.repo.ts` | Repository interface + Drizzle implementation |
| `*.service.ts` | Business logic, depends on the repo |

Add new domains by creating a new folder under `src/domain/` following the same pattern, then registering them in `src/setup/app.ts` and `src/setup/db.ts`.

### Configuration

Environment variables are validated at startup using a Zod schema that extends `SWConfig`:

```typescript
export const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PORT: z.coerce.number().min(1000).default(3000),
  DATABASE_URL: z.string(),
}) satisfies z.ZodType<SWConfig>;
```