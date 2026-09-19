import { supabase } from "@/lib/supabase";
import { insertTasks, loadProfile, loadTasks, upsertProfile } from "./api";
import {
  christmasDayParts,
  daysUntilChristmas,
  localDateParts,
  resolvePlanMode,
  upcomingChristmasYear,
} from "./date";
import { generateInitialPlan, progressiveSurface } from "./planGenerator";
import {
  mapPersonalizationToPlanInput,
  readPlannerPersonalization,
  type PlannerPersonalizationAnswers,
} from "./personalization";
import type { PlannerProfile, PreparedLevel } from "./types";

export async function initializePlannerFromPersonalization(
  answers: PlannerPersonalizationAnswers = readPlannerPersonalization(),
): Promise<PlannerProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const mapped = mapPersonalizationToPlanInput(answers);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || mapped.tz || "UTC";
  const season = upcomingChristmasYear(new Date(), tz);
  const existing = await loadProfile(season);
  if (existing) {
    const patch: Partial<PlannerProfile> = {};
    if (!existing.onboarding_completed_at) patch.onboarding_completed_at = new Date().toISOString();
    if (answers.role) {
      patch.hosting = mapped.hosting;
      patch.travelling = mapped.travelling;
      patch.prepared_level = mapped.prepared;
      patch.plan_mode = mapped.mode;
    }
    if (Object.keys(patch).length) {
      await supabase.from("christmas_planner_profiles").update(patch).eq("id", existing.id);
      return { ...existing, ...patch };
    }
    return existing;
  }

  const daysLeft = daysUntilChristmas(new Date(), tz);
  const prepared: PreparedLevel = mapped.prepared;
  const mode = answers.start ? mapped.mode : resolvePlanMode(daysLeft, prepared);
  const profile = await upsertProfile({
    user_id: user.id,
    season_year: season,
    country_code: "US",
    currency: "eur",
    timezone: tz,
    household_label: "",
    recipient_count_approx: mapped.giftCount || 3,
    total_budget_minor: null,
    hosting: mapped.hosting,
    travelling: mapped.travelling,
    has_children: mapped.hasChildren,
    prepared_level: prepared,
    known_dates: [],
    onboarding_completed_at: new Date().toISOString(),
    plan_mode: mode,
    locale: "en",
    metadata: {
      start: answers.start,
      chaos: answers.chaos,
      role: answers.role,
    },
  });
  if (!profile) return null;

  const already = await loadTasks(profile.id);
  if (already.length === 0) {
    const today = localDateParts(new Date(), tz);
    const generated = progressiveSurface(
      generateInitialPlan({
        today,
        christmas: christmasDayParts(season),
        mode,
        hosting: mapped.hosting,
        travelling: mapped.travelling,
        hasChildren: mapped.hasChildren,
        giftCount: mapped.giftCount,
        prepared,
        chaos: mapped.chaos,
      }),
      `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`,
      mode,
    );
    await insertTasks(
      generated.map((t) => ({
        ...t,
        profile_id: profile.id,
        notes: t.notes,
        origin: "system" as const,
        template_key: t.template_key,
        status: "open" as const,
      })),
    );
  }
  return profile;
}
