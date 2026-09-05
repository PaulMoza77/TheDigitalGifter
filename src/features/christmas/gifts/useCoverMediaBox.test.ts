import { describe, expect, it } from "vitest";
import { computeCoverMediaBox } from "./useCoverMediaBox";

describe("computeCoverMediaBox", () => {
  it("crops sides when the container is wider than the media", () => {
    const box = computeCoverMediaBox(1920, 800, 16 / 9, 0.5, 0);
    expect(box.height).toBe(800);
    expect(box.width).toBeCloseTo(800 * (16 / 9), 5);
    expect(box.left).toBeCloseTo((1920 - box.width) / 2, 5);
    expect(box.top).toBe(0);
  });

  it("crops bottom when the container is taller and object-position is top", () => {
    const box = computeCoverMediaBox(900, 1200, 16 / 9, 0.5, 0);
    expect(box.width).toBe(900);
    expect(box.height).toBeCloseTo(900 / (16 / 9), 5);
    expect(box.left).toBe(0);
    expect(box.top).toBe(0);
  });
});
