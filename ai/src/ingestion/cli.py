import argparse
import json
import sys

from src.common.errors import IngestionError
from src.common.settings import Settings
from src.ingestion.service import IngestionService


def main() -> int:
    parser = argparse.ArgumentParser(description="Mimamori approved-source ingestion operator")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list", help="List registered source keys and approval state")
    for name in ("ingest", "purge"):
        command = commands.add_parser(name)
        command.add_argument("source_keys", nargs="+", help="Keys from the operator-owned manifest")
    args = parser.parse_args()
    service = IngestionService(Settings())
    try:
        if args.command == "list":
            print(
                json.dumps(
                    [
                        {
                            "source_id": source.key,
                            "approved": source.approved,
                            "language": source.language,
                            "sensitivity_class": source.sensitivity_class,
                        }
                        for source in service.registry.entries().values()
                    ]
                )
            )
        else:
            for key in args.source_keys:
                if args.command == "ingest":
                    print(service.ingest(key).model_dump_json())
                else:
                    print(json.dumps({"document_id": service.purge(key), "status": "purged"}))
        return 0
    except IngestionError as error:
        print(json.dumps({"code": error.code, "message": error.message}), file=sys.stderr)
        return 1
    except Exception:
        print(
            json.dumps({"code": "INTERNAL_ERROR", "message": "Operation failed."}), file=sys.stderr
        )
        return 1
    finally:
        service.store.close()


if __name__ == "__main__":
    raise SystemExit(main())
