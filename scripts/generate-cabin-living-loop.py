#!/usr/bin/env python3
"""Build a seamless 5s photoreal-ish living loop from the Christmas cabin still.

Camera stays fixed. Animates: outdoor snowfall, fireplace + fire-pit flames,
candle flicker, fairy-light twinkle, rising embers. Used when Seedance/Replicate
is unavailable.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = Path("/tmp/cabin-live/base.jpg")
OUT_DIR = Path("/tmp/cabin-live/frames")
FPS = 24
SECONDS = 5
FRAMES = FPS * SECONDS
W, H = 1920, 1080


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def soft_mask(h: int, w: int, y0: float, y1: float, x0: float, x1: float, feather: float = 0.06) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    y = yy / max(h - 1, 1)
    x = xx / max(w - 1, 1)
    my = np.clip((y - y0) / feather, 0, 1) * np.clip((y1 - y) / feather, 0, 1)
    mx = np.clip((x - x0) / feather, 0, 1) * np.clip((x1 - x) / feather, 0, 1)
    return (my * mx).astype(np.float32)


def outdoor_window_mask(h: int, w: int) -> np.ndarray:
    """Snow only through the glass panes — not over sofa / tree / fireplace."""
    m = soft_mask(h, w, 0.02, 0.58, 0.07, 0.68, feather=0.035)
    # Knock out heavy interior furniture intrusion at bottom of glass
    m *= 1.0 - soft_mask(h, w, 0.48, 0.72, 0.08, 0.38, feather=0.05) * 0.85
    # Soften near right tree edge so flakes don't sit on needles
    m *= 1.0 - soft_mask(h, w, 0.10, 0.70, 0.58, 0.78, feather=0.06) * 0.55
    return np.clip(m, 0, 1)


def warm_light_points(base: np.ndarray, region: np.ndarray, thresh: float = 210.0, max_n: int = 180) -> np.ndarray:
    """Pick bright warm pixels (fairy lights) inside a region mask."""
    r, g, b = base[:, :, 0].astype(np.float32), base[:, :, 1].astype(np.float32), base[:, :, 2].astype(np.float32)
    warm = (r > thresh) & (g > thresh * 0.72) & (b < r * 0.92) & (region > 0.4)
    ys, xs = np.where(warm)
    if len(ys) == 0:
        return np.empty((0, 2), dtype=np.int32)
    # Subsample evenly
    step = max(1, len(ys) // max_n)
    idx = np.arange(0, len(ys), step)[:max_n]
    return np.stack([ys[idx], xs[idx]], axis=1).astype(np.int32)


def make_snow_layers() -> list[list[dict]]:
    """Three depth layers for parallax / scale — dense enough to survive H.264."""
    layers = []
    specs = [
        # far: many tiny slow flakes
        {"n": 780, "r": (1.2, 2.4), "s": (0.0045, 0.009), "a": (0.55, 0.9), "seed": 11},
        # mid
        {"n": 420, "r": (2.2, 4.0), "s": (0.007, 0.014), "a": (0.65, 0.98), "seed": 29},
        # near: fewer larger soft flakes
        {"n": 140, "r": (3.5, 7.0), "s": (0.011, 0.019), "a": (0.7, 1.0), "seed": 47},
    ]
    for spec in specs:
        rng = random.Random(spec["seed"])
        flakes = []
        for _ in range(spec["n"]):
            flakes.append(
                {
                    "x": rng.uniform(0.05, 0.72),
                    "y": rng.random(),
                    "s": rng.uniform(*spec["s"]),
                    "r": rng.uniform(*spec["r"]),
                    "a": rng.uniform(*spec["a"]),
                    "drift": rng.uniform(-0.0028, 0.0028),
                    "phase": rng.uniform(0, math.tau),
                }
            )
        layers.append(flakes)
    return layers


def draw_snow(frame: np.ndarray, layers: list[list[dict]], t: int, mask: np.ndarray) -> None:
    h, w = frame.shape[:2]
    period = FRAMES
    for flakes in layers:
        for flake in flakes:
            # Seamless loop: wrap over exact period
            y = (flake["y"] + flake["s"] * t) % 1.15 - 0.08
            x = (
                flake["x"]
                + flake["drift"] * t
                + 0.006 * math.sin((t / period) * math.tau + flake["phase"])
            ) % 1.0
            if y < 0 or y > 1:
                continue
            px = int(x * (w - 1))
            py = int(y * (h - 1))
            if mask[py, px] < 0.08:
                continue
            r = max(1, int(round(flake["r"])))
            alpha = flake["a"] * float(mask[py, px])
            # Soft disk
            y0, y1 = max(0, py - r - 1), min(h, py + r + 2)
            x0, x1 = max(0, px - r - 1), min(w, px + r + 2)
            yy, xx = np.mgrid[y0:y1, x0:x1]
            dist = np.sqrt((yy - py) ** 2 + (xx - px) ** 2)
            fall = np.clip(1.0 - dist / (r + 0.35), 0, 1).astype(np.float32)
            a = fall * alpha
            if a.max() <= 0:
                continue
            patch = frame[y0:y1, x0:x1].astype(np.float32)
            color = np.array([255, 255, 255], dtype=np.float32)
            aa = np.clip(a * 1.15, 0, 1)[..., None]
            frame[y0:y1, x0:x1] = (patch * (1 - aa) + color * aa).astype(np.uint8)


def flame_field(
    h: int,
    w: int,
    cx: float,
    cy: float,
    bw: float,
    bh: float,
    t: float,
    tongues: int = 7,
    seed: int = 0,
) -> np.ndarray:
    """Procedural flame intensity field (0..1) centered at normalized cx,cy."""
    yy, xx = np.mgrid[0:h, 0:w]
    x = xx / max(w - 1, 1)
    y = yy / max(h - 1, 1)
    field = np.zeros((h, w), dtype=np.float32)
    rng = random.Random(seed)
    for i in range(tongues):
        phase = rng.uniform(0, math.tau)
        ox = cx + rng.uniform(-bw * 0.35, bw * 0.35)
        # Wobble horizontally with time (loop-friendly)
        wobble = 0.012 * math.sin(t * math.tau + phase + i) + 0.008 * math.sin(t * math.tau * 2.0 + i * 1.7)
        ox_t = ox + wobble
        # Vertical stretch pulse
        stretch = 1.0 + 0.22 * math.sin(t * math.tau * 1.5 + phase)
        dx = (x - ox_t) / max(bw * (0.55 + 0.12 * math.sin(phase + t * math.tau)), 1e-4)
        dy = (y - cy) / max(bh * stretch, 1e-4)
        # Flame shape: pointed upward (negative dy stronger)
        tip = np.exp(-((dx * 1.15) ** 2) - np.maximum(dy, -0.15) ** 2 * 2.4)
        tip *= np.clip(1.2 - dy * 1.6, 0, 1.3)
        # Turbulence
        turb = 0.55 + 0.45 * np.sin((x * 40 + y * 55 + t * 12 + i) * 0.7 + phase)
        field = np.maximum(field, (tip * turb).astype(np.float32))
    return np.clip(field, 0, 1)


def composite_fire(
    frame: np.ndarray,
    intensity: np.ndarray,
    strength: float,
    core: tuple[float, float, float] = (255, 230, 140),
    mid: tuple[float, float, float] = (255, 120, 28),
    outer: tuple[float, float, float] = (255, 60, 10),
) -> None:
    m = intensity * strength
    if m.max() <= 0.01:
        return
    f = frame.astype(np.float32)
    # Color ramp by intensity
    c0 = np.array(outer, dtype=np.float32)
    c1 = np.array(mid, dtype=np.float32)
    c2 = np.array(core, dtype=np.float32)
    ramp = m[..., None]
    color = np.where(ramp < 0.45, c0 + (c1 - c0) * (ramp / 0.45), c1 + (c2 - c1) * ((ramp - 0.45) / 0.55))
    a = np.clip(m * 0.92, 0, 0.92)[..., None]
    # Soft additive glow
    out = f * (1 - a * 0.55) + color * a
    glow = np.clip(m * 0.35, 0, 1)[..., None] * np.array([255, 90, 20], dtype=np.float32)
    out = np.clip(out + glow * 0.25, 0, 255)
    frame[:] = out.astype(np.uint8)


def rising_embers(frame: np.ndarray, mask: np.ndarray, t: int, n: int = 28, seed: int = 3) -> None:
    h, w = frame.shape[:2]
    rng = random.Random(seed)
    coords = np.argwhere(mask > 0.25)
    if len(coords) == 0:
        return
    for i in range(n):
        base = coords[rng.randrange(len(coords))]
        life = ((t * 0.7 + i * 7) % FRAMES) / FRAMES
        py = int(base[0] - life * h * 0.12)
        px = int(base[1] + 6 * math.sin(life * math.tau * 2 + i))
        if py < 0 or py >= h or px < 0 or px >= w:
            continue
        if mask[min(h - 1, max(0, py)), px] < 0.05 and life < 0.15:
            continue
        a = (1.0 - life) * 0.85
        r = 1 if life > 0.55 else 2
        y0, y1 = max(0, py - r), min(h, py + r + 1)
        x0, x1 = max(0, px - r), min(w, px + r + 1)
        color = np.array([255, 180 + int(40 * (1 - life)), 60], dtype=np.float32)
        for yy in range(y0, y1):
            for xx in range(x0, x1):
                if (yy - py) ** 2 + (xx - px) ** 2 <= r * r + 0.25:
                    frame[yy, xx] = (frame[yy, xx].astype(np.float32) * (1 - a) + color * a).astype(np.uint8)


def draw_candle_flames(frame: np.ndarray, centers: list[tuple[float, float]], t: float) -> None:
    """Small dancing candle flames at normalized centers."""
    h, w = frame.shape[:2]
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for i, (cx, cy) in enumerate(centers):
        px, py = cx * (w - 1), cy * (h - 1)
        sway = 1.8 * math.sin(t * math.tau * 2.2 + i * 1.4)
        stretch = 1.0 + 0.18 * math.sin(t * math.tau * 3.1 + i)
        # Outer glow
        gw, gh = 12, 18 * stretch
        draw.ellipse(
            [px - gw + sway, py - gh, px + gw + sway, py + gh * 0.35],
            fill=(255, 150, 40, 110),
        )
        # Core
        cw, ch = 3.8, 10.0 * stretch
        draw.ellipse(
            [px - cw + sway * 0.6, py - ch, px + cw + sway * 0.6, py + ch * 0.25],
            fill=(255, 240, 180, 240),
        )
        # Tip white
        draw.ellipse(
            [px - 1.6 + sway * 0.5, py - ch * 1.05, px + 1.6 + sway * 0.5, py - ch * 0.55],
            fill=(255, 255, 245, 220),
        )
    blurred = overlay.filter(ImageFilter.GaussianBlur(radius=1.2))
    base = Image.fromarray(frame).convert("RGBA")
    composed = Image.alpha_composite(base, blurred)
    frame[:] = np.array(composed.convert("RGB"))


def twinkle_points(frame: np.ndarray, points: np.ndarray, t: int) -> None:
    if len(points) == 0:
        return
    h, w = frame.shape[:2]
    for py, px in points:
        # Per-light phase so they don't blink in unison
        phase = ((px * 17 + py * 31) % 360) / 360.0
        pulse = 0.55 + 0.45 * abs(math.sin((t / FRAMES) * math.tau * 2 + phase * math.tau))
        # Occasional sharper twinkle
        if ((px + py + t) % 37) == 0:
            pulse = min(1.35, pulse + 0.45)
        r = 1 if pulse < 0.95 else 2
        y0, y1 = max(0, py - r), min(h, py + r + 1)
        x0, x1 = max(0, px - r), min(w, px + r + 1)
        color = np.array([255, 236, 175], dtype=np.float32)
        a = clamp(pulse * 0.7, 0, 0.85)
        for yy in range(y0, y1):
            for xx in range(x0, x1):
                if (yy - py) ** 2 + (xx - px) ** 2 <= r * r + 0.2:
                    frame[yy, xx] = (frame[yy, xx].astype(np.float32) * (1 - a) + color * a).astype(np.uint8)


def ambient_fire_bounce(frame: np.ndarray, mask: np.ndarray, amount: float) -> None:
    """Subtle warm bounce light on nearby stone/sofa from fireplace pulse."""
    if amount <= 0:
        return
    f = frame.astype(np.float32)
    warm = np.array([255, 120, 40], dtype=np.float32)
    a = (mask * amount * 0.12)[..., None]
    frame[:] = np.clip(f * (1 - a * 0.25) + warm * a, 0, 255).astype(np.uint8)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    base_img = Image.open(SRC).convert("RGB").resize((W, H), Image.Resampling.LANCZOS)
    base = np.array(base_img)

    snow_mask = outdoor_window_mask(H, W)
    fireplace_gate = soft_mask(H, W, 0.48, 0.78, 0.75, 0.93, feather=0.03)
    firepit_gate = soft_mask(H, W, 0.36, 0.52, 0.42, 0.52, feather=0.025)
    hearth_bounce = soft_mask(H, W, 0.50, 0.88, 0.68, 0.98, feather=0.08)
    tree_region = soft_mask(H, W, 0.10, 0.72, 0.56, 0.80, feather=0.05)
    mantel_region = soft_mask(H, W, 0.26, 0.42, 0.70, 0.96, feather=0.04)

    tree_lights = warm_light_points(base, tree_region, thresh=205, max_n=260)
    mantel_lights = warm_light_points(base, mantel_region, thresh=200, max_n=100)
    print(f"lights tree={len(tree_lights)} mantel={len(mantel_lights)}", flush=True)

    snow_layers = make_snow_layers()
    # Lantern flame tips (normalized) from bright-pixel clustering
    candle_centers = [
        (0.495, 0.655),
        (0.522, 0.662),
        (0.546, 0.658),
        # mantel lanterns
        (0.78, 0.345),
        (0.825, 0.338),
        (0.87, 0.340),
    ]

    for t in range(FRAMES):
        frame = base.copy()
        tn = t / FRAMES  # 0..1 loop phase

        # --- Fireplace flames (hearth mouth, not mantel) ---
        fire = flame_field(H, W, 0.83, 0.655, 0.06, 0.13, tn, tongues=9, seed=2)
        fire *= fireplace_gate
        fire_strength = 1.05 + 0.32 * math.sin(tn * math.tau * 3) * math.sin(tn * math.tau + 0.4)
        composite_fire(frame, fire, clamp(fire_strength, 0.8, 1.35))
        rising_embers(frame, fireplace_gate * fire, t, n=40, seed=5)
        ambient_fire_bounce(frame, hearth_bounce, 0.65 + 0.45 * abs(math.sin(tn * math.tau * 3)))

        # --- Outdoor fire pit ---
        pit = flame_field(H, W, 0.466, 0.425, 0.032, 0.055, tn + 0.17, tongues=7, seed=9)
        pit *= firepit_gate
        pit_strength = 0.95 + 0.35 * abs(math.sin(tn * math.tau * 2.5 + 1.1))
        composite_fire(frame, pit, pit_strength, core=(255, 220, 120), mid=(255, 130, 35), outer=(255, 70, 15))
        rising_embers(frame, firepit_gate * pit, t, n=16, seed=11)

        # --- Candles ---
        draw_candle_flames(frame, candle_centers, tn)

        # --- Fairy lights ---
        twinkle_points(frame, tree_lights, t)
        twinkle_points(frame, mantel_lights, t)

        # --- Snow outside ---
        draw_snow(frame, snow_layers, t, snow_mask)

        Image.fromarray(frame).save(OUT_DIR / f"frame_{t:04d}.jpg", quality=93, optimize=True)
        if t % 12 == 0:
            print(f"frame {t}/{FRAMES}", flush=True)

    print("frames_done", FRAMES)


if __name__ == "__main__":
    main()
