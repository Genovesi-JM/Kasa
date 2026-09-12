#!/usr/bin/env python3
"""Check the real Docker ignore semantics using invented files only.

No application build, dependency installation, image tag/push, cloud operation,
host environment file, credential, database or customer content is involved.
Only .dockerignore is copied from the repository. Docker exports a FROM scratch
fixture to a disposable local directory; no application image is modified.
"""

from pathlib import Path
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILES = {
    "src/vite-env.d.ts",
    "src/types.ts",
    "src/i18n.ts",
    "src/styles.css",
    "src/main.tsx",
    "src/App.tsx",
    "src/data.ts",
    "src/ErrorBoundary.tsx",
    "src/components/KasaMap.tsx",
    "src/components/DeviceSimulator.tsx",
    "src/components/mapGeometry.ts",
    "src/components/MortgageEstimator.tsx",
    "src/platform/catalog.ts",
    "src/platform/config.ts",
    "src/platform/api.ts",
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
    "server/index.ts",
    "server/config.ts",
    "server/schemas.ts",
    "server/tsconfig.json",
    "server/smoke.ts",
    "server/deployment-smoke.ts",
    "docs/openapi.yaml",
}
EXCLUDED_FIXTURES = {
    ".env",
    ".git/config",
    "customer.db",
    "src/customer.db",
    "src/components/nested/customer.db",
    "src/components/nested/customer.sqlite",
    "src/components/nested/customer.sqlite3",
    "src/components/nested/debug.log",
    "src/components/nested/credentials.txt",
    "src/components/nested/.env",
    "src/components/nested/.env.production",
    "src/components/nested/secret.json",
    "src/components/nested/service-account.json",
    "src/components/nested/serviceAccount.json",
    "src/components/nested/private.pem",
    "src/components/nested/private.key",
    "src/components/nested/export.csv",
    "src/components/nested/dump.sql",
    "src/platform/.env",
    "src/platform/credentials.txt",
    "src/platform/secret.json",
    "server/nested/customer.db",
    "server/nested/debug.log",
    "server/nested/credentials.txt",
    "server/nested/.env",
    "server/nested/secret.json",
    "docs/nested/customer.db",
    "docs/nested/debug.log",
    "docs/nested/credentials.txt",
    "docs/nested/.env",
    "docs/nested/secret.json",
}


def main():
    # Compare filenames only, never read additional repository source artifacts.
    actual_sources = {
        path.relative_to(ROOT).as_posix()
        for path in (ROOT / "src").rglob("*")
        if path.is_file()
    }
    if actual_sources != SOURCE_FILES:
        raise AssertionError("The source file inventory changed; review the exact allowlist.")
    if any((ROOT / name).is_symlink() for name in SOURCE_FILES):
        raise AssertionError("Source inputs must be regular files, not symbolic links.")

    expected = SOURCE_FILES | OTHER_ALLOWED_FILES
    with tempfile.TemporaryDirectory(prefix="kasa-context-check-") as temporary:
        fixture = Path(temporary) / "fixture"
        exported = Path(temporary) / "exported"
        fixture.mkdir()
        for relative in expected | EXCLUDED_FIXTURES:
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
            "PASS: all 15 reviewed source files and required build inputs included; "
            + str(len(EXCLUDED_FIXTURES))
            + " invented private/nested artifacts excluded by Docker."
        )
        print("Only disposable synthetic fixtures were used; application images were unchanged.")


if __name__ == "__main__":
    main()
