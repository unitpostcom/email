# Contributing

Issues and pull requests welcome.

A change to the HTML an existing document renders to is a breaking change. Keep the public export in `src/public.ts` stable.

```bash
npm install
npm run typecheck
npm test
```

`zod` is a peer dependency (`^4`). Node.js 18+.
