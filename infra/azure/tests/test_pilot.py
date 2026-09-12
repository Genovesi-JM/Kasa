"""Offline template and parameter checks; no Azure/login/container side effects."""

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("kasa_pilot_parameters", ROOT / "parameters.py")
parameters = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parameters)
DIGEST = "sha256:" + "a" * 64  # Synthetic test fixture, never an image release.


class ParameterTests(unittest.TestCase):
    def test_foundation_is_default_private_and_has_no_image(self):
        actual = parameters.build_parameters()["parameters"]
        self.assertFalse(actual["runtime"]["value"])
        self.assertFalse(actual["externalIngress"]["value"])
        self.assertEqual(actual["imageDigest"]["value"], "")
        self.assertEqual(actual["location"]["value"], "spaincentral")

    def test_runtime_does_not_imply_public_access(self):
        actual = parameters.build_parameters(runtime=True, image_digest=DIGEST)["parameters"]
        self.assertTrue(actual["runtime"]["value"])
        self.assertFalse(actual["externalIngress"]["value"])
        self.assertEqual(actual["imageDigest"]["value"], DIGEST)

    def test_location_can_be_explicitly_selected_for_offer_eligibility(self):
        actual = parameters.build_parameters(location="northeurope")["parameters"]
        self.assertEqual(actual["location"]["value"], "northeurope")
        for location in ("", "West Europe", "../other"):
            with self.subTest(location=location), self.assertRaises(ValueError):
                parameters.build_parameters(location=location)

    def test_public_access_is_explicit(self):
        actual = parameters.build_parameters(runtime=True, external_ingress=True, image_digest=DIGEST)
        self.assertTrue(actual["parameters"]["externalIngress"]["value"])

    def test_invalid_runtime_images_rejected(self):
        for digest in ("", "latest", "kasa-web-api:pilot", "sha256:" + "0" * 64,
                       "sha256:" + "z" * 64, "sha256:" + "a" * 63, DIGEST + "x",
                       "sha256:" + "A" * 64, "registry/image@" + DIGEST):
            with self.subTest(digest=digest), self.assertRaises(ValueError):
                parameters.build_parameters(runtime=True, image_digest=digest)

    def test_foundation_cannot_have_public_ingress_or_image(self):
        with self.assertRaises(ValueError):
            parameters.build_parameters(external_ingress=True)
        with self.assertRaises(ValueError):
            parameters.build_parameters(image_digest=DIGEST)

    def test_cli_refuses_invalid_runtime_before_emitting_parameters(self):
        result = subprocess.run(
            ["python3", str(ROOT / "parameters.py"), "--runtime", "--image-digest", "latest"],
            text=True, capture_output=True, check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")


class CompiledTemplateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        result = subprocess.run(
            [os.environ.get("BICEP_BIN", "bicep"), "build", str(ROOT / "main.bicep"), "--stdout"],
            text=True, capture_output=True, check=False,
        )
        if result.returncode != 0:
            raise AssertionError("Bicep compilation failed: " + result.stderr)
        if result.stderr.strip():
            raise AssertionError("Bicep must compile without warnings: " + result.stderr)
        cls.template = json.loads(result.stdout)
        cls.resources = {resource["type"]: resource for resource in cls.template["resources"]}

    def test_only_minimal_resources_and_one_scoped_role(self):
        self.assertEqual(set(self.resources), {
            "Microsoft.ContainerRegistry/registries", "Microsoft.ManagedIdentity/userAssignedIdentities",
            "Microsoft.Authorization/roleAssignments", "Microsoft.OperationalInsights/workspaces",
            "Microsoft.App/managedEnvironments", "Microsoft.App/containerApps",
        })
        self.assertEqual(len(self.template["resources"]), 6)
        role = self.resources["Microsoft.Authorization/roleAssignments"]
        self.assertIn("Microsoft.ContainerRegistry/registries", role["scope"])
        self.assertEqual(role["properties"]["roleDefinitionId"], "[variables('acrPullRoleId')]")
        self.assertIn("7f951dda-4ed3-4680-a7ca-43fe172d538d", self.template["variables"]["acrPullRoleId"])

    def test_registry_is_basic_authenticated_and_admin_disabled(self):
        registry = self.resources["Microsoft.ContainerRegistry/registries"]
        self.assertEqual(registry["sku"]["name"], "Basic")
        self.assertFalse(registry["properties"]["adminUserEnabled"])
        self.assertFalse(registry["properties"]["anonymousPullEnabled"])

    def test_foundation_runtime_and_ingress_defaults_are_separate(self):
        self.assertFalse(self.template["parameters"]["runtime"]["defaultValue"])
        self.assertFalse(self.template["parameters"]["externalIngress"]["defaultValue"])
        app = self.resources["Microsoft.App/containerApps"]
        self.assertEqual(app["condition"], "[parameters('runtime')]")
        ingress = app["properties"]["configuration"]["ingress"]
        self.assertEqual(ingress["external"], "[parameters('externalIngress')]")
        self.assertFalse(ingress["allowInsecure"])
        self.assertEqual(ingress["targetPort"], 8787)

    def test_consumption_scale_zero_and_bounded_replicas(self):
        app = self.resources["Microsoft.App/containerApps"]["properties"]
        self.assertEqual(app["workloadProfileName"], "Consumption")
        self.assertEqual(app["template"]["scale"]["minReplicas"], 0)
        self.assertEqual(app["template"]["scale"]["maxReplicas"], 2)
        self.assertEqual(app["template"]["containers"][0]["resources"], {"cpu": "[json('0.25')]", "memory": "0.5Gi"})
        profiles = self.resources["Microsoft.App/managedEnvironments"]["properties"]["workloadProfiles"]
        self.assertEqual(profiles, [{"name": "Consumption", "workloadProfileType": "Consumption"}])

    def test_log_retention_and_daily_cap(self):
        logs = self.resources["Microsoft.OperationalInsights/workspaces"]["properties"]
        self.assertEqual(logs["retentionInDays"], 30)
        self.assertEqual(logs["workspaceCapping"]["dailyQuotaGb"], "[json('0.1')]")

    def test_read_only_synthetic_image_has_no_secret_bindings(self):
        app = self.resources["Microsoft.App/containerApps"]["properties"]
        container = app["template"]["containers"][0]
        self.assertIn("/kasa-web-api@", container["image"])
        self.assertIn("parameters('imageDigest')", container["image"])
        env = {item["name"]: item["value"] for item in container["env"]}
        self.assertEqual(env["NODE_ENV"], "production")
        self.assertEqual(env["KASA_API_DEMO_WRITES"], "false")
        self.assertEqual(env["KASA_API_COUNTRY"], "demo")
        self.assertEqual(env["KASA_API_SERVE_WEB"], "true")
        self.assertEqual(env["KASA_API_ENV_FILE"], "/app/no-runtime-env-file")
        self.assertNotIn("KASA_API_DEMO_KEY", env)
        self.assertNotIn("secrets", app["configuration"])
        self.assertIn("format('https://{0}.{1}'", env["KASA_API_ALLOWED_ORIGINS"])
        self.assertIn("variables('applicationName')", env["KASA_API_ALLOWED_ORIGINS"])
        self.assertNotIn("*", env["KASA_API_ALLOWED_ORIGINS"])
        registries = app["configuration"]["registries"]
        self.assertEqual(len(registries), 1)
        self.assertEqual(set(registries[0]), {"identity", "server"})

    def test_truthful_http_probe_paths(self):
        container = self.resources["Microsoft.App/containerApps"]["properties"]["template"]["containers"][0]
        probes = {probe["type"]: probe["httpGet"] for probe in container["probes"]}
        self.assertEqual(probes, {
            "Startup": {"path": "/api/v1/health", "port": 8787, "scheme": "HTTP"},
            "Liveness": {"path": "/api/v1/health", "port": 8787, "scheme": "HTTP"},
            "Readiness": {"path": "/api/v1/ready", "port": 8787, "scheme": "HTTP"},
        })


if __name__ == "__main__":
    unittest.main()
