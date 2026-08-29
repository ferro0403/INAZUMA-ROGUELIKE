#!/usr/bin/env python3
"""Extract the raw InaZumo supertechnique catalogue without touching game data.

Phase 1 only: build a canonical raw catalogue of moves. Player/season assignment is
intentionally left for a later tool.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

SOURCE_URL = "https://inazumo.es/tecnicas"
SCHEMA_VERSION = 1

TYPE_MAP = {
    "tiro": "shot",
    "regate": "dribble",
    "defensa": "defense",
    "parada": "save",
}

ELEMENT_MAP = {
    "fuego": "Fire",
    "viento": "Wind",
    "montana": "Mountain",
    "bosque": "Forest",
}

KNOWN_FLAGS = {
    "tiro largo": "long_shot",
    "contrataque": "counterattack",
    "contraataque": "counterattack",
}

LABELS = {
    "potencia",
    "tension",
    "tensión",
}


def _norm(value: str | None) -> str:
    text = unicodedata.normalize("NFKD", value or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text).strip().casefold()


def _slugify(value: str) -> str:
    norm = _norm(value)
    norm = re.sub(r"[^a-z0-9]+", "-", norm).strip("-")
    return norm or "move"


def _clean_lines(values: Iterable[str]) -> list[str]:
    result: list[str] = []
    for value in values:
        clean = re.sub(r"\s+", " ", str(value or "")).strip()
        if clean:
            result.append(clean)
    return result


def _extract_labeled_int(lines: list[str], label: str) -> int | None:
    target = _norm(label)
    for index, line in enumerate(lines):
        norm = _norm(line)
        match = re.search(rf"\b{re.escape(target)}\b\D*(\d{{1,3}})\b", norm)
        if match:
            return int(match.group(1))
        if norm == target and index + 1 < len(lines):
            next_match = re.fullmatch(r"\D*(\d{1,3})\D*", lines[index + 1])
            if next_match:
                return int(next_match.group(1))
    return None


def _find_type(*values: str | None) -> tuple[str | None, str | None]:
    for raw in values:
        norm = _norm(raw)
        for source, canonical in TYPE_MAP.items():
            if re.search(rf"\b{re.escape(source)}\b", norm):
                source_es = {
                    "tiro": "Tiro",
                    "regate": "Regate",
                    "defensa": "Defensa",
                    "parada": "Parada",
                }[source]
                return canonical, source_es
    return None, None


def _find_element(*values: str | None) -> tuple[str | None, str | None]:
    for raw in values:
        norm = _norm(raw)
        for source, canonical in ELEMENT_MAP.items():
            if re.search(rf"\b{re.escape(source)}\b", norm):
                source_es = {
                    "fuego": "Fuego",
                    "viento": "Viento",
                    "montana": "Montaña",
                    "bosque": "Bosque",
                }[source]
                return canonical, source_es
    return None, None


def _move_id_from_url(source_url: str | None, english_name: str) -> str:
    if source_url:
        path_parts = [part for part in urlparse(source_url).path.split("/") if part]
        if path_parts and path_parts[-1] not in {"tecnicas", "tecnica"}:
            return _slugify(path_parts[-1])
    return _slugify(english_name)


def _looks_like_number(value: str) -> bool:
    return bool(re.fullmatch(r"\D*\d{1,3}\D*", value.strip()))


def parse_card_payload(payload: dict[str, Any]) -> dict[str, Any] | None:
    """Turn one DOM card snapshot into a stable raw move record."""
    lines = _clean_lines(payload.get("lines") or [])
    headings = _clean_lines(payload.get("headings") or [])
    alts = _clean_lines(payload.get("imageAlts") or [])
    if not lines:
        return None

    source_name_es = headings[0] if headings else lines[0]
    source_name_norm = _norm(source_name_es)

    english_name: str | None = None
    try:
        start_index = next(i for i, line in enumerate(lines) if _norm(line) == source_name_norm) + 1
    except StopIteration:
        start_index = 0

    skip_exact = set(LABELS) | set(TYPE_MAP) | set(ELEMENT_MAP) | set(KNOWN_FLAGS)
    for line in lines[start_index:]:
        norm = _norm(line)
        if not norm or norm in skip_exact or _looks_like_number(line):
            continue
        if norm.startswith("potencia") or norm.startswith("tension"):
            continue
        english_name = line
        break

    if not english_name:
        return None

    combined = " | ".join(lines + alts)
    move_type, source_type_es = _find_type(combined)
    element, source_element_es = _find_element(combined)
    power = _extract_labeled_int(lines, "Potencia")
    tension = _extract_labeled_int(lines, "Tensión")

    flags: list[str] = []
    for line in lines:
        mapped = KNOWN_FLAGS.get(_norm(line))
        if mapped and mapped not in flags:
            flags.append(mapped)

    source_url = payload.get("sourceUrl") or None
    move_id = _move_id_from_url(source_url, english_name)

    return {
        "moveId": move_id,
        "name": english_name,
        "sourceNameEs": source_name_es,
        "type": move_type,
        "sourceTypeEs": source_type_es,
        "element": element,
        "sourceElementEs": source_element_es,
        "power": power,
        "tension": tension,
        "flags": flags,
        "sourceUrl": source_url,
    }


def _record_key(move: dict[str, Any]) -> str:
    return move.get("sourceUrl") or "|".join(
        [
            _norm(move.get("name")),
            _norm(move.get("sourceNameEs")),
            _norm(move.get("type")),
            str(move.get("power")),
        ]
    )


def _dedupe_and_stabilize(moves: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen_keys: set[str] = set()
    used_ids: dict[str, str] = {}
    result: list[dict[str, Any]] = []

    for move in moves:
        key = _record_key(move)
        if key in seen_keys:
            continue
        seen_keys.add(key)

        move_id = move["moveId"]
        previous_key = used_ids.get(move_id)
        if previous_key and previous_key != key:
            digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:8]
            move["moveId"] = f"{move_id}-{digest}"
        used_ids[move["moveId"]] = key
        result.append(move)

    result.sort(key=lambda item: (_norm(item.get("name")), item.get("moveId") or ""))
    return result


def _atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp_path, path)


def _load_resume(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    result: dict[str, dict[str, Any]] = {}
    for move in payload.get("moves", []):
        key = _record_key(move)
        if key:
            result[key] = move
    return result


def _catalog_payload(moves: list[dict[str, Any]]) -> dict[str, Any]:
    missing = {
        "type": sum(1 for move in moves if not move.get("type")),
        "element": sum(1 for move in moves if not move.get("element")),
        "power": sum(1 for move in moves if move.get("power") is None),
        "tension": sum(1 for move in moves if move.get("tension") is None),
    }
    return {
        "schemaVersion": SCHEMA_VERSION,
        "source": "inazumo.es",
        "sourceUrl": SOURCE_URL,
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "count": len(moves),
        "missingFields": missing,
        "moves": moves,
    }


def _scroll_until_stable(page: Any, max_rounds: int = 80) -> None:
    stable_rounds = 0
    previous_height = -1
    for _ in range(max_rounds):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(350)
        height = page.evaluate("document.body.scrollHeight")
        if height == previous_height:
            stable_rounds += 1
        else:
            stable_rounds = 0
            previous_height = height
        if stable_rounds >= 3:
            break
    page.evaluate("window.scrollTo(0, 0)")


def _extract_dom_cards(page: Any) -> list[dict[str, Any]]:
    return page.evaluate(
        r"""
        () => {
          const norm = (value) => (value || '').replace(/\s+/g, ' ').trim();
          const hasStats = (node) => {
            const text = norm(node?.innerText || '');
            return /Potencia/i.test(text) && /Tensi[oó]n/i.test(text) && /\d/.test(text);
          };
          const nearestCard = (start) => {
            let node = start;
            for (let i = 0; i < 9 && node; i += 1, node = node.parentElement) {
              if (hasStats(node) && norm(node.innerText).length < 900) return node;
            }
            return null;
          };
          const snapshot = (node, href) => ({
            sourceUrl: href || null,
            lines: (node.innerText || '').split(/\n+/).map(norm).filter(Boolean),
            headings: Array.from(node.querySelectorAll('h1,h2,h3,h4,h5,h6'))
              .map((el) => norm(el.innerText)).filter(Boolean),
            imageAlts: Array.from(node.querySelectorAll('img'))
              .map((img) => norm(img.getAttribute('alt'))).filter(Boolean),
          });

          const byKey = new Map();
          for (const link of document.querySelectorAll('a[href]')) {
            const href = link.href || '';
            if (!/\/tecnicas?\//i.test(href)) continue;
            const card = nearestCard(link);
            if (!card) continue;
            byKey.set(href, snapshot(card, href));
          }

          if (!byKey.size) {
            const candidates = Array.from(document.querySelectorAll('main *')).filter(hasStats);
            for (const node of candidates) {
              if (Array.from(node.children).some(hasStats)) continue;
              const snap = snapshot(node, null);
              const key = snap.lines.slice(0, 4).join('|');
              if (key) byKey.set(key, snap);
            }
          }
          return Array.from(byKey.values());
        }
        """
    )


def _resolve_detail(detail_page: Any, move: dict[str, Any], timeout_ms: int) -> dict[str, Any]:
    if not move.get("sourceUrl"):
        return move
    detail_page.goto(move["sourceUrl"], wait_until="domcontentloaded", timeout=timeout_ms)
    detail_page.wait_for_timeout(250)
    body_text = detail_page.locator("body").inner_text(timeout=timeout_ms)
    image_alts = detail_page.evaluate(
        "Array.from(document.querySelectorAll('img')).map(i => i.getAttribute('alt') || '').filter(Boolean)"
    )
    combined = " | ".join([body_text, *image_alts])

    if not move.get("element"):
        element, source_element_es = _find_element(combined)
        move["element"] = element
        move["sourceElementEs"] = source_element_es
    if not move.get("type"):
        move_type, source_type_es = _find_type(combined)
        move["type"] = move_type
        move["sourceTypeEs"] = source_type_es
    return move


def run(args: argparse.Namespace) -> int:
    try:
        from playwright.sync_api import Error as PlaywrightError
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "Playwright non installato. Esegui: pip install -r tools/inazumo_moves/requirements.txt "
            "e poi: python -m playwright install chromium",
            file=sys.stderr,
        )
        return 2

    output_path = Path(args.output)
    resume = _load_resume(output_path) if args.resume else {}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not args.headed, slow_mo=args.slow_mo)
        context = browser.new_context(locale="es-ES")
        page = context.new_page()
        page.set_default_timeout(args.timeout_ms)

        print(f"[1/3] Apro catalogo: {SOURCE_URL}")
        try:
            page.goto(SOURCE_URL, wait_until="domcontentloaded", timeout=args.timeout_ms)
            page.wait_for_timeout(800)
            _scroll_until_stable(page)
            cards = _extract_dom_cards(page)
        except PlaywrightError as exc:
            debug_path = output_path.with_name("inazumo_catalog_debug.html")
            debug_path.parent.mkdir(parents=True, exist_ok=True)
            debug_path.write_text(page.content(), encoding="utf-8")
            print(f"Errore nel catalogo: {exc}", file=sys.stderr)
            print(f"HTML diagnostico salvato in: {debug_path}", file=sys.stderr)
            browser.close()
            return 1

        parsed = [move for card in cards if (move := parse_card_payload(card))]
        parsed = _dedupe_and_stabilize(parsed)
        if args.limit:
            parsed = parsed[: args.limit]

        print(f"[2/3] Tecniche individuate: {len(parsed)}")
        if not parsed:
            debug_path = output_path.with_name("inazumo_catalog_debug.html")
            debug_path.parent.mkdir(parents=True, exist_ok=True)
            debug_path.write_text(page.content(), encoding="utf-8")
            print(f"Nessuna tecnica riconosciuta. HTML diagnostico: {debug_path}", file=sys.stderr)
            browser.close()
            return 1

        detail_page = context.new_page() if args.resolve_details else None
        completed: list[dict[str, Any]] = []
        total = len(parsed)

        for index, move in enumerate(parsed, start=1):
            previous = resume.get(_record_key(move))
            if previous and previous.get("element") and previous.get("type"):
                move = previous
            elif detail_page and move.get("sourceUrl"):
                try:
                    move = _resolve_detail(detail_page, move, args.timeout_ms)
                except PlaywrightError as exc:
                    move["detailError"] = str(exc).splitlines()[0][:240]

            completed.append(move)
            if index % args.checkpoint_every == 0 or index == total:
                stable = _dedupe_and_stabilize(completed)
                _atomic_write_json(output_path, _catalog_payload(stable))
                print(f"  {index}/{total} salvate")
            if args.delay_ms > 0 and index < total:
                time.sleep(args.delay_ms / 1000)

        browser.close()

    final_moves = _dedupe_and_stabilize(completed)
    payload = _catalog_payload(final_moves)
    _atomic_write_json(output_path, payload)
    missing = payload["missingFields"]
    print(f"[3/3] Fatto: {output_path}")
    print(
        "Campi mancanti -> "
        f"tipo: {missing['type']}, elemento: {missing['element']}, "
        f"potenza: {missing['power']}, tensione: {missing['tension']}"
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Estrae il catalogo grezzo delle supertecniche da InaZumo senza modificare il gioco."
    )
    parser.add_argument(
        "--output",
        default="tools/inazumo_moves/output/moves_catalog_raw.json",
        help="Percorso JSON di output.",
    )
    parser.add_argument("--headed", action="store_true", help="Mostra Chromium durante l'estrazione.")
    parser.add_argument(
        "--resolve-details",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Visita le pagine dettaglio per completare soprattutto l'elemento (default: sì).",
    )
    parser.add_argument("--resume", action="store_true", help="Riusa i dettagli già presenti nell'output esistente.")
    parser.add_argument("--limit", type=int, default=0, help="Limita il numero di tecniche, utile per test.")
    parser.add_argument("--timeout-ms", type=int, default=30000, help="Timeout Playwright per pagina.")
    parser.add_argument("--delay-ms", type=int, default=150, help="Pausa tra pagine dettaglio.")
    parser.add_argument("--slow-mo", type=int, default=0, help="Slow motion Playwright, utile in debug headed.")
    parser.add_argument("--checkpoint-every", type=int, default=20, help="Salva un checkpoint ogni N tecniche.")
    return parser


def main() -> int:
    return run(build_parser().parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
