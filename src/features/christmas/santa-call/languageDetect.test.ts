import { describe, expect, it } from "vitest";
import {
  detectLanguageHeuristic,
  detectLanguageSwitch,
  normalizeLanguageHint,
} from "./languageDetect";

describe("Santa language detection prototype", () => {
  it("normalizes locale hints", () => {
    expect(normalizeLanguageHint("ro-RO")).toBe("ro");
    expect(normalizeLanguageHint("DE")).toBe("de");
    expect(normalizeLanguageHint("zh")).toBe(null);
  });

  it("detects RO EN DE FR ES IT AR samples", () => {
    expect(detectLanguageHeuristic("Bună Andrei, îmi doresc o bicicletă de Crăciun").language).toBe("ro");
    expect(detectLanguageHeuristic("Hello Andrei, I want a red bicycle for Christmas").language).toBe("en");
    expect(detectLanguageHeuristic("Hallo Andrei, ich wünsche mir ein Fahrrad zu Weihnachten").language).toBe(
      "de",
    );
    expect(detectLanguageHeuristic("Bonjour Andrei, je souhaite un vélo pour Noël").language).toBe("fr");
    expect(detectLanguageHeuristic("Hola Andrei, quiero una bicicleta para Navidad").language).toBe("es");
    expect(detectLanguageHeuristic("Ciao Andrei, voglio una bicicletta per Natale").language).toBe("it");
    expect(detectLanguageHeuristic("مرحبا أندري أريد دراجة").language).toBe("ar");
  });

  it("ignores weak mid-call switches", () => {
    const keep = detectLanguageSwitch("ok", "ro");
    expect(keep.language).toBe("ro");
    expect(keep.notes).toMatch(/weak_switch|unchanged|low_signal/);
  });

  it("allows strong mid-call switch", () => {
    const sw = detectLanguageSwitch("Hello Andrei, can we speak English now please?", "ro");
    expect(sw.language).toBe("en");
    expect(sw.notes).toBe("switched");
  });
});
