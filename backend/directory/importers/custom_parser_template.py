from __future__ import annotations

from .base import BaseImporter


class CustomParserTemplateImporter(BaseImporter):
    def fetch(self, **kwargs):
        return kwargs

    def parse(self, payload, **_kwargs) -> list[dict]:
        if isinstance(payload, list):
            return payload
        return []
