import json
import sys
from pathlib import Path

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402


def export_openapi() -> None:
    schema = app.openapi()
    target_dir = Path(__file__).resolve().parent.parent.parent / "openapi"
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = target_dir / "openapi.json"
    target_file.write_text(json.dumps(schema, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Exported OpenAPI specification to {target_file}")


if __name__ == "__main__":
    export_openapi()
