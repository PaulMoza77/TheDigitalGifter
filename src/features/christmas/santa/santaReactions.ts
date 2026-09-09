/**
 * Lightweight Santa reaction copy — text only, no generation cost.
 * Never send these personal values to analytics.
 */

export function santaGreetingCaption(name: string | null | undefined): string {
  const n = (name || "").trim();
  if (!n) return "Ho ho ho! Let’s make something magical this Christmas.";
  return `Ho ho ho, ${n}! Let’s make something magical for you this Christmas!`;
}

export function santaReactionForDraft(input: {
  step: string;
  childFirstName: string;
  age: string;
  somethingGood: string;
  hobbyOrInterest: string;
  christmasWish: string;
  senderName: string;
}): string {
  const name = input.childFirstName.trim() || "friend";
  const ageNum = Number(input.age);

  if (input.step === "age" && input.age && Number.isFinite(ageNum)) {
    const word =
      ageNum === 7
        ? "Seven"
        : ageNum === 8
          ? "Eight"
          : ageNum === 5
            ? "Five"
            : ageNum === 6
              ? "Six"
              : String(ageNum);
    return `${word} years old — a very important Christmas for ${name}!`;
  }

  if (input.step === "achievement" && input.somethingGood.trim()) {
    const deed = input.somethingGood.trim();
    if (/bike|bicycle|ride/i.test(deed)) {
      return `Learning to ride a bike? The elves will be impressed.`;
    }
    if (/school|learn/i.test(deed)) {
      return `The workshop elves love hearing that about ${name}.`;
    }
    if (/kind|help|brave/i.test(deed)) {
      return `Kindness like that belongs on the Nice List.`;
    }
    return `I’ll remember that about ${name}.`;
  }

  if (input.step === "interest" && input.hobbyOrInterest.trim()) {
    const hobby = input.hobbyOrInterest.trim();
    if (/lego/i.test(hobby)) return `LEGO! The elves keep a special shelf for that.`;
    if (/football|soccer|sport/i.test(hobby)) return `A sporty Christmas for ${name} — noted!`;
    if (/dino/i.test(hobby)) return `Dinosaurs? My favorite workshop stories…`;
    if (/draw|art|music/i.test(hobby)) return `A creative heart — Santa loves that.`;
    return `${hobby}… I’ll mention that with a smile.`;
  }

  if (input.step === "wish" && input.christmasWish.trim()) {
    const wish = input.christmasWish.trim();
    if (/bike|bicycle/i.test(wish)) return `A bicycle… I’ll talk to the workshop.`;
    return `${wish}… I’ll talk to the workshop.`;
  }

  if (input.step === "sender" && input.senderName.trim()) {
    return `From ${input.senderName.trim()} — with Christmas love.`;
  }

  return santaGreetingCaption(name);
}
