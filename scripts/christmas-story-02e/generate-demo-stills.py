#!/usr/bin/env python3
"""
Generate first-party illustrated Christmas stills for the fictional Emma demo.
These are original Digital Gifter artwork — not customer photos and not stock faces.
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parents[2] / "public" / "assets" / "christmas-story-demo" / "stills"
ART = Path(__file__).resolve().parents[2] / "artifacts" / "christmas-story-02e" / "stills"
W, H = 1600, 900


def font(size: int):
    for p in (
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
    ):
        try:
            return ImageFont.truetype(p, size=size)
        except Exception:
            pass
    return ImageFont.load_default()


def grad(w, h, top, bottom, horizontal=False):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = x / (w - 1) if horizontal else y / (h - 1)
            r = int(top[0] + (bottom[0] - top[0]) * t)
            g = int(top[1] + (bottom[1] - top[1]) * t)
            b = int(top[2] + (bottom[2] - top[2]) * t)
            px[x, y] = (r, g, b)
    return img


def soft_disk(draw, cx, cy, r, color, steps=12):
    for i in range(steps, 0, -1):
        a = int(40 + 180 * (i / steps))
        rr = int(r * i / steps)
        c = (*color, min(255, a))
        draw.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=c)


def vignette(img: Image.Image, strength=0.55):
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    cx, cy = img.width // 2, img.height // 2
    max_r = int(math.hypot(cx, cy))
    for i in range(28, 0, -1):
        alpha = int(strength * 255 * ((28 - i) / 28) ** 1.6)
        r = int(max_r * i / 28)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(10, 6, 4, alpha))
    base = img.convert("RGBA")
    return Image.alpha_composite(base, overlay).convert("RGB")


def scene_kitchen_morning():
    img = grad(W, H, (255, 214, 170), (120, 78, 48))
    d = ImageDraw.Draw(img, "RGBA")
    # window frame
    d.rectangle((180, 90, 780, 640), fill=(245, 236, 220, 255))
    d.rectangle((210, 120, 750, 610), fill=(190, 220, 245, 255))
    # soft outdoor snow
    for _ in range(80):
        x, y = random.randint(220, 740), random.randint(130, 600)
        r = random.randint(1, 3)
        d.ellipse((x, y, x + r, y + r), fill=(255, 255, 255, 160))
    # mullions
    d.rectangle((470, 120, 490, 610), fill=(210, 190, 160, 255))
    d.rectangle((210, 350, 750, 370), fill=(210, 190, 160, 255))
    # table
    d.polygon([(80, 700), (980, 700), (1100, 900), (-40, 900)], fill=(92, 58, 36, 255))
    # mug
    d.rounded_rectangle((980, 540, 1120, 700), radius=18, fill=(240, 232, 220, 255))
    d.ellipse((990, 520, 1110, 560), fill=(255, 248, 235, 255))
    # steam
    for i, x in enumerate((1030, 1055, 1080)):
        d.arc((x - 10, 430 + i * 8, x + 18, 520 + i * 8), 200, 340, fill=(255, 255, 255, 90), width=3)
    # plant
    d.ellipse((1280, 520, 1480, 720), fill=(50, 90, 60, 255))
    d.rectangle((1360, 700, 1400, 860), fill=(90, 60, 40, 255))
    return vignette(img.filter(ImageFilter.GaussianBlur(0.4)))


def scene_snow_street():
    img = grad(W, H, (28, 36, 58), (12, 14, 22))
    d = ImageDraw.Draw(img, "RGBA")
    # snow ground
    d.polygon([(0, 620), (1600, 580), (1600, 900), (0, 900)], fill=(220, 228, 240, 255))
    # distant trees
    for x in range(40, 1560, 90):
        h = random.randint(120, 260)
        d.polygon([(x, 620 - h), (x - 40, 620), (x + 40, 620)], fill=(20, 34, 28, 220))
    # warm street lamps
    for cx in (320, 800, 1280):
        soft_disk(d, cx, 360, 90, (255, 190, 100))
        d.rectangle((cx - 6, 360, cx + 6, 640), fill=(40, 34, 28, 255))
        d.ellipse((cx - 18, 330, cx + 18, 370), fill=(255, 210, 130, 255))
    # falling snow
    rnd = random.Random(7)
    for _ in range(220):
        x, y = rnd.randint(0, W), rnd.randint(0, H)
        r = rnd.randint(1, 3)
        d.ellipse((x, y, x + r, y + r), fill=(255, 255, 255, 140))
    return vignette(img)


def scene_tree_bokeh():
    img = grad(W, H, (18, 28, 20), (8, 12, 10))
    d = ImageDraw.Draw(img, "RGBA")
    # tree body
    d.polygon([(800, 40), (260, 820), (1340, 820)], fill=(24, 58, 36, 255))
    d.polygon([(800, 120), (380, 820), (1220, 820)], fill=(32, 78, 48, 255))
    # ornaments + bokeh
    rnd = random.Random(11)
    colors = [(190, 40, 40), (212, 175, 90), (240, 240, 235), (70, 110, 180)]
    for _ in range(70):
        x, y = rnd.randint(360, 1240), rnd.randint(140, 780)
        r = rnd.randint(8, 28)
        soft_disk(d, x, y, r, colors[rnd.randint(0, 3)])
    # soft foreground bokeh
    for _ in range(40):
        x, y = rnd.randint(0, W), rnd.randint(0, H)
        soft_disk(d, x, y, rnd.randint(20, 55), (255, 200, 120))
    return vignette(img.filter(ImageFilter.GaussianBlur(0.6)))


def scene_gifts():
    img = grad(W, H, (46, 28, 22), (18, 12, 10))
    d = ImageDraw.Draw(img, "RGBA")
    # rug
    d.ellipse((120, 520, 1480, 860), fill=(70, 34, 28, 255))
    boxes = [
        ((420, 470, 760, 720), (140, 36, 36), (212, 175, 90)),
        ((720, 500, 1080, 760), (36, 70, 48), (220, 210, 190)),
        ((980, 430, 1280, 680), (40, 48, 90), (190, 150, 80)),
        ((280, 560, 520, 780), (90, 58, 40), (230, 210, 170)),
    ]
    for (box, fill, ribbon) in boxes:
        d.rounded_rectangle(box, radius=10, fill=(*fill, 255))
        mx = (box[0] + box[2]) // 2
        my = (box[1] + box[3]) // 2
        d.rectangle((mx - 12, box[1], mx + 12, box[3]), fill=(*ribbon, 255))
        d.rectangle((box[0], my - 12, box[2], my + 12), fill=(*ribbon, 255))
    # tree trunk hint
    d.rectangle((760, 180, 840, 470), fill=(70, 48, 30, 255))
    soft_disk(d, 800, 160, 120, (255, 180, 90))
    return vignette(img)


def scene_cocoa():
    img = grad(W, H, (60, 36, 24), (24, 14, 10))
    d = ImageDraw.Draw(img, "RGBA")
    # table wood grain-ish bands
    for i in range(0, H, 28):
        d.rectangle((0, i, W, i + 10), fill=(70, 42, 28, 40))
    # book
    d.rounded_rectangle((220, 360, 720, 780), radius=8, fill=(120, 48, 40, 255))
    d.rounded_rectangle((250, 390, 690, 750), radius=4, fill=(245, 236, 220, 255))
    # cocoa
    d.ellipse((920, 380, 1280, 720), fill=(48, 28, 18, 255))
    d.ellipse((960, 410, 1240, 560), fill=(90, 52, 28, 255))
    soft_disk(d, 1100, 480, 70, (255, 210, 150))
    # candle
    d.rectangle((1380, 420, 1440, 700), fill=(245, 236, 210, 255))
    soft_disk(d, 1410, 390, 55, (255, 180, 80))
    d.polygon([(1410, 330), (1390, 400), (1430, 400)], fill=(255, 200, 100, 220))
    # holly
    d.ellipse((180, 620, 280, 700), fill=(30, 90, 45, 255))
    d.ellipse((240, 640, 320, 720), fill=(40, 110, 55, 255))
    d.ellipse((230, 690, 250, 710), fill=(170, 30, 30, 255))
    return vignette(img)


def scene_fireplace():
    img = grad(W, H, (32, 22, 18), (12, 8, 6))
    d = ImageDraw.Draw(img, "RGBA")
    # mantel
    d.rectangle((260, 180, 1340, 240), fill=(90, 62, 42, 255))
    # opening
    d.rounded_rectangle((420, 260, 1180, 780), radius=20, fill=(20, 12, 8, 255))
    # fire glow
    soft_disk(d, 800, 620, 220, (255, 120, 40))
    soft_disk(d, 760, 580, 90, (255, 200, 80))
    soft_disk(d, 860, 600, 70, (255, 160, 50))
    # stockings
    for x in (500, 700, 900, 1100):
        d.polygon([(x, 240), (x + 70, 240), (x + 55, 360), (x + 15, 360)], fill=(140, 30, 35, 255))
    # garland
    for x in range(280, 1320, 40):
        d.ellipse((x, 150, x + 36, 190), fill=(30, 80, 40, 255))
        if x % 80 == 0:
            d.ellipse((x + 10, 170, x + 22, 182), fill=(180, 30, 30, 255))
    return vignette(img)


def scene_train_window():
    img = grad(W, H, (40, 48, 70), (18, 22, 34))
    d = ImageDraw.Draw(img, "RGBA")
    # window
    d.rounded_rectangle((160, 80, 1440, 820), radius=24, fill=(210, 220, 235, 255))
    # dusk landscape bands
    d.rectangle((180, 420, 1420, 800), fill=(70, 88, 70, 255))
    d.rectangle((180, 560, 1420, 800), fill=(50, 62, 50, 255))
    # golden city lights
    rnd = random.Random(3)
    for _ in range(120):
        x, y = rnd.randint(200, 1400), rnd.randint(430, 540)
        soft_disk(d, x, y, rnd.randint(3, 8), (255, 200, 110))
    # window reflection warmth
    soft_disk(d, 500, 250, 160, (255, 190, 120))
    # frame
    d.rectangle((160, 80, 1440, 110), fill=(50, 36, 26, 255))
    d.rectangle((160, 790, 1440, 820), fill=(50, 36, 26, 255))
    d.rectangle((780, 80, 820, 820), fill=(50, 36, 26, 200))
    return vignette(img)


def scene_letter():
    img = grad(W, H, (48, 34, 26), (22, 14, 10))
    d = ImageDraw.Draw(img, "RGBA")
    # paper
    d.rounded_rectangle((360, 120, 1240, 820), radius=6, fill=(245, 236, 214, 255))
    # lines of “handwriting”
    f = font(34)
    lines = [
        "Emma —",
        "",
        "For every quiet morning,",
        "every train ride home,",
        "every promise we kept.",
        "",
        "This winter is ours.",
        "",
        "Always, Jordan",
    ]
    y = 200
    for line in lines:
        d.text((440, y), line, font=f, fill=(70, 48, 34, 255))
        y += 58
    # holly corner
    d.ellipse((1080, 160, 1180, 240), fill=(30, 90, 45, 255))
    d.ellipse((1140, 180, 1220, 250), fill=(40, 110, 55, 255))
    d.ellipse((1145, 230, 1170, 255), fill=(170, 30, 30, 255))
    soft_disk(d, 520, 700, 90, (255, 200, 120))
    return vignette(img)


SCENES = [
    ("01-kitchen-morning.jpg", "Morning light", scene_kitchen_morning),
    ("02-snow-street.jpg", "Winter walk", scene_snow_street),
    ("03-tree-bokeh.jpg", "The tree", scene_tree_bokeh),
    ("04-gifts.jpg", "Waiting gifts", scene_gifts),
    ("05-cocoa.jpg", "Quiet evenings", scene_cocoa),
    ("06-fireplace.jpg", "By the fire", scene_fireplace),
    ("07-train-window.jpg", "Homeward", scene_train_window),
    ("08-letter.jpg", "A promise kept", scene_letter),
]


def main():
    random.seed(42)
    OUT.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    manifest = []
    for name, caption, fn in SCENES:
        img = fn()
        path = OUT / name
        img.save(path, "JPEG", quality=92, optimize=True)
        img.resize((480, 270)).save(ART / name, "JPEG", quality=85)
        manifest.append(
            {
                "file": f"/assets/christmas-story-demo/stills/{name}",
                "caption": caption,
                "provenance": "first_party_illustrated_original",
                "license": "Digital Gifter original artwork for fictional demo only",
                "contains_real_people": False,
                "photographic": False,
            }
        )
        print("wrote", path, path.stat().st_size)
    man = {
        "kind": "fictional_illustrated_demo_stills",
        "note": "Original illustrated scenes — not customer photographs. Premium visual sample while licensed photo packs are imported.",
        "stills": manifest,
    }
    (OUT / "MANIFEST.json").write_text(json.dumps(man, indent=2) + "\n")
    (ART / "MANIFEST.json").write_text(json.dumps(man, indent=2) + "\n")
    print("done", len(manifest))


if __name__ == "__main__":
    main()
