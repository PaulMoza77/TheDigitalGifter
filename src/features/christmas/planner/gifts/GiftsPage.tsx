import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Gift, Heart, Search, ShoppingBag, Wallet } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { trackPlannerEvent } from "../analytics";
import { loadGifts, loadRecipients } from "../api";
import { computeRecipientBudgets, formatPlannerMoney } from "../intelligence";
import { giftStatusLabel, prettyLabel } from "../date";
import { giftPeopleLimit, giftPeopleLimitCopy, isHouseholdGiftList } from "../giftPeople";
import { bumpPlannerWorkspace } from "../workspaceSync";
import { GiftConcierge } from "../giftConcierge";
import { PlannerStudioCue, recipientStudioCues } from "../studio/PlannerStudioCue";
import { FoundingPassUnlockButton } from "../FoundingPassUnlock";
import { PlannerGiftOutboundLink, PlannerGiftPriceLabel } from "../PlannerGiftLink";
import { copilotEnabled } from "../copilot/ask";
import { useCopilotUi } from "../copilot/CopilotHost";
import { PlannerEmptyState, PlannerLoading, PlannerProgress, PlannerStatusChip } from "../plannerUi";
import { PlannerOnboarding, usePlannerBundle } from "../Onboarding";
import { GIFT_ITEM_STATUSES, type GiftItem, type GiftItemStatus, type GiftRecipient } from "../types";
import { christmasIdentitiesForPeople, christmasIdentityForPerson } from "./giftIdentity";
import {
  giftLifecycle,
  giftsOverviewStats,
  isBought,
  isWrapped,
  nextGiftStatus,
  personGiftStats,
  personMatchesFilter,
  relationshipBucket,
  type GiftLifecycle,
  type PersonFilter,
} from "./giftProgress";

const RELATION_OPTIONS = [
  { value: "family", label: "Family" },
  { value: "friend", label: "Friend" },
  { value: "partner", label: "Partner" },
  { value: "child", label: "Child" },
  { value: "grandparent", label: "Grandparent" },
  { value: "other", label: "Other" },
] as const;

const LIFECYCLE_LABEL: Record<GiftLifecycle, string> = {
  ideas: "Ideas",
  planned: "Planned",
  bought: "Bought",
  wrapped: "Wrapped",
};

export function ChristmasPlannerGiftsPage() {
  const { loading, access, profile } = usePlannerBundle();
  const copilot = useCopilotUi();
  const [params, setParams] = useSearchParams();
  const [recipients, setRecipients] = useState<GiftRecipient[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("family");
  const [budget, setBudget] = useState("");
  const [idea, setIdea] = useState("");
  const [giftPrice, setGiftPrice] = useState("");
  const [giftLink, setGiftLink] = useState("");
  const [giftNote, setGiftNote] = useState("");
  const [editing, setEditing] = useState<GiftItem | null>(null);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [personError, setPersonError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PersonFilter>("all");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const ideaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    void Promise.all([loadRecipients(profile.id), loadGifts(profile.id)]).then(([r, g]) => {
      setRecipients(r);
      setGifts(g);
      const giftId = params.get("gift");
      const fromGift = giftId ? g.find((item) => item.id === giftId) : null;
      if (fromGift) {
        setEditing(fromGift);
        if (!params.get("person")) {
          const next = new URLSearchParams(params);
          next.set("person", fromGift.recipient_id);
          setParams(next, { replace: true });
        }
      }
    });
    trackPlannerEvent("planner_module_opened", { module: "gifts" });
  }, [profile?.id]);

  const people = useMemo(() => recipients.filter((person) => !isHouseholdGiftList(person)), [recipients]);
  const household = recipients.find((person) => isHouseholdGiftList(person));
  const limit = giftPeopleLimit(access, recipients);
  const personId = params.get("person");
  const active = people.find((person) => person.id === personId) || null;
  const budgets = useMemo(() => computeRecipientBudgets({ recipients, gifts }), [recipients, gifts]);
  const overview = useMemo(
    () => giftsOverviewStats({ people, gifts, profileBudgetMinor: profile?.total_budget_minor }),
    [people, gifts, profile?.total_budget_minor],
  );

  const hasFamily = people.some((p) => relationshipBucket(p.relationship) === "family");
  const hasFriends = people.some((p) => relationshipBucket(p.relationship) === "friends");
  const hasToBuy = people.some((p) => personGiftStats(gifts.filter((g) => g.recipient_id === p.id)).toBuy > 0 || gifts.filter((g) => g.recipient_id === p.id).length === 0);
  const hasBoughtDone = people.some((p) => {
    const stats = personGiftStats(gifts.filter((g) => g.recipient_id === p.id));
    return stats.total > 0 && stats.toBuy === 0;
  });

  const filters = useMemo(() => {
    const rows: Array<{ id: PersonFilter; label: string }> = [{ id: "all", label: `All (${people.length})` }];
    if (hasFamily) rows.push({ id: "family", label: "Family" });
    if (hasFriends) rows.push({ id: "friends", label: "Friends" });
    if (hasToBuy) rows.push({ id: "to_buy", label: "To buy" });
    if (hasBoughtDone) rows.push({ id: "bought", label: "Bought" });
    return rows;
  }, [people.length, hasFamily, hasFriends, hasToBuy, hasBoughtDone]);

  const visiblePeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((person) => personMatchesFilter(filter, person, gifts.filter((g) => g.recipient_id === person.id)))
      .filter((person) => {
        if (!q) return true;
        const theirs = gifts.filter((g) => g.recipient_id === person.id);
        return (
          person.display_name.toLowerCase().includes(q) ||
          prettyLabel(person.relationship || "").toLowerCase().includes(q) ||
          theirs.some((g) => `${g.idea} ${g.selected_gift}`.toLowerCase().includes(q))
        );
      });
  }, [people, gifts, filter, query]);

  const covers = useMemo(
    () =>
      christmasIdentitiesForPeople(
        people.map((person) => ({
          id: person.id,
          displayName: person.display_name,
          relationship: person.relationship,
        })),
      ),
    [people],
  );

  const attention = useMemo(() => {
    return people
      .map((person) => {
        const stats = personGiftStats(gifts.filter((g) => g.recipient_id === person.id));
        const row = budgets.find((b) => b.recipientId === person.id);
        return { person, stats, row };
      })
      .filter((row) => row.stats.toBuy > 0 || row.stats.total === 0)
      .sort((a, b) => b.stats.toBuy - a.stats.toBuy)[0] || null;
  }, [people, gifts, budgets]);

  function openPerson(id: string) {
    const next = new URLSearchParams(params);
    next.set("person", id);
    setParams(next, { replace: false });
  }

  function closePerson() {
    const next = new URLSearchParams(params);
    next.delete("person");
    setParams(next, { replace: false });
  }

  async function addPerson(event: FormEvent) {
    event.preventDefault();
    if (!profile || !name.trim()) return;
    if (isHouseholdGiftList({ display_name: name })) {
      setPersonError("Household is reserved for general gift shopping. Choose another name, or add that item in Gift shopping.");
      return;
    }
    if (!limit.canAdd) {
      setPersonError(giftPeopleLimitCopy(limit));
      trackPlannerEvent("planner_paywall_viewed", { feature: "gift_planner" });
      return;
    }
    const { data, error } = await supabase
      .from("christmas_gift_recipients")
      .insert({
        profile_id: profile.id,
        display_name: name.trim().slice(0, 80),
        relationship: relation.slice(0, 40) || "family",
        budget_minor: budget ? Math.max(0, Number(budget) * 100) : null,
      })
      .select("*")
      .maybeSingle();
    if (error || !data) {
      setPersonError(String(error?.message || "").includes("free_recipient_limit") ? giftPeopleLimitCopy(limit) : "Could not add this person.");
      return;
    }
    const row = data as GiftRecipient;
    setRecipients((p) => [...p, row]);
    setName("");
    setRelation("family");
    setBudget("");
    setPersonError(null);
    setPersonOpen(false);
    bumpPlannerWorkspace();
    trackPlannerEvent("planner_recipient_added", { countBucket: String(limit.giftPeople + 1) });
    openPerson(row.id);
  }

  async function addGift(event?: FormEvent) {
    event?.preventDefault();
    if (!profile || !active || !idea.trim()) return;
    const planned = giftPrice ? Math.max(0, Number(giftPrice) * 100) : null;
    const { data } = await supabase
      .from("christmas_gift_items")
      .insert({
        profile_id: profile.id,
        recipient_id: active.id,
        idea: idea.trim().slice(0, 200),
        selected_gift: idea.trim().slice(0, 200),
        url: giftLink.trim() || null,
        planned_price_minor: planned,
        status: planned || giftLink.trim() ? "planned" : "idea",
        source_type: "manual",
        hiding_place: giftNote.trim().slice(0, 120),
      })
      .select("*")
      .maybeSingle();
    if (data) {
      setGifts((p) => [...p, data as GiftItem]);
      setIdea("");
      setGiftPrice("");
      setGiftLink("");
      setGiftNote("");
      setGiftOpen(false);
      bumpPlannerWorkspace();
      trackPlannerEvent("planner_gift_added", { countBucket: "1" });
    }
  }

  async function setGiftStatus(gift: GiftItem, status: GiftItemStatus) {
    await supabase.from("christmas_gift_items").update({ status }).eq("id", gift.id);
    setGifts((p) => p.map((x) => (x.id === gift.id ? { ...x, status } : x)));
    bumpPlannerWorkspace();
    trackPlannerEvent("planner_gift_status_changed", { module: "gifts" });
  }

  if (loading) return <PlannerLoading label="Loading gifts…" />;
  if (!profile) return <PlannerOnboarding />;

  const currency = profile.currency;
  const personGifts = active ? gifts.filter((g) => g.recipient_id === active.id) : [];
  const activeStats = personGiftStats(personGifts);
  const activeBudget = active ? budgets.find((b) => b.recipientId === active.id) : undefined;

  function openAddSomeone() {
    setPersonError(limit.canAdd ? null : giftPeopleLimitCopy(limit));
    if (limit.canAdd) setPersonOpen(true);
  }

  function findIdeaFor(person: GiftRecipient) {
    openPerson(person.id);
    setConciergeOpen(true);
  }

  const header = (
    <header className="tdg-gifts-head">
      <div className="tdg-gifts-head-hero" aria-hidden="true">
        <img src="/christmas/planner/gifts-editorial.webp" alt="" decoding="async" />
      </div>
      <div className="tdg-gifts-head-copy">
        <p className="tdg-planner-kicker">Thoughtful gifts. Happier moments.</p>
        <h1>Gifts</h1>
        <p>Everyone you love. Everything in one place.</p>
        <p className="tdg-planner-sr">People first.</p>
      </div>
      <div className="tdg-gifts-head-actions">
        {people.length > 0 ? (
          <>
            <button
              type="button"
              className="tdg-gifts-search-toggle"
              aria-expanded={searchOpen}
              aria-label="Search gifts, people or ideas"
              onClick={() => setSearchOpen((v) => !v)}
            >
              <Search size={18} strokeWidth={1.8} aria-hidden />
            </button>
            <label className={`tdg-gifts-search${searchOpen ? " is-open" : ""}`}>
              <span className="tdg-planner-sr">Search gifts, people or ideas</span>
              <input
                className="tdg-planner-input"
                placeholder="Search gifts, people or ideas..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </>
        ) : null}
        <button type="button" className="tdg-planner-btn primary" disabled={!limit.canAdd} onClick={openAddSomeone}>
          + Add Someone
        </button>
      </div>
      {!limit.paid ? (
        <p className="tdg-planner-muted tdg-gifts-limit" data-testid="gift-people-limit">
          {giftPeopleLimitCopy(limit)}
        </p>
      ) : null}
      {personError && !personOpen ? (
        <p className="tdg-planner-muted" role="alert">
          {personError}
        </p>
      ) : null}
      {!limit.canAdd ? (
        <div className="tdg-gifts-unlock">
          <FoundingPassUnlockButton feature="gift_planner" />
        </div>
      ) : null}
    </header>
  );

  const empty = people.length === 0;

  return (
    <div className="tdg-planner-page tdg-gifts">
      {header}
      {empty ? (
        <GiftsEmptyState
          onAdd={openAddSomeone}
          onInspire={
            copilotEnabled()
              ? () => copilot?.openCopilot("What gifts am I still missing?", "gifts")
              : undefined
          }
        />
      ) : active ? (
        <PersonDetail
          person={active}
          gifts={personGifts}
          stats={activeStats}
          budget={activeBudget}
          currency={currency}
          hasChildren={profile.has_children}
          onBack={closePerson}
          onAddGift={() => setGiftOpen(true)}
          onFindIdea={() => setConciergeOpen(true)}
          onStatus={setGiftStatus}
          onEdit={setEditing}
          onCopilot={
            copilotEnabled()
              ? () => copilot?.openCopilot(`Need an idea for ${active.display_name}?`, "gifts")
              : undefined
          }
        />
      ) : (
        <div className="tdg-gifts-layout">
          <div className="tdg-gifts-main">
            <GiftsSummary overview={overview} currency={currency} />
            <div className="tdg-gifts-people-head">
              <h2>Your people</h2>
              {filters.length > 1 ? (
                <div className="tdg-gifts-chips" role="tablist" aria-label="Filter people">
                  {filters.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className={filter === row.id ? "on" : ""}
                      onClick={() => setFilter(row.id)}
                    >
                      {row.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="tdg-gifts-grid">
              {visiblePeople.map((person) => {
                const theirs = gifts.filter((g) => g.recipient_id === person.id);
                const stats = personGiftStats(theirs);
                return (
                  <PersonCard
                    key={person.id}
                    person={person}
                    stats={stats}
                    look={covers.get(person.id)}
                    onOpen={() => openPerson(person.id)}
                  />
                );
              })}
              <button type="button" className="tdg-gifts-add-card" onClick={openAddSomeone} disabled={!limit.canAdd}>
                <span className="tdg-gifts-add-plus" aria-hidden="true">
                  +
                </span>
                <span>Add Someone</span>
                <em>Start shopping for someone new</em>
              </button>
            </div>
            <div className="tdg-gifts-mobile-inspire">
              {attention ? (
                <button type="button" className="tdg-planner-btn" onClick={() => findIdeaFor(attention.person)}>
                  Need an idea for {attention.person.display_name}?
                </button>
              ) : copilotEnabled() ? (
                <button type="button" className="tdg-planner-btn" onClick={() => copilot?.openCopilot("What gifts am I still missing?", "gifts")}>
                  Find a gift
                </button>
              ) : null}
            </div>
            {household ? (
              <p className="tdg-planner-muted tdg-gifts-household">
                Household stays a private shopping list.{" "}
                <Link to="/account/christmas/shopping">Open gift shopping</Link>
              </p>
            ) : null}
            <aside className="tdg-gifts-context" aria-label="Gift help">
              <div className="tdg-gifts-context-mood">
                <p>
                  It’s not just about gifts.
                  <br />
                  It’s about the people who make Christmas special.
                </p>
              </div>
              {attention ? (
                <div className="tdg-gifts-context-card">
                  <p className="tdg-planner-kicker">Need inspiration?</p>
                  <h2>Still need something for {attention.person.display_name}?</h2>
                  <p>
                    {attention.stats.total === 0
                      ? "No gifts yet."
                      : `${attention.stats.toBuy} ${attention.stats.toBuy === 1 ? "gift" : "gifts"} left to buy.`}
                    {attention.row?.remainingMinor != null
                      ? ` ${formatPlannerMoney(Math.max(0, attention.row.remainingMinor), currency)} remaining.`
                      : ""}
                  </p>
                  <button type="button" className="tdg-planner-btn primary" onClick={() => findIdeaFor(attention.person)}>
                    Find an idea
                  </button>
                </div>
              ) : (
                <div className="tdg-gifts-context-card">
                  <p className="tdg-planner-kicker">Christmas gift progress</p>
                  <h2>
                    {overview.giftsPlanned} / {overview.giftsTotal || overview.giftsPlanned} planned
                  </h2>
                  <p>Everyone on your list has something in motion.</p>
                </div>
              )}
              {overview.budgetMinor != null ? (
                <div className="tdg-gifts-context-card is-quiet">
                  <p className="tdg-planner-kicker">Budget</p>
                  <p>
                    {formatPlannerMoney(overview.spentMinor || overview.committedMinor, currency)} /{" "}
                    {formatPlannerMoney(overview.budgetMinor, currency)}
                  </p>
                  <Link to="/account/christmas/budget">Open budget →</Link>
                </div>
              ) : (
                <div className="tdg-gifts-context-card is-quiet">
                  <p className="tdg-planner-kicker">Budget</p>
                  <Link to="/account/christmas/budget">Set a gift budget →</Link>
                </div>
              )}
            </aside>
          </div>
        </div>
      )}

      {personOpen ? (
        <div className="tdg-planner-sheet" role="dialog" aria-modal="true" aria-labelledby="add-person-title">
          <button type="button" className="tdg-planner-sheet-backdrop" aria-label="Close add person" onClick={() => setPersonOpen(false)} />
          <form className="tdg-planner-sheet-card" onSubmit={(event) => void addPerson(event)}>
            <div className="tdg-planner-sheet-head">
              <h2 id="add-person-title">Add someone</h2>
              <button type="button" className="tdg-planner-btn ghost" onClick={() => setPersonOpen(false)}>
                Close
              </button>
            </div>
            <label>
              Name
              <input className="tdg-planner-input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </label>
            <label>
              Relationship
              <span className="tdg-planner-muted">Optional</span>
              <select className="tdg-planner-select" value={relation} onChange={(e) => setRelation(e.target.value)}>
                {RELATION_OPTIONS.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Gift budget
              <span className="tdg-planner-muted">Optional, in {currency.toUpperCase()}</span>
              <input className="tdg-planner-input" type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </label>
            {personError ? <p role="alert">{personError}</p> : null}
            <button type="submit" className="tdg-planner-btn primary">
              Add person
            </button>
          </form>
        </div>
      ) : null}

      {giftOpen && active ? (
        <div className="tdg-planner-sheet" role="dialog" aria-modal="true" aria-labelledby="add-gift-title">
          <button type="button" className="tdg-planner-sheet-backdrop" aria-label="Close add gift" onClick={() => setGiftOpen(false)} />
          <form className="tdg-planner-sheet-card" onSubmit={(event) => void addGift(event)}>
            <div className="tdg-planner-sheet-head">
              <h2 id="add-gift-title">Add a gift for {active.display_name}</h2>
              <button type="button" className="tdg-planner-btn ghost" onClick={() => setGiftOpen(false)}>
                Close
              </button>
            </div>
            <label>
              Gift name
              <input
                ref={ideaRef}
                className="tdg-planner-input"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                required
                autoFocus
                placeholder="Cashmere scarf"
              />
            </label>
            <label>
              Price
              <span className="tdg-planner-muted">Optional, in {currency.toUpperCase()}</span>
              <input className="tdg-planner-input" type="number" min="0" value={giftPrice} onChange={(e) => setGiftPrice(e.target.value)} />
            </label>
            <label>
              Link
              <span className="tdg-planner-muted">Optional</span>
              <input className="tdg-planner-input" value={giftLink} onChange={(e) => setGiftLink(e.target.value)} placeholder="https://" />
            </label>
            <label>
              Note
              <span className="tdg-planner-muted">Optional</span>
              <input className="tdg-planner-input" value={giftNote} onChange={(e) => setGiftNote(e.target.value.slice(0, 120))} />
            </label>
            <button type="submit" className="tdg-planner-btn primary">
              Save gift
            </button>
          </form>
        </div>
      ) : null}

      {active && conciergeOpen ? (
        <GiftConcierge
          open={conciergeOpen}
          recipient={active}
          gifts={gifts}
          profileId={profile.id}
          currency={profile.currency}
          countryCode={profile.country_code}
          locale={profile.locale}
          onClose={() => setConciergeOpen(false)}
          onAdded={(gift) => {
            setGifts((p) => (p.some((x) => x.id === gift.id) ? p : [...p, gift]));
          }}
          onAddManually={() => {
            setConciergeOpen(false);
            setGiftOpen(true);
            requestAnimationFrame(() => ideaRef.current?.focus());
          }}
        />
      ) : null}
      {editing ? (
        <GiftEditor
          gift={editing}
          currency={profile.currency}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            setGifts((p) => p.map((x) => (x.id === next.id ? next : x)));
            setEditing(null);
            bumpPlannerWorkspace();
          }}
        />
      ) : null}
    </div>
  );
}

function GiftsEmptyState({ onAdd, onInspire }: { onAdd: () => void; onInspire?: () => void }) {
  return (
    <section className="tdg-gifts-empty">
      <div className="tdg-gifts-empty-visual">
        <img src="/christmas/planner/gifts-editorial.webp" alt="" />
      </div>
      <div>
        <PlannerEmptyState
          mark="gift"
          title="Start your Christmas gift list."
          body="Add the people you're shopping for and we'll help you keep track of ideas, budget, buying and wrapping."
          action={
            <div className="tdg-planner-actions">
              <button type="button" className="tdg-planner-btn primary" onClick={onAdd}>
                + Add your first person
              </button>
              {onInspire ? (
                <button type="button" className="tdg-planner-btn" onClick={onInspire}>
                  Need gift inspiration?
                </button>
              ) : null}
            </div>
          }
        />
      </div>
    </section>
  );
}

function GiftsSummary({
  overview,
  currency,
}: {
  overview: ReturnType<typeof giftsOverviewStats>;
  currency: string;
}) {
  const budgetValue =
    overview.budgetMinor != null
      ? `${formatPlannerMoney(overview.spentMinor || overview.committedMinor, currency)} / ${formatPlannerMoney(overview.budgetMinor, currency)}`
      : "Set a gift budget";
  return (
    <div className="tdg-gifts-summary">
      <div>
        <Gift size={22} strokeWidth={1.6} aria-hidden />
        <strong>
          {overview.giftsPlanned} / {overview.giftsTotal}
        </strong>
        <span>Gifts planned</span>
      </div>
      <div>
        <ShoppingBag size={22} strokeWidth={1.6} aria-hidden />
        <strong>{overview.leftToBuy}</strong>
        <span>Left to buy</span>
      </div>
      <div>
        <Wallet size={22} strokeWidth={1.6} aria-hidden />
        <strong>{budgetValue}</strong>
        <span>Budget</span>
      </div>
      <div>
        <Heart size={22} strokeWidth={1.6} aria-hidden />
        <strong>{overview.people}</strong>
        <span>People</span>
      </div>
    </div>
  );
}

function PersonCard({
  person,
  stats,
  look,
  onOpen,
}: {
  person: GiftRecipient;
  stats: ReturnType<typeof personGiftStats>;
  look?: ReturnType<typeof christmasIdentityForPerson>;
  onOpen: () => void;
}) {
  const cover =
    look ||
    christmasIdentityForPerson({
      id: person.id,
      displayName: person.display_name,
      relationship: person.relationship,
    });
  const remaining = stats.done ? "All done" : stats.total === 0 ? "Add a gift" : `${stats.toBuy} left to buy`;
  return (
    <button type="button" className="tdg-gifts-card" onClick={onOpen}>
      <span className="tdg-gifts-card-visual">
        <img src={cover.src} alt="" />
      </span>
      <span className="tdg-gifts-card-body">
        <strong>{person.display_name}</strong>
        <span className="tdg-gifts-card-meta">
          {stats.bought} of {stats.total} gifts
        </span>
        <PlannerProgress value={stats.progress} compact />
        <span className={`tdg-gifts-card-next${stats.done ? " is-done" : ""}`}>{remaining}</span>
      </span>
    </button>
  );
}

function PersonDetail({
  person,
  gifts,
  stats,
  budget,
  currency,
  hasChildren,
  onBack,
  onAddGift,
  onFindIdea,
  onStatus,
  onEdit,
  onCopilot,
}: {
  person: GiftRecipient;
  gifts: GiftItem[];
  stats: ReturnType<typeof personGiftStats>;
  budget: ReturnType<typeof computeRecipientBudgets>[number] | undefined;
  currency: string;
  hasChildren: boolean;
  onBack: () => void;
  onAddGift: () => void;
  onFindIdea: () => void;
  onStatus: (gift: GiftItem, status: GiftItemStatus) => void;
  onEdit: (gift: GiftItem) => void;
  onCopilot?: () => void;
}) {
  const look = christmasIdentityForPerson({
    id: person.id,
    displayName: person.display_name,
    relationship: person.relationship,
  });
  const groups: GiftLifecycle[] = ["ideas", "planned", "bought", "wrapped"];
  return (
    <div className="tdg-gifts-person">
      <button type="button" className="tdg-planner-linkish tdg-gifts-back" onClick={onBack}>
        Gifts
      </button>
      <header className="tdg-gifts-person-head">
        <div className="tdg-gifts-person-hero">
          <img src={look.src} alt="" />
        </div>
        <div>
          <h2>{person.display_name}</h2>
          {person.relationship ? <p className="tdg-planner-muted">{prettyLabel(person.relationship)}</p> : null}
          <p className="tdg-gifts-person-stats">
            {stats.total} {stats.total === 1 ? "gift" : "gifts"} planned
            {stats.bought ? ` · ${stats.bought} bought` : ""}
            {stats.wrapped ? ` · ${stats.wrapped} wrapped` : ""}
          </p>
          {budget?.budgetMinor != null ? (
            <p>
              {formatPlannerMoney(budget.committedMinor, currency)} / {formatPlannerMoney(budget.budgetMinor, currency)}
            </p>
          ) : (
            <Link to="/account/christmas/budget">Set a gift budget</Link>
          )}
          <div className="tdg-planner-actions">
            <button type="button" className="tdg-planner-btn primary" onClick={onAddGift}>
              + Add Gift
            </button>
            <button type="button" className="tdg-planner-btn" onClick={onFindIdea}>
              Find an idea
            </button>
            {onCopilot ? (
              <button type="button" className="tdg-planner-btn" onClick={onCopilot}>
                Need an idea for {person.display_name}?
              </button>
            ) : null}
          </div>
        </div>
      </header>
      <PlannerStudioCue cues={recipientStudioCues({ hasChildren, relationship: person.relationship })} />
      {gifts.length === 0 ? (
        <PlannerEmptyState
          mark="gift"
          title={`Nothing planned for ${person.display_name} yet.`}
          body="Find the first idea or add one yourself."
          action={
            <div className="tdg-planner-actions">
              <button type="button" className="tdg-planner-btn primary" onClick={onFindIdea}>
                Find an idea
              </button>
              <button type="button" className="tdg-planner-btn" onClick={onAddGift}>
                Add manually
              </button>
            </div>
          }
        />
      ) : (
        groups.map((group) => {
          const rows = gifts.filter((g) => giftLifecycle(g.status) === group);
          if (!rows.length) return null;
          return (
            <section key={group} className="tdg-gifts-lane">
              <h3>{LIFECYCLE_LABEL[group]}</h3>
              {rows.map((g) => (
                <GiftRow key={g.id} gift={g} currency={currency} onStatus={onStatus} onEdit={onEdit} />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}

function GiftRow({
  gift,
  currency,
  onStatus,
  onEdit,
}: {
  gift: GiftItem;
  currency: string;
  onStatus: (gift: GiftItem, status: GiftItemStatus) => void;
  onEdit: (gift: GiftItem) => void;
}) {
  const bought = isBought(gift.status);
  const wrapped = isWrapped(gift.status);
  return (
    <div className="tdg-planner-gift-row">
      <div>
        <strong>{gift.selected_gift || gift.idea}</strong>
        <div className="tdg-planner-gift-meta">
          <PlannerStatusChip tone={wrapped ? "done" : bought ? "gold" : "default"}>{giftStatusLabel(gift.status)}</PlannerStatusChip>
          {gift.store ? <span>{gift.store}</span> : null}
          <PlannerGiftPriceLabel gift={gift} currency={currency} />
          {gift.actual_price_minor ? <span>paid {formatPlannerMoney(gift.actual_price_minor, currency)}</span> : null}
          {gift.hiding_place ? <span>{gift.hiding_place}</span> : null}
        </div>
        {gift.url ? <PlannerGiftOutboundLink gift={gift} source="gifts" /> : null}
      </div>
      <div className="tdg-gifts-row-actions">
        <button
          type="button"
          className="tdg-planner-btn"
          disabled={bought}
          onClick={() => onStatus(gift, nextGiftStatus(gift.status, "bought"))}
        >
          {bought ? "Bought ✓" : "Bought"}
        </button>
        <button
          type="button"
          className="tdg-planner-btn"
          disabled={wrapped}
          onClick={() => onStatus(gift, nextGiftStatus(gift.status, "wrapped"))}
        >
          {wrapped ? "Wrapped ✓" : "Wrapped"}
        </button>
        <select
          className="tdg-planner-select"
          value={gift.status}
          aria-label={`Status for ${gift.selected_gift || gift.idea}`}
          onChange={(e) => onStatus(gift, e.target.value as GiftItemStatus)}
        >
          {GIFT_ITEM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {giftStatusLabel(s)}
            </option>
          ))}
        </select>
        <button type="button" className="tdg-planner-linkish" onClick={() => onEdit(gift)}>
          More
        </button>
      </div>
    </div>
  );
}

function GiftEditor({
  gift,
  currency,
  onClose,
  onSave,
}: {
  gift: GiftItem;
  currency: string;
  onClose: () => void;
  onSave: (g: GiftItem) => void;
}) {
  const [form, setForm] = useState(gift);
  return (
    <div className="tdg-planner-sheet">
      <button type="button" className="tdg-planner-sheet-backdrop" onClick={onClose} aria-label="Close" />
      <div className="tdg-planner-sheet-card">
        <div className="tdg-planner-sheet-head">
          <h2>Gift details</h2>
          <button type="button" className="tdg-planner-linkish" onClick={onClose}>
            Close
          </button>
        </div>
        <input className="tdg-planner-input" value={form.idea} onChange={(e) => setForm({ ...form, idea: e.target.value.slice(0, 200) })} placeholder="Idea" />
        <input className="tdg-planner-input" value={form.selected_gift} onChange={(e) => setForm({ ...form, selected_gift: e.target.value.slice(0, 200) })} placeholder="Selected gift" />
        <input className="tdg-planner-input" value={form.url || ""} onChange={(e) => setForm({ ...form, url: e.target.value || null })} placeholder="Product link" />
        {form.url ? <PlannerGiftOutboundLink gift={form} source="gift_editor" /> : null}
        <input className="tdg-planner-input" value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value.slice(0, 80) })} placeholder="Store" />
        <input className="tdg-planner-input" type="number" placeholder="Planned price" value={form.planned_price_minor ? form.planned_price_minor / 100 : ""} onChange={(e) => setForm({ ...form, planned_price_minor: e.target.value ? Number(e.target.value) * 100 : null })} />
        <input className="tdg-planner-input" type="number" placeholder="Actual price" value={form.actual_price_minor ? form.actual_price_minor / 100 : ""} onChange={(e) => setForm({ ...form, actual_price_minor: e.target.value ? Number(e.target.value) * 100 : null })} />
        <input className="tdg-planner-input" type="date" value={form.delivery_on || ""} onChange={(e) => setForm({ ...form, delivery_on: e.target.value || null })} />
        <input className="tdg-planner-input" type="date" value={form.return_deadline || ""} onChange={(e) => setForm({ ...form, return_deadline: e.target.value || null })} />
        <input className="tdg-planner-input" value={form.hiding_place} onChange={(e) => setForm({ ...form, hiding_place: e.target.value.slice(0, 120) })} placeholder="Note or hiding place" />
        <button
          type="button"
          className="tdg-planner-btn primary"
          onClick={async () => {
            await supabase
              .from("christmas_gift_items")
              .update({
                idea: form.idea,
                selected_gift: form.selected_gift,
                url: form.url,
                store: form.store,
                planned_price_minor: form.planned_price_minor,
                actual_price_minor: form.actual_price_minor,
                delivery_on: form.delivery_on,
                return_deadline: form.return_deadline,
                hiding_place: form.hiding_place,
                source_meta: form.source_meta,
                image_url: form.image_url,
                price_checked_at: form.price_checked_at,
              })
              .eq("id", form.id);
            onSave(form);
          }}
        >
          Save · {currency.toUpperCase()}
        </button>
      </div>
    </div>
  );
}
