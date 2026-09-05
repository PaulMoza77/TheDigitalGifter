import { describe, expect, it } from "vitest";
import {
  computeCoverMediaBox,
  giftSafeObjectPositionY,
} from "./useCoverMediaBox";

describe("computeCoverMediaBox", () => {
  it("crops top/bottom when the container is wider than the media", () => {
    const box = computeCoverMediaBox(1920, 800, 16 / 9, 0.5, 0);
    expect(box.width).toBe(1920);
    expect(box.height).toBeCloseTo(1920 / (16 / 9), 5);
    expect(box.left).toBe(0);
    expect(box.top).toBeCloseTo(0, 5);
  });

  it("shifts the media up when object-position Y biases toward the bottom", () => {
    const box = computeCoverMediaBox(1920, 800, 16 / 9, 0.5, 1);
    expect(box.width).toBe(1920);
    expect(box.height).toBeCloseTo(1920 / (16 / 9), 5);
    expect(box.top).toBeCloseTo(800 - box.height, 5);
  });

  it("crops sides when the container is taller than the media", () => {
    const box = computeCoverMediaBox(900, 1200, 16 / 9, 0.5, 0);
    expect(box.height).toBe(1200);
    expect(box.width).toBeCloseTo(1200 * (16 / 9), 5);
    expect(box.left).toBeCloseTo((900 - box.width) / 2, 5);
    expect(box.top).toBe(0);
  });
});

describe("giftSafeObjectPositionY", () => {
  it("stays top-anchored when the full media height fits", () => {
    // Tall/narrow: cover crops sides, full height visible.
    expect(giftSafeObjectPositionY(900, 1200, 16 / 9)).toBe(0);
  });

  it("shifts down on wide short viewports so the gift band stays visible", () => {
    const y = giftSafeObjectPositionY(1920, 875, 16 / 9, 0.94);
    expect(y).toBeGreaterThan(0.4);
    const box = computeCoverMediaBox(1920, 875, 16 / 9, 0.5, y);
    const y0 = -box.top / box.height;
    const y1 = (-box.top + 875) / box.height;
    expect(y0).toBeLessThan(0.72);
    expect(y1).toBeGreaterThanOrEqual(0.94);
  });

  it("keeps gifts in view on extreme ultrawide crops", () => {
    const y = giftSafeObjectPositionY(2560, 900, 16 / 9, 0.94);
    const box = computeCoverMediaBox(2560, 900, 16 / 9, 0.5, y);
    const y1 = (-box.top + 900) / box.height;
    expect(y1).toBeGreaterThanOrEqual(0.94);
  });
});
