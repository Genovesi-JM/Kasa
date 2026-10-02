import { execFileSync } from "node:child_process";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { preparePagesFiles } from "./pages-files";

const destination = process.argv[2];
if (!destination || process.argv.length !== 3)
  throw new Error(
    "Usage: npm run prepare:pages -- /absolute/path/to/gh-pages-checkout",
  );
const pages = resolve(destination);
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: pages, encoding: "utf8" }).trim();
if (
  (await realpath(pages)) !==
  (await realpath(git("rev-parse", "--show-toplevel")))
)
  throw new Error("Destination must be the root of the Pages checkout.");
if (git("branch", "--show-current") !== "gh-pages")
  throw new Error("Destination must be on the gh-pages branch.");
const rootOrigin = execFileSync("git", ["remote", "get-url", "origin"], {
  encoding: "utf8",
}).trim();
if (git("remote", "get-url", "origin") !== rootOrigin)
  throw new Error(
    "Destination must use the same origin as the source checkout.",
  );
if (git("status", "--porcelain"))
  throw new Error(
    "Commit or inspect existing Pages checkout changes before preparing another release.",
  );
console.log(await preparePagesFiles(resolve("dist"), pages));
console.log(
  "Build staged in the Pages checkout. Review, commit and push that checkout to publish.",
);
