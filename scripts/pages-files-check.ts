import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { preparePagesFiles } from "./pages-files";

const temporary = await mkdtemp(join(tmpdir(), "kasa-pages-check-"));
try {
  const build = join(temporary, "build");
  const pages = join(temporary, "pages");
  await mkdir(join(build, "assets", "nested"), { recursive: true });
  await mkdir(join(pages, "assets"), { recursive: true });
  const html = '<script type="module" src="./assets/current-abc.js"></script>';
  await writeFile(join(build, "index.html"), html);
  await writeFile(
    join(build, "assets", "current-abc.js"),
    "import('./nested/lazy-def.js')",
  );
  await writeFile(
    join(build, "assets", "nested", "lazy-def.js"),
    "export const screen = true",
  );
  await writeFile(
    join(pages, "assets", "previous-xyz.js"),
    "previous release lazy screen",
  );
  await writeFile(join(pages, "index.html"), "previous entry");
  await writeFile(join(pages, "CNAME"), "example.test");
  assert.deepEqual(await preparePagesFiles(build, pages), {
    currentAssets: 2,
    retainedAssets: 1,
  });
  assert.equal(await readFile(join(pages, "index.html"), "utf8"), html);
  assert.equal(
    await readFile(join(pages, "assets", "previous-xyz.js"), "utf8"),
    "previous release lazy screen",
  );
  assert.equal(
    await readFile(join(pages, "assets", "nested", "lazy-def.js"), "utf8"),
    "export const screen = true",
  );
  assert.equal(await readFile(join(pages, "CNAME"), "utf8"), "example.test");
  assert.deepEqual(await preparePagesFiles(build, pages), {
    currentAssets: 2,
    retainedAssets: 1,
  });
  await writeFile(
    join(build, "assets", "current-abc.js"),
    "changed bytes under the same hash",
  );
  await assert.rejects(preparePagesFiles(build, pages), /filename collision/);
  assert.equal(
    await readFile(join(pages, "assets", "current-abc.js"), "utf8"),
    "import('./nested/lazy-def.js')",
  );
  assert.equal(await readFile(join(pages, "index.html"), "utf8"), html);
  await writeFile(
    join(build, "index.html"),
    '<script src="./assets/missing.js"></script>',
  );
  await assert.rejects(preparePagesFiles(build, pages), /Missing entry asset/);
  await writeFile(
    join(build, "index.html"),
    '<script src="/assets/current-abc.js"></script>',
  );
  await assert.rejects(preparePagesFiles(build, pages), /relative/);
  await writeFile(
    join(build, "index.html"),
    `${html}<link href="/assets/missing.css">`,
  );
  await assert.rejects(preparePagesFiles(build, pages), /relative/);
  assert.equal(await readFile(join(pages, "index.html"), "utf8"), html);
  await assert.rejects(preparePagesFiles(build, build), /separate/);
  const checkout = join(temporary, "checkout");
  const nested = join(checkout, "nested");
  await mkdir(nested, { recursive: true });
  execFileSync("git", [
    "init",
    "--quiet",
    "--initial-branch=gh-pages",
    checkout,
  ]);
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [
          resolve("node_modules/tsx/dist/cli.mjs"),
          resolve("scripts/prepare-pages.ts"),
          nested,
        ],
        { encoding: "utf8", stdio: "pipe" },
      ),
    /root of the Pages checkout/,
  );
  await writeFile(join(build, "index.html"), html);
  await symlink(join(temporary, "outside"), join(build, "assets", "external"));
  await assert.rejects(preparePagesFiles(build, pages), /Symbolic links/);
  console.log(
    "Pages preparation checks passed: prior lazy assets retained, nested chunks copied, repeatable staging, immutable collisions and invalid builds rejected, unrelated settings preserved.",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
