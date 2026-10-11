import { describe, expect, it } from "vitest";
import {
  kling3ProVideoRequest,
  soulV2ImageRequest,
} from "../../../supabase/functions/_shared/christmas/higgsfieldProviders";

describe("christmas-v2 higgsfield provider payloads", () => {
  it("builds Soul v2 image-to-image request with official model id", () => {
    const request = soulV2ImageRequest({
      prompt: "Christmas portrait",
      imageUrl: "https://example.com/source.jpg",
      aspectRatio: "3:4",
    });
    expect(request.model).toBe("higgsfield-ai/soul/v2/image-to-image");
    expect(request.path).toBe("/higgsfield-ai/soul/v2/image-to-image");
    expect(request.body).toMatchObject({
      prompt: "Christmas portrait",
      image_url: "https://example.com/source.jpg",
      aspect_ratio: "3:4",
      resolution: "1080p",
      batch_size: 1,
    });
  });

  it("builds Kling 3 Pro image-to-video request with official model id", () => {
    const request = kling3ProVideoRequest({
      prompt: "Gentle Christmas motion",
      imageUrl: "https://example.com/scene.jpg",
      duration: 5,
    });
    expect(request.model).toBe("kling-video/v3.0/pro/image-to-video");
    expect(request.path).toBe("/kling-video/v3.0/pro/image-to-video");
    expect(request.body).toMatchObject({
      image_url: "https://example.com/scene.jpg",
      prompt: "Gentle Christmas motion",
      duration: 5,
      sound: "off",
    });
  });
});
