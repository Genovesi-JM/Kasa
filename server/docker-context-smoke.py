#!/usr/bin/env python3
"""Check the real Docker ignore semantics using invented files only.

No application build, dependency installation, image tag/push, cloud operation,
host environment file, credential, database or customer content is involved.
Only .dockerignore is copied from the repository. Docker exports a FROM scratch
fixture to a disposable local directory; no application image is modified.
"""

from pathlib import Path
import os
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
SOURCE_EXTENSIONS = {
    "src": {".ts", ".tsx", ".css"},
    "server": {".ts"},
    "scripts": {".ts"},
}
EXCLUDED_DIRECTORIES = {
    "node_modules", ".git", "dist", "build", "build-api", "coverage",
    ".cache", ".vite", "generated", "work", "outputs",
}
OTHER_ALLOWED_FILES = {
    "Dockerfile",
    ".dockerignore",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "tsconfig.api-build.json",
    "vite.config.ts",
    "index.html",
    "eslint.config.js",
    ".prettierignore",
    "server/tsconfig.json",
    "docs/openapi.yaml",
}
# Independent probes ensure newly nested legitimate code is not omitted again.
FUTURE_CODE_FIXTURES = {
    "src/context-fixture/deeper/module.ts",
    "src/context-fixture/deeper/Screen.tsx",
    "src/context-fixture/deeper/styles.css",
    "server/context-fixture/deeper/check.ts",
    "scripts/context-fixture/deeper/check.ts",
}
PRIVATE_FIXTURE_NAMES = {
    ".env.file-fixture", ".env.production", ".env.local.ts", "customer.db",
    "customer.sqlite", "customer.sqlite3", "debug.log", "credentials.txt",
    "credentials.json", "secret.json", "service-account.json",
    "serviceAccount.json", "private.pem", "private.key", "private.p12",
    "private.pfx", "private.jks", "private.keystore", "export.csv",
    "dump.sql", "cache.tsbuildinfo", "source.ts.map",
}
# A denied filename must also deny an identically named directory's contents.
# Keep .env itself available as a directory; .env.file-fixture tests a file.
PRIVATE_DIRECTORY_FIXTURE_NAMES = {
    ".env", ".env.local", "example.pem", "example.key",
    "example-credentials.json", "example-service-account.json",
    "example-serviceAccount.json", "example.p12", "example.pfx",
    "example.jks", "example.keystore",
}
EXCLUDED_FIXTURES = {
    (Path(parent) / name).as_posix()
    for parent in ("", "src/components/nested", "src/platform", "server/nested", "scripts/nested", "docs/nested")
    for name in PRIVATE_FIXTURE_NAMES
} | {
    (Path(parent) / directory / "nested" / name).as_posix()
    for parent in ("", "src", "src/components", "server", "scripts")
    for directory in EXCLUDED_DIRECTORIES
    for name in ("unexpected.ts", "unexpected.tsx", "unexpected.css")
} | {
    (Path(parent) / directory / "deeper" / "unexpected.ts").as_posix()
    for parent in ("", "src", "server", "scripts")
    for directory in PRIVATE_DIRECTORY_FIXTURE_NAMES
} | {
    ".git/config",
    "docs/not-allowed.ts",
    "server/not-allowed.py",
    "scripts/not-allowed.json",
    "tsconfig.private.json",
}


def required_sources(root):
    """Inspect filenames only; expected inputs never come from .dockerignore."""
    sources = set()
    for directory, extensions in SOURCE_EXTENSIONS.items():
        base = root / directory
        if base.is_symlink() or not base.is_dir():
            raise AssertionError(f"Source directory must be real: {directory}")
        for current, directories, filenames in os.walk(base, followlinks=False):
            for name in directories[:]:
                path = Path(current) / name
                if name in EXCLUDED_DIRECTORIES:
                    directories.remove(name)
                elif path.is_symlink():
                    raise AssertionError(f"Source directory must not be a symbolic link: {path.relative_to(root)}")
            for name in filenames:
                path = Path(current) / name
                if path.suffix not in extensions:
                    continue
                if path.is_symlink() or not path.is_file():
                    raise AssertionError(f"Source inputs must be regular files: {path.relative_to(root)}")
                sources.add(path.relative_to(root).as_posix())
    return sources


def main():
    sources = required_sources(ROOT)
    for name in OTHER_ALLOWED_FILES:
        path = ROOT / name
        if not path.is_file() or any(part.is_symlink() for part in (path, *path.parents) if part != ROOT):
            raise AssertionError(f"Required configuration must be a regular file: {name}")
    expected = sources | OTHER_ALLOWED_FILES | FUTURE_CODE_FIXTURES
    if expected & EXCLUDED_FIXTURES:
        raise AssertionError("Required inputs overlap forbidden fixture paths.")
    with tempfile.TemporaryDirectory(prefix="kasa-context-check-") as temporary:
        fixture = Path(temporary) / "fixture"
        exported = Path(temporary) / "exported"
        fixture.mkdir()
        for relative in sorted(expected | EXCLUDED_FIXTURES):
            path = fixture / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("SYNTHETIC CONTEXT TEST ONLY\n", encoding="utf-8")
        (fixture / ".dockerignore").write_text(
            (ROOT / ".dockerignore").read_text(encoding="utf-8"), encoding="utf-8"
        )
        (fixture / "Dockerfile").write_text("FROM scratch\nCOPY . /\n", encoding="utf-8")
        result = subprocess.run(
            [
                "docker", "build", "--network", "none", "--no-cache",
                "--output", "type=local,dest=" + str(exported), str(fixture),
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode:
            raise RuntimeError("Synthetic Docker context check failed: " + result.stderr[-4000:])
        actual = {
            path.relative_to(exported).as_posix()
            for path in exported.rglob("*")
            if path.is_file()
        }
        if actual != expected:
            raise AssertionError(
                "Context mismatch: missing=" + repr(sorted(expected - actual))
                + "; unexpected=" + repr(sorted(actual - expected))
            )
        print(
            f"PASS: all {len(sources)} current code files, {len(OTHER_ALLOWED_FILES)} required configs "
            + f"and {len(FUTURE_CODE_FIXTURES)} future nested code probes included; "
            + str(len(EXCLUDED_FIXTURES))
            + " invented private/nested artifacts excluded by Docker."
        )
        print("Only disposable synthetic fixtures were used; application images were unchanged.")


if __name__ == "__main__":
    main()
