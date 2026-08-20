# Contributing

Issues and pull requests welcome. Contributions are licensed under the [MIT License](./LICENSE). Please follow the [code of conduct](./CODE_OF_CONDUCT.md).

A change to the HTML an existing document renders to is a breaking change. Keep the public export in `src/public.ts` stable.

```bash
npm install
npm run typecheck
npm test
```

`zod` is a peer dependency (`^4`). Node.js 18+.
