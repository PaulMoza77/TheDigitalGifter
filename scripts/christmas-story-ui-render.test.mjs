/**
 * Focused server-render checks. Bundle TSX first, then use Node's test runner:
 * npx esbuild scripts/christmas-story-ui-render.test.mjs --bundle --platform=node \
 *   --format=cjs --jsx=automatic --outfile=/tmp/christmas-story-ui-render.test.cjs
 * node --test /tmp/christmas-story-ui-render.test.cjs
 * These checks do not replace browser interaction or layout QA.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExampleAudioPlayer } from "../src/features/christmas-story/components/ExampleAudioPlayer.tsx";
import { MemoryFilm } from "../src/features/christmas-story/components/MemoryFilm.tsx";
import { RecipientExperience } from "../src/features/christmas-story/components/RecipientExperience.tsx";
import { DEMO_GIFT } from "../src/features/christmas-story/data/demoGift.ts";

const render = (component, props) => renderToStaticMarkup(createElement(component, props));

test("missing audio has an honest lyrics preview and no play control", () => {
  const html = render(ExampleAudioPlayer, { song: DEMO_GIFT.song });
  assert.match(html, /No recorded song is available/);
  assert.doesNotMatch(html, /<audio|<button|autoplay/i);
  assert.match(html, /Emma, this night belongs to you/);
});

test("real song has native controls and never autoplays or eagerly preloads", () => {
  const html = render(ExampleAudioPlayer, { song: { ...DEMO_GIFT.song, isExample: false, audioUrl: "/test-song.mp3" } });
  assert.match(html, /<audio[^>]*controls=""/);
  assert.match(html, /preload="none"/);
  assert.doesNotMatch(html, /autoplay|Sample lyrics/i);
});

test("failed non-demo song uses an unavailable state", () => {
  const html = render(ExampleAudioPlayer, { song: { ...DEMO_GIFT.song, isExample: false, status: "failed" } });
  assert.match(html, /song is unavailable/);
  assert.doesNotMatch(html, /<audio|Sample lyrics/);
});

test("real film uses inline video controls without autoplay", () => {
  const html = render(MemoryFilm, { film: { ...DEMO_GIFT.film, isExample: false, videoUrl: "/test-film.mp4" } });
  assert.match(html, /<video[^>]*controls=""/);
  assert.match(html, /playsInline=""/);
  assert.match(html, /preload="none"/);
  assert.doesNotMatch(html, /autoplay/i);
});

test("sample frames are labeled and have manual memory controls", () => {
  const html = render(MemoryFilm, { film: DEMO_GIFT.film });
  assert.match(html, /no finished film yet/);
  assert.match(html, /Photo placeholder/);
  assert.match(html, /aria-label="Previous memory"/);
  assert.match(html, /aria-label="Next memory"/);
  assert.doesNotMatch(html, /<video|<img/);
});

test("empty film has a useful empty state, with no broken frame controls", () => {
  const html = render(MemoryFilm, { film: { ...DEMO_GIFT.film, frames: [], isExample: false } });
  assert.match(html, /memory film is not available yet/);
  assert.doesNotMatch(html, /<button|<img/);
});

test("recipient starts with one deliberate opening, no ads, price or media playback", () => {
  const html = render(RecipientExperience, { content: DEMO_GIFT });
  assert.equal((html.match(/<button/g) || []).length, 1);
  assert.match(html, /aria-label="Open your gift"/);
  assert.doesNotMatch(html, /\$57|Create Their Gift|Send reaction|<audio|<video|Continue|Fictional sample/);
});

test("demo is clearly labeled and recipient inputs are escaped", () => {
  const html = render(RecipientExperience, { content: { ...DEMO_GIFT, welcomeTitle: '<script>alert("name")</script>' }, isDemo: true });
  assert.match(html, /Fictional sample gift/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
