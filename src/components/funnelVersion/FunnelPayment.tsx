import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SignInButton } from "@/components/SignInButton";
import { useLoggedInUserQuery, useCheckoutMutation } from "@/data";
import { handleCheckout } from "@/lib/checkoutHandler";

// Canvas Preview Page — TheDigitalGifter
// Style inspiration: AliveMoment summary/pricing pages
// Key rules: NO subscriptions, ONE-TIME credit packs, NO % discount, use Bonus Credits

function formatMMSS(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMSSFull(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const packs = [
  {
    id: "starter",
    name: "Starter",
    price: "€4.98",
    credits: 100,
    bonus: 10,
    helper: "Perfect to try",
    popular: false,
  },
  {
    id: "creator",
    name: "Creator",
    price: "€9.98",
    credits: 250,
    bonus: 50,
    helper: "Best value",
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "€78.98",
    credits: 4000,
    bonus: 600,
    helper: "For power users",
    popular: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "€499.98",
    credits: 50000,
    bonus: 10000,
    helper: "Teams & agencies",
    popular: false,
  },
] as const;

type PackId = (typeof packs)[number]["id"];

export default function Index() {
  const [selected, setSelected] = useState<PackId>("creator");
  const [secondsLeft, setSecondsLeft] = useState<number>(29 * 60 + 46);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const selectedPack = useMemo(() => packs.find((p) => p.id === selected)!, [selected]);
  const totalCredits = selectedPack.credits + selectedPack.bonus;

  const { data: me } = useLoggedInUserQuery();
  const buyPack = useCheckoutMutation();

  return (
    <div className="min-h-screen bg-[#F6F0E6] text-[#10221B]">
      {/* Top header */}
      <div className="mx-auto max-w-3xl px-4 pt-10">
        <div className="flex flex-col items-center gap-3">
          <div className="text-3xl font-semibold tracking-tight">TheDigitalGifter</div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1B3A30]/15 bg-white/55 px-3 py-1 text-xs">
              <span className="inline-block h-2 w-2 rounded-full bg-[#1B3A30]" />
              Reserved for <span className="font-semibold">{formatMMSS(secondsLeft)}</span> minutes
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-[#1B3A30]/15 bg-white/55 px-3 py-1 text-xs">
              <span className="font-semibold">Limited-time:</span>
              bonus credits included
            </div>
          </div>

            <div className="mt-3">
              <SignInButton />
            </div>
          <div className="mt-8">
            <h2 className="text-center text-2xl font-semibold">What’s included?</h2>
            <div className="mt-4 rounded-2xl border border-[#1B3A30]/15 bg-white/55 p-5">
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#1B3A30]/20 bg-white text-[#1B3A30]">✓</span>
                  <div>
                    <div className="font-medium">AI-powered photo-to-video & message generation</div>
                    <div className="text-[#10221B]/70">Create emotional moments from a single photo — in minutes.</div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#1B3A30]/20 bg-white text-[#1B3A30]">✓</span>
                  <div>
                    <div className="font-medium">Instant delivery</div>
                    <div className="text-[#10221B]/70">Generate, preview, and share immediately.</div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#1B3A30]/20 bg-white text-[#1B3A30]">✓</span>
                  <div>
                    <div className="font-medium">Unlimited previews & edits</div>
                    <div className="text-[#10221B]/70">Tweak until it feels just right — no pressure.</div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#1B3A30]/20 bg-white text-[#1B3A30]">✓</span>
                  <div>
                    <div className="font-medium">Multiple styles & emotions</div>
                    <div className="text-[#10221B]/70">Warm, playful, magical, heartfelt, and more.</div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#1B3A30]/20 bg-white text-[#1B3A30]">✓</span>
                  <div>
                    <div className="font-medium">No subscriptions</div>
                    <div className="text-[#10221B]/70">Pay once. Use anytime.</div>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Social proof */}
          <div className="mt-8 space-y-3">
            <div className="rounded-2xl border border-[#1B3A30]/15 bg-white/55 p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-[#10221B]/60">Spending insight</div>
              <div className="mt-1 text-sm font-medium">Average families spend €9–€29 per personalized gift</div>
            </div>
            <div className="rounded-2xl border border-[#1B3A30]/15 bg-white/55 p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-[#10221B]/60">Social proof</div>
              <div className="mt-1 text-sm font-medium">⭐ Rated 4.9/5 by families worldwide</div>
            </div>
          </div>

          {/* Pricing card – centered under social proof */}
          <Card className="mt-8 rounded-3xl border-[#1B3A30]/15 bg-white/55 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#10221B]/60">Choose your pack</div>
                  <div className="mt-1 text-lg font-semibold">Credit packs (one-time)</div>
                </div>
                <div className="rounded-2xl border border-[#1B3A30]/15 bg-white px-3 py-2 text-center">
                  <div className="text-xs text-[#10221B]/60">Time left</div>
                  <div className="text-sm font-semibold">{formatMSSFull(secondsLeft)}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {packs.map((p) => {
                  const active = p.id === selected;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                      className={
                        "w-full rounded-2xl border text-left transition " +
                        (active ? "border-[#1B3A30]/45 bg-white" : "border-[#1B3A30]/15 bg-white/55")
                      }
                    >
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-base font-semibold">{p.name}</div>
                            {p.popular && (
                              <Badge className="rounded-full bg-[#1B3A30] text-white">Most popular</Badge>
                            )}
                            <Badge variant="outline" className="rounded-full">+{p.bonus} bonus</Badge>
                          </div>
                          <div className="mt-1 text-xs text-[#10221B]/70">{p.credits.toLocaleString()} credits • {p.helper}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold">{p.price}</div>
                          <div className="text-xs text-[#10221B]/60">one-time</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <Separator className="my-5 bg-[#1B3A30]/15" />

              <div className="rounded-2xl border border-[#1B3A30]/15 bg-white/60 p-4 text-center">
                <div className="text-sm font-semibold">
                  You’ll get <span className="font-bold">{totalCredits.toLocaleString()}</span> credits (incl. bonus)
                </div>
                <div className="mt-1 text-xs text-[#10221B]/70">Credits valid until Dec 24 • No expiration pressure</div>

                <Button
                  className="mt-4 h-11 w-full rounded-full bg-[#F3D35B] text-[#10221B] hover:bg-[#EDC94A]"
                  onClick={() => void handleCheckout({ pack: selected, user: me ?? null, checkoutMutation: buyPack })}
                  disabled={buyPack.isPending}
                >
                  {buyPack.isPending ? "Processing…" : "Create my digital gift"}
                </Button>

                <div className="mt-3 text-xs text-[#10221B]/70">✔ Secure checkout • ✔ No subscriptions • ✔ Instant access</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="h-14" />
      </div>
    </div>
  );
}
