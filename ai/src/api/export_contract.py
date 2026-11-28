"""Export the internal OpenAPI artifact without exposing interactive docs."""

import argparse
import json
from pathlib import Path

from src.api.main import create_app


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    application = create_app()
    try:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(application.openapi(), indent=2) + "\n", encoding="utf-8")
    finally:
        application.state.ingestion.store.close()


if __name__ == "__main__":
    main()
