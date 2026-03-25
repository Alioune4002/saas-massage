from __future__ import annotations

import json

from .base import BaseImporter


class JsonFeedImporter(BaseImporter):
    def fetch(self, *, payload_text: str, **_kwargs):
        return payload_text

    def parse(self, payload, **_kwargs) -> list[dict]:
        data = json.loads(payload or "[]")
        if isinstance(data, dict):
            for key in ("results", "items", "profiles"):
                if isinstance(data.get(key), list):
                    return data[key]
            return [data]
        return data if isinstance(data, list) else []
