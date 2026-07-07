1. Start with `git@github.com:meysius/ts-seed.git`
2. Add express
```bash
$ pnpm add express
$ pnpm add -D @types/express
```
3. Install Drizzle
```bash
$ pnpm add drizzle-orm pg dotenv
$ pnpm add -D drizzle-kit @types/pg
$ pnpm add drizzle-zod
```
4. Add Zod
```bash
$ pnpm add zod
```

---

6. Add awilix for Dependency Injection Container
```bash
pnpm add awilix
```

7. Add pino for logging
```bash
pnpm add pino
pnpm add -D pino-pretty
```