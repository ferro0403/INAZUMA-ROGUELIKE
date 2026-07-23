#!/usr/bin/env python3
"""Deterministic visual regression test for the isolated active-run Home fixture."""
import argparse, json, os
from pathlib import Path
from tempfile import TemporaryDirectory
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
BASELINES = HERE / "baselines"
VIEWPORTS = ((360,800),(390,844),(430,932),(1366,768),(1440,900),(1920,1080))


def html():
    page = (HERE / "home-active-harness.html").read_text(encoding="utf-8")
    css = (HERE / "home-active-current.css").read_text(encoding="utf-8")
    fixture = (HERE / "home-active.fixture.js").read_text(encoding="utf-8")
    return page.replace('<link rel="stylesheet" href="home-active-current.css" />', f"<style>{css}</style>").replace('<script src="home-active.fixture.js"></script>', f"<script>{fixture}</script>")


def normalized(image, width):
    divisor = 3 if width <= 390 else (4 if width < 800 else 8)
    image = image.convert("RGB")
    small = image.resize((max(1, image.width // divisor), max(1, image.height // divisor)), Image.Resampling.BOX)
    return small.quantize(colors=6, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).resize(image.size, Image.Resampling.NEAREST).convert("RGB")


def write_baseline(actual, expected, width):
    with Image.open(actual) as image:
        normalized(image, width).quantize(colors=6, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(expected, optimize=True)


def compare(actual, expected, width):
    assert expected.exists(), f"Baseline mancante: {expected}"
    with Image.open(actual) as a_img, Image.open(expected) as e_img:
        a, e = normalized(a_img, width), e_img.convert("RGB")
        assert a.size == e.size, f"Dimensioni mutate: actual={a.size}, expected={e.size}"
        diff = ImageChops.difference(a, e)
        changed = sum(max(pixel) > 48 for pixel in diff.get_flattened_data())
        total = a.width * a.height
        if changed / total > 0.02:
            raise AssertionError(f"Baseline diversa oltre tolleranza: {changed}/{total} pixel ({changed/total:.4%}). Usa --update solo dopo revisione intenzionale.")


def run(browser, markup, width, height, update, temp):
    context = browser.new_context(viewport={"width":width,"height":height}, device_scale_factor=1, locale="it-IT", timezone_id="Europe/Rome", color_scheme="dark", reduced_motion="reduce")
    page = context.new_page(); page_errors=[]; console_errors=[]
    page.evaluate("globalThis.__INAZUMA_VISUAL_FIXTURE_ACTIVATION__={fixtureId:'home-active-v1',source:'home-active.fixture.js'}")
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.set_content(markup, wait_until="load")
    page.add_style_tag(content="*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}")
    page.wait_for_selector('html[data-visual-fixture-ready="true"]')
    page.wait_for_function("document.fonts?document.fonts.status==='loaded':true")
    page.wait_for_function("Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)")
    assert page.locator(".home-screen.modern-home").count()==1
    assert page.get_by_test_id("team-name").inner_text()=="Fulmini di Raimon United"
    assert page.locator("#home-primary-cta").inner_text()=="Continua run"
    assert page.get_by_test_id("home-metrics").locator(".stat-card").count()==4
    assert page.get_by_test_id("roster-preview").locator(".home-avatar").count()==5
    assert page.locator(".loading-screen,.load-error,.error-screen,[data-testid='visible-error']").count()==0
    assert not page_errors, page_errors; assert not console_errors, console_errors
    overflow=page.evaluate("()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,bodyScrollWidth:document.body.scrollWidth})")
    assert overflow["scrollWidth"]<=overflow["clientWidth"], f"Overflow {width}x{height}: {overflow}"
    name=f"home-active-{width}x{height}.png"; actual=Path(temp)/name; expected=BASELINES/name
    page.screenshot(path=str(actual), full_page=False, animations="disabled", caret="hide")
    if update: BASELINES.mkdir(exist_ok=True); write_baseline(actual, expected, width)
    else: compare(actual, expected, width)
    context.close(); return {"viewport":f"{width}x{height}","file":name,"overflow":overflow}


def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--update",action="store_true"); parser.add_argument("--chromium",default=os.getenv("CHROMIUM_EXECUTABLE","/usr/bin/chromium")); args=parser.parse_args()
    with TemporaryDirectory(prefix="home-active-visual-") as temp, sync_playwright() as p:
        executable=args.chromium if Path(args.chromium).exists() else None
        browser=p.chromium.launch(headless=True,executable_path=executable,args=["--font-render-hinting=none"])
        try: results=[run(browser,html(),w,h,args.update,temp) for w,h in VIEWPORTS]
        finally: browser.close()
    print(json.dumps({"status":"ok","updated":args.update,"results":results},ensure_ascii=False,indent=2))

if __name__=="__main__": main()
