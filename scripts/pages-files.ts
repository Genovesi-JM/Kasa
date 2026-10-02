import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

async function regularFiles(directory: string): Promise<string[]> {
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error(`Expected a real directory: ${directory}`);
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink())
      throw new Error("Symbolic links are not allowed in static assets.");
    if (entry.isDirectory()) {
      for (const child of await regularFiles(join(directory, entry.name)))
        result.push(join(entry.name, child));
    } else if (entry.isFile()) result.push(entry.name);
    else
      throw new Error("Only regular files and directories may be published.");
  }
  return result;
}

function contains(parent: string, child: string) {
  const path = relative(parent, child);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
}

/** Keep immutable files from prior releases so an already-open app can lazy-load its screens. */
export async function preparePagesFiles(
  buildDirectory: string,
  pagesDirectory: string,
) {
  const build = resolve(buildDirectory);
  const pages = resolve(pagesDirectory);
  if (contains(build, pages) || contains(pages, build))
    throw new Error("Build and Pages directories must be separate.");
  const pagesMetadata = await lstat(pages);
  if (!pagesMetadata.isDirectory() || pagesMetadata.isSymbolicLink())
    throw new Error("The Pages checkout must be a real directory.");
  const indexPath = join(build, "index.html");
  const indexMetadata = await lstat(indexPath);
  if (!indexMetadata.isFile() || indexMetadata.isSymbolicLink())
    throw new Error("Build index.html must be a regular file.");
  const html = await readFile(indexPath, "utf8");
  const assets = await regularFiles(join(build, "assets"));
  if (!assets.length) throw new Error("No built assets were found.");
  if (/(?:src|href)\s*=\s*["']\/assets\//i.test(html))
    throw new Error(
      "The build must use relative ./assets/ references for GitHub Pages.",
    );
  const references = [
    ...html.matchAll(/(?:src|href)=["']\.\/assets\/([^"']+)["']/g),
  ].map((match) => match[1]);
  if (!references.length)
    throw new Error(
      "The build must use relative ./assets/ references for GitHub Pages.",
    );
  for (const reference of references) {
    if (!assets.includes(reference.split("/").join(sep)))
      throw new Error(`Missing entry asset: ${reference}`);
  }
  const targetAssets = join(pages, "assets");
  await mkdir(targetAssets, { recursive: true });
  const existing = await regularFiles(targetAssets);
  // Check every collision before replacing the entry point or copying files.
  // A content-hashed URL must never silently change its bytes.
  for (const name of assets) {
    if (!existing.includes(name)) continue;
    const [before, after] = await Promise.all([
      readFile(join(targetAssets, name)),
      readFile(join(build, "assets", name)),
    ]);
    if (!before.equals(after))
      throw new Error(`Asset filename collision: ${name}`);
  }
  for (const name of assets) {
    if (existing.includes(name)) continue;
    await mkdir(dirname(join(targetAssets, name)), { recursive: true });
    await copyFile(join(build, "assets", name), join(targetAssets, name));
  }
  // Publish the new entry only after all files it can reference are present.
  const temporaryIndex = join(pages, ".kasa-index.next");
  await writeFile(temporaryIndex, html, { flag: "wx" });
  await rename(temporaryIndex, join(pages, "index.html"));
  await writeFile(join(pages, ".nojekyll"), "", { flag: "a" });
  return {
    currentAssets: assets.length,
    retainedAssets: existing.filter((name) => !assets.includes(name)).length,
  };
}
