from __future__ import annotations

import re
from difflib import SequenceMatcher
from urllib.parse import urlparse


def normalize_phone(value: str) -> str:
    return re.sub(r"\D+", "", value or "")


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def normalize_city(value: str) -> str:
    return normalize_text(value)


def normalize_url(value: str) -> str:
    if not value:
        return ""
    parsed = urlparse(value.strip())
    host = (parsed.netloc or parsed.path).lower().replace("www.", "")
    path = parsed.path.rstrip("/") if parsed.netloc else ""
    return f"{host}{path}".strip("/")


def normalize_instagram(value: str) -> str:
    normalized = normalize_url(value)
    return normalized.replace("instagram.com/", "").strip("/")


def build_dedupe_key(*, public_name: str, city: str, phone_public: str = "", website_url: str = "", instagram_url: str = "") -> str:
    phone = normalize_phone(phone_public)
    website = normalize_url(website_url)
    instagram = normalize_instagram(instagram_url)
    name = normalize_text(public_name)
    locality = normalize_city(city)
    strongest = phone or website or instagram
    if strongest:
        return f"{strongest}|{locality}"
    return f"{name}|{locality}"


def compute_similarity(*, left: dict, right: dict) -> tuple[float, list[str]]:
    reasons: list[str] = []
    score = 0.0

    left_phone = normalize_phone(left.get("phone_public", ""))
    right_phone = normalize_phone(right.get("phone_public", ""))
    if left_phone and right_phone and left_phone == right_phone:
        reasons.append("same_phone")
        score += 0.95

    left_site = normalize_url(left.get("website_url", ""))
    right_site = normalize_url(right.get("website_url", ""))
    if left_site and right_site and left_site == right_site:
        reasons.append("same_website")
        score += 0.8

    left_instagram = normalize_instagram(left.get("instagram_url", ""))
    right_instagram = normalize_instagram(right.get("instagram_url", ""))
    if left_instagram and right_instagram and left_instagram == right_instagram:
        reasons.append("same_instagram")
        score += 0.8

    left_name = normalize_text(left.get("public_name") or left.get("business_name", ""))
    right_name = normalize_text(right.get("public_name") or right.get("business_name", ""))
    left_city = normalize_city(left.get("city", ""))
    right_city = normalize_city(right.get("city", ""))

    if left_name and right_name:
        name_similarity = SequenceMatcher(None, left_name, right_name).ratio()
        if name_similarity >= 0.92 and left_city and right_city and left_city == right_city:
            reasons.append("same_name_same_city")
            score += 0.6
        elif name_similarity >= 0.85:
            reasons.append("similar_name")
            score += 0.25

    return min(score, 1.0), reasons
