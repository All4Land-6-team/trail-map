"""공통 시설 JSON을 원자적으로 기록한다."""

import json
import os
import tempfile
from pathlib import Path


def write_document(document: dict, output: Path, *, overwrite: bool = False) -> None:
    output = Path(output)
    if output.suffix.lower() != ".json":
        raise ValueError("output_must_be_json")
    if output.exists() and not overwrite:
        raise FileExistsError(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(dir=output.parent, suffix=".tmp")
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(document, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write("\n")
        os.replace(temporary, output)
    finally:
        Path(temporary).unlink(missing_ok=True)
