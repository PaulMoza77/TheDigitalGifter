#!/usr/bin/env python3
"""Build a 5s living-photo loop from the Christmas cabin still.

Adds snowfall, fireplace/candle flicker, outdoor fire-pit motion, and fairy-light
twinkle. Used when Replicate Seedance is unavailable; output is a seamless-ish
MP4 loop for /christmas.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path("/tmp/cabin-live/base.jpg")
OUT_DIR = Path("/tmp/cabin-live/frames")
FPS = 24
SECONDS = 5
FRAMES = FPS * SECONDS
W, H = 1920, 1080


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def soft_mask(h: int, w: int, y0: float, y1: float, x0: float, x1: float, feather: float = 0.08) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    y = yy / max(h - 1, 1)
    x = xx / max(w - 1, 1)
    my = np.clip((y - y0) / feather, 0, 1) * np.clip((y1 - y) / feather, 0, 1)
    mx = np.clip((x - x0) / feather, 0, 1) * np.clip((x1 - x) / feather, 0, 1)
    return (my * mx).astype(np.float32)


def make_snow(n: int = 420, seed: int = 7) -> list[dict]:
    rng = random.Random(seed)
    flakes = []
    for _ in range(n):
        flakes.append(
            {
                "x": rng.uniform(0.12, 0.72),
                "y": rng.random(),
                "s": rng.uniform(0.006, 0.018),  # speed per frame (normalized)
                "r": rng.uniform(1.6, 4.2),
                "a": rng.uniform(0.45, 1.0),
                "drift": rng.uniform(-0.0035, 0.0035),
                "phase": rng.uniform(0, math.tau),
            }
        )
    return flakes


def draw_snow(frame: np.ndarray, flakes: list[dict], t: int, mask: np.ndarray) -> None:
    h, w = frame.shape[:2]
    for flake in flakes:
        y = (flake["y"] + flake["s"] * t) % 1.2 - 0.1
        x = (flake["x"] + flake["drift"] * t + 0.004 * math.sin(t / 10 + flake["phase"])) % 1.0
        if y < 0 or y > 1:
            continue
        px = int(x * (w - 1))
        py = int(y * (h - 1))
        if mask[py, px] < 0.05:
            continue
        r = int(round(flake["r"]))
        alpha = flake["a"] * float(mask[py, px])
        y0, y1 = max(0, py - r), min(h, py + r + 1)
        x0, x1 = max(0, px - r), min(w, px + r + 1)
        for yy in range(y0, y1):
            for xx in range(x0, x1):
                if (yy - py) ** 2 + (xx - px) ** 2 <= r * r:
                    frame[yy, xx] = (
                        frame[yy, xx].astype(np.float32) * (1 - alpha)
                        + np.array([245, 248, 255], dtype=np.float32) * alpha
                    ).astype(np.uint8)


def fire_glow(frame: np.ndarray, mask: np.ndarray, intensity: float, color: tuple[float, float, float]) -> None:
    glow = np.zeros_like(frame, dtype=np.float32)
    for i, c in enumerate(color):
        glow[:, :, i] = c
    m = mask[..., None] * intensity
    out = frame.astype(np.float32) * (1 - m * 0.35) + glow * (m * 0.85)
    # Extra sparkle noise in the core
    noise = (np.random.rand(*mask.shape).astype(np.float32) - 0.5) * 40.0 * mask * intensity
    out[:, :, 0] = np.clip(out[:, :, 0] + noise * 1.2, 0, 255)
    out[:, :, 1] = np.clip(out[:, :, 1] + noise * 0.55, 0, 255)
    frame[:] = out.astype(np.uint8)


def twinkle_lights(frame: np.ndarray, mask: np.ndarray, t: int, dens: float = 0.0018) -> None:
    h, w = frame.shape[:2]
    # Deterministic-ish sparkles that pulse
    coords = np.argwhere(mask > 0.35)
    if len(coords) == 0:
        return
    n = max(12, int(len(coords) * dens))
    rng = np.random.default_rng(1000 + (t // 2))
    picks = coords[rng.choice(len(coords), size=min(n, len(coords)), replace=False)]
    for py, px in picks:
        pulse = 0.55 + 0.45 * abs(math.sin((t + px + py) * 0.37))
        r = 1 if pulse < 0.85 else 2
        y0, y1 = max(0, py - r), min(h, py + r + 1)
        x0, x1 = max(0, px - r), min(w, px + r + 1)
        color = np.array([255, 230, 160], dtype=np.float32)
        for yy in range(y0, y1):
            for xx in range(x0, x1):
                if (yy - py) ** 2 + (xx - px) ** 2 <= r * r + 0.2:
                    a = pulse * 0.75 * float(mask[py, px])
                    frame[yy, xx] = (
                        frame[yy, xx].astype(np.float32) * (1 - a) + color * a
                    ).astype(np.uint8)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    base = np.array(Image.open(SRC).convert("RGB").resize((W, H), Image.Resampling.LANCZOS))
    snow_mask = soft_mask(H, W, 0.02, 0.62, 0.08, 0.72, feather=0.07)
    # Prefer outdoor glass area: reduce snow over furniture
    snow_mask *= soft_mask(H, W, 0.0, 0.58, 0.12, 0.7, feather=0.1)

    fireplace_mask = soft_mask(H, W, 0.42, 0.78, 0.72, 0.93, feather=0.05)
    firepit_mask = soft_mask(H, W, 0.42, 0.58, 0.40, 0.55, feather=0.04)
    candle_mask = soft_mask(H, W, 0.62, 0.78, 0.38, 0.58, feather=0.04)
    tree_mask = soft_mask(H, W, 0.12, 0.72, 0.58, 0.82, feather=0.06)
    mantel_mask = soft_mask(H, W, 0.28, 0.42, 0.70, 0.95, feather=0.04)

    flakes = make_snow(480)
    np.random.seed(42)

    for t in range(FRAMES):
        frame = base.copy()
        # Fireplace pulse — stronger so flames read as “alive”
        fire_i = 0.7 + 0.55 * (0.5 + 0.5 * math.sin(t * 0.7) * math.sin(t * 0.23 + 0.7))
        fire_i = clamp(fire_i + (random.random() - 0.5) * 0.28, 0.35, 1.25)
        fire_glow(frame, fireplace_mask, fire_i, (255, 128, 36))

        pit_i = 0.55 + 0.5 * abs(math.sin(t * 0.62 + 1.2))
        fire_glow(frame, firepit_mask, pit_i, (255, 140, 48))

        candle_i = 0.45 + 0.45 * abs(math.sin(t * 1.05 + 0.3))
        fire_glow(frame, candle_mask, candle_i, (255, 214, 140))

        twinkle_lights(frame, tree_mask, t, dens=0.0022)
        twinkle_lights(frame, mantel_mask, t, dens=0.0016)
        draw_snow(frame, flakes, t, snow_mask)

        Image.fromarray(frame).save(OUT_DIR / f"frame_{t:04d}.jpg", quality=92, optimize=True)
        if t % 24 == 0:
            print(f"frame {t}/{FRAMES}", flush=True)

    print("frames_done", FRAMES)


if __name__ == "__main__":
    main()
