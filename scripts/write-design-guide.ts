// Regenerate packages/email/EMAIL_DESIGN.md from src/design-guide.ts.
//   npm run guide:write -w @unitpost/email
// design-guide.test.ts fails when the committed file is stale.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { emailDesignGuideMarkdown } from "../src/design-guide.ts";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "EMAIL_DESIGN.md");
writeFileSync(file, emailDesignGuideMarkdown());
console.log(`wrote ${file}`);
