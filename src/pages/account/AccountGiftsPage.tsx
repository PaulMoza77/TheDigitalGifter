import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { trackChristmasEvent } from "@/features/christmas/analytics";
import {
  listMyGiftsOnServer,
  type MyGiftItem,
} from "@/features/christmas/gifts/giftTreeApi";
import { GIFT_TREE_PRODUCT_KEY } from "@/features/christmas/gifts/rewardCatalog";

function statusLabel(status: string): string {
  switch (status) {
    case "available":
      return "Available";
    case "credits_added":
      return "Credits added";
    case "redeemed":
      return "Redeemed";
    case "expired":
      return "Expired";
    case "used":
      return "Used";
    default:
      return status;
  }
}

export default function AccountGiftsPage() {
  const [gifts, setGifts] = useState<MyGiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void trackChristmasEvent("my_gifts_view", {
      productKey: GIFT_TREE_PRODUCT_KEY,
      pathname: "/account/gifts",
    });
    let cancelled = false;
    void listMyGiftsOnServer()
      .then((res) => {
        if (cancelled) return;
        setGifts(res.gifts || []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load gifts.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHead
        exactTitle
        title="My Gifts | The Digital Gifter"
        description="Everything you've unwrapped, all in one place."
        url="https://www.thedigitalgifter.com/account/gifts"
      />
      <div className="mx-auto max-w-3xl px-4 py-8 text-zinc-100">
        <h1 className="font-serif text-3xl text-white">My Gifts</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Everything you&apos;ve unwrapped, all in one place.
        </p>

        {loading ? <p className="mt-8 text-sm text-zinc-400">Loading your gifts…</p> : null}
        {error ? (
          <p className="mt-8 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && gifts.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm text-zinc-300">No gifts yet.</p>
            <Link
              to="/christmas/gifts"
              className="mt-4 inline-flex rounded-full bg-amber-200/90 px-4 py-2 text-sm font-semibold text-zinc-900"
            >
              Open a Christmas gift
            </Link>
          </div>
        ) : null}

        <ul className="mt-8 space-y-4">
          {gifts.map((gift) => (
            <li
              key={gift.id}
              className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/70">
                    {statusLabel(gift.status)}
                  </p>
                  <h2 className="mt-1 font-serif text-xl text-white">{gift.reward.title}</h2>
                  <p className="mt-1 text-sm text-zinc-400">{gift.reward.description}</p>
                  {gift.created_at ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      Received {new Date(gift.created_at).toLocaleDateString()}
                    </p>
                  ) : null}
                  {gift.expires_at ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      Expires {new Date(gift.expires_at).toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
                {gift.status === "available" || gift.status === "credits_added" ? (
                  <Link
                    to={gift.claim_path}
                    onClick={() => {
                      void trackChristmasEvent("christmas_reward_redeem_start", {
                        productKey: GIFT_TREE_PRODUCT_KEY,
                        pathname: "/account/gifts",
                        metadata: {
                          reward_id: gift.reward.id,
                          reward_type: gift.reward.type,
                        },
                      });
                    }}
                    className="rounded-full bg-amber-200/90 px-4 py-2 text-sm font-semibold text-zinc-900"
                  >
                    {gift.reward.type === "discount" ? "Use offer" : "Create now"}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
