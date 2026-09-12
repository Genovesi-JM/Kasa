#!/usr/bin/env python3
"""Generate non-secret ARM parameters locally. Never contacts Azure or reads env files."""

import argparse
import json
import re


def build_parameters(*, runtime=False, external_ingress=False, image_digest="", location="spaincentral"):
    if not re.fullmatch(r"[a-z][a-z0-9]+", location):
        raise ValueError("Location must be an Azure region identifier reviewed by the release owner.")
    if external_ingress and not runtime:
        raise ValueError("External ingress requires an explicitly selected runtime.")
    if runtime:
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", image_digest):
            raise ValueError("Runtime requires a reviewed sha256 image manifest digest.")
        if image_digest == "sha256:" + "0" * 64:
            raise ValueError("The all-zero placeholder is not a reviewed image digest.")
    elif image_digest:
        raise ValueError("Foundation does not accept an image digest; select --runtime.")
    return {
        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
        "contentVersion": "1.0.0.0",
        "parameters": {
            "runtime": {"value": runtime},
            "externalIngress": {"value": external_ingress},
            "location": {"value": location},
            "imageDigest": {"value": image_digest},
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime", action="store_true")
    parser.add_argument("--external-ingress", action="store_true")
    parser.add_argument("--image-digest", default="")
    parser.add_argument("--location", default="spaincentral")
    args = parser.parse_args()
    try:
        parameters = build_parameters(
            runtime=args.runtime,
            external_ingress=args.external_ingress,
            image_digest=args.image_digest,
            location=args.location,
        )
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(parameters, indent=2))


if __name__ == "__main__":
    main()
