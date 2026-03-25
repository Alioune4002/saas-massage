from __future__ import annotations

import csv
import io

from .base import BaseImporter


class CSVImporter(BaseImporter):
    def fetch(self, *, file_content: bytes, encoding: str = "utf-8", **_kwargs):
        return file_content.decode(encoding)

    def parse(self, payload, *, mapping: dict | None = None, **_kwargs) -> list[dict]:
        reader = csv.DictReader(io.StringIO(payload))
        normalized_rows: list[dict] = []
        mapping = mapping or {}
        for raw_row in reader:
            row = {}
            for source_key, value in raw_row.items():
                target_key = mapping.get(source_key, source_key)
                row[target_key] = value
            normalized_rows.append(row)
        return normalized_rows
