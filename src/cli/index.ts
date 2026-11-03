import { formatInitResult, initProject, packageManager } from "./init";

// `unitpost-email` (run as `npx @unitpost/email init` or `npx @unitpost/email dev`).

const HELP = `Usage: unitpost-email init [folder]
       unitpost-email dev [folder] [--port <n>]

init  Add a starter email to a folder (default: emails) and an "email:dev"
      script to package.json, then print the install command for any
      missing package. Existing files and scripts are kept.

dev   Preview the emails in a folder (default: emails) at
      http://127.0.0.1:3030. Reloads when a file changes.

An email is a module whose default export is a React component built from
@unitpost/email/react (preview props: Component.PreviewProps), or a .json
EmailDocument. Files and folders starting with "_" are skipped.

React emails are bundled with your project's esbuild: npm install -D esbuild

Send test: set UNITPOST_API_KEY and UNITPOST_FROM (an address on a verified
domain) to send the email you are looking at through Unitpost.
`;

export async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return command ? 0 : 1;
  }
  if (command === "init") return init(rest);
  if (command !== "dev") {
    process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
    return 1;
  }
  let dir: string | undefined;
  let port: number | undefined;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--port" || arg === "-p") port = Number(rest[++i]);
    else if (arg.startsWith("--port=")) port = Number(arg.slice("--port=".length));
    else if (!arg.startsWith("-") && dir === undefined) dir = arg;
    else {
      process.stderr.write(`Unknown option: ${arg}\n\n${HELP}`);
      return 1;
    }
  }
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) {
    process.stderr.write("--port takes a number from 0 to 65535.\n");
    return 1;
  }
  // Loaded only for dev, so init runs without the renderer's dependencies.
  const { startDevServer } = await import("./dev-server");
  const server = await startDevServer({ dir, port });
  process.stdout.write(`Previewing ${dir ?? "emails"} at ${server.url}\n`);
  const stop = () => {
    void server.close().then(() => process.exit(0));
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  return await new Promise<number>(() => {});
}

function init(args: string[]): number {
  const options = args.filter((arg) => arg.startsWith("-"));
  if (options.length || args.length > 1) {
    process.stderr.write(`Unknown option: ${options[0] ?? args[1]}\n\n${HELP}`);
    return 1;
  }
  const result = initProject({ dir: args[0] });
  process.stdout.write(formatInitResult(result, packageManager(process.cwd()).run));
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: Error) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  },
);
