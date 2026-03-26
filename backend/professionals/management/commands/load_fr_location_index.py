import csv
from collections import Counter
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from directory.models import ImportedProfile
from professionals.models import LocationIndex, ProfessionalProfile


DATASET_DEFAULT_PATH = Path("backend/professionals/data/fr_locations.csv")

MAJOR_CITY_PRIORITY = {
    "paris": 500,
    "marseille": 460,
    "lyon": 440,
    "toulouse": 420,
    "nice": 380,
    "nantes": 360,
    "montpellier": 340,
    "strasbourg": 320,
    "bordeaux": 300,
    "lille": 280,
    "rennes": 260,
    "reims": 220,
    "brest": 220,
    "quimper": 220,
}


def normalize_postal_code(value: str) -> str:
    raw = "".join(char for char in str(value or "").strip() if char.isalnum()).upper()
    if raw.isdigit():
        return raw.zfill(5)
    return raw


def normalize_department_code(value: str) -> str:
    raw = str(value or "").strip().upper()
    if raw.isdigit():
        return raw.zfill(2)
    return raw


class Command(BaseCommand):
    help = "Charge le référentiel FR de localisations dans LocationIndex."

    def add_arguments(self, parser):
        parser.add_argument(
            "--csv-path",
            default=str(DATASET_DEFAULT_PATH),
            help="Chemin vers le CSV France à charger.",
        )
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Remplace complètement le contenu actuel de LocationIndex avant chargement.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Nombre max de lignes CSV à traiter, utile pour un dry-run local.",
        )

    def handle(self, *args, **options):
        csv_path = Path(options["csv_path"])
        if not csv_path.exists():
            raise CommandError(f"CSV introuvable: {csv_path}")

        rows = self._load_rows(csv_path=csv_path, limit=options["limit"])
        if not rows:
            raise CommandError("Le CSV ne contient aucune ligne exploitable.")

        city_usage = self._build_city_usage_counter()
        payload = self._build_location_payload(rows=rows, city_usage=city_usage)

        with transaction.atomic():
            if options["replace"]:
                LocationIndex.objects.all().delete()
            elif LocationIndex.objects.exists():
                raise CommandError(
                    "LocationIndex contient déjà des données. Relancez avec --replace pour recharger proprement le référentiel."
                )
            LocationIndex.objects.bulk_create(payload, batch_size=2000)

        counts = Counter(item.location_type for item in payload)
        self.stdout.write(
            self.style.SUCCESS(
                "Référentiel FR chargé : "
                f"{len(payload)} entrées "
                f"(villes={counts[LocationIndex.LocationType.CITY]}, "
                f"codes postaux={counts[LocationIndex.LocationType.POSTAL_CODE]}, "
                f"départements={counts[LocationIndex.LocationType.DEPARTMENT]}, "
                f"régions={counts[LocationIndex.LocationType.REGION]}, "
                f"pays={counts[LocationIndex.LocationType.COUNTRY]})."
            )
        )

    def _load_rows(self, *, csv_path: Path, limit: int) -> list[dict[str, str]]:
        rows: list[dict[str, str]] = []
        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for index, row in enumerate(reader, start=1):
                rows.append(row)
                if limit and index >= limit:
                    break
        return rows

    def _build_city_usage_counter(self) -> Counter[str]:
        counter: Counter[str] = Counter()
        for city in ProfessionalProfile.objects.exclude(city="").values_list("city", flat=True):
            counter[slugify(city)] += 1
        for city in ImportedProfile.objects.exclude(city="").values_list("city", flat=True):
            counter[slugify(city)] += 1
        return counter

    def _build_location_payload(self, *, rows: list[dict[str, str]], city_usage: Counter[str]):
        countries: dict[str, dict] = {}
        regions: dict[tuple[str, str], dict] = {}
        departments: dict[tuple[str, str], dict] = {}
        postal_codes: dict[str, dict] = {}
        cities: dict[tuple[str, str, str], dict] = {}

        for row in rows:
            city_name = (row.get("nom_commune_complet") or row.get("nom_commune") or "").strip()
            postal_code = normalize_postal_code(row.get("code_postal", ""))
            department_code = normalize_department_code(row.get("code_departement", ""))
            department_name = str(row.get("nom_departement", "")).strip()
            region_code = str(row.get("code_region", "")).strip()
            region_name = str(row.get("nom_region", "")).strip()
            insee_code = str(row.get("code_commune_INSEE", "")).strip()
            country = "France"

            if not city_name:
                continue

            country_slug = slugify(country)
            countries[country_slug] = {
                "location_type": LocationIndex.LocationType.COUNTRY,
                "label": country,
                "slug": country_slug,
                "country": country,
                "priority": 20,
            }

            if region_name:
                region_slug = slugify(region_name)
                regions[(region_slug, region_code)] = {
                    "location_type": LocationIndex.LocationType.REGION,
                    "label": region_name,
                    "slug": region_slug,
                    "region": region_name,
                    "region_code": region_code,
                    "country": country,
                    "priority": 180,
                }

            if department_name or department_code:
                department_slug_base = slugify(department_name) if department_name else department_code.lower()
                department_slug = f"{department_slug_base}-{department_code.lower()}".strip("-")
                departments[(department_slug, department_code)] = {
                    "location_type": LocationIndex.LocationType.DEPARTMENT,
                    "label": f"{department_name} ({department_code})" if department_name else department_code,
                    "slug": department_slug,
                    "department_code": department_code,
                    "department_name": department_name,
                    "region": region_name,
                    "region_code": region_code,
                    "country": country,
                    "priority": 200,
                }

            if postal_code:
                postal_codes[postal_code] = {
                    "location_type": LocationIndex.LocationType.POSTAL_CODE,
                    "label": postal_code,
                    "slug": postal_code,
                    "postal_code": postal_code,
                    "department_code": department_code,
                    "department_name": department_name,
                    "region": region_name,
                    "region_code": region_code,
                    "country": country,
                    "priority": 150,
                }

            city_key = (city_name, department_code, insee_code)
            cities[city_key] = {
                "location_type": LocationIndex.LocationType.CITY,
                "label": city_name,
                "slug": "",
                "city": city_name,
                "postal_code": postal_code,
                "insee_code": insee_code,
                "department_code": department_code,
                "department_name": department_name,
                "region": region_name,
                "region_code": region_code,
                "country": country,
                "priority": 220 + city_usage.get(slugify(city_name), 0) * 25,
            }

        city_slug_counts = Counter(slugify(item["city"]) for item in cities.values())
        used_slugs: set[str] = set()
        city_objects: list[LocationIndex] = []
        for item in sorted(cities.values(), key=lambda value: (value["city"], value["department_code"], value["postal_code"])):
            base_slug = slugify(item["city"])
            duplicate_city = city_slug_counts[base_slug] > 1
            if duplicate_city:
                contextual_slug = f"{base_slug}-{item['department_code'].lower()}".strip("-")
                label = f"{item['city']} ({item['department_code']})"
            else:
                contextual_slug = base_slug
                label = item["city"]
            if contextual_slug in used_slugs:
                contextual_slug = f"{contextual_slug}-{(item['insee_code'] or item['postal_code']).lower()}".strip("-")
                label = f"{label} · {item['postal_code']}".strip()
            used_slugs.add(contextual_slug)
            item["slug"] = contextual_slug
            item["label"] = label
            item["priority"] += MAJOR_CITY_PRIORITY.get(base_slug, 0)
            city_objects.append(LocationIndex(**item))

        payload: list[LocationIndex] = [
            LocationIndex(**value) for value in countries.values()
        ] + [
            LocationIndex(**value) for value in regions.values()
        ] + [
            LocationIndex(**value) for value in departments.values()
        ] + [
            LocationIndex(**value) for value in postal_codes.values()
        ] + city_objects

        return payload
