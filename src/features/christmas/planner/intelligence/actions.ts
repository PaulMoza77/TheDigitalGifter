import { supabase } from "@/lib/supabase";
import { canAddCustomTask, canAddRecipient, hasFeature } from "../entitlements";
import { christmasDayParts, localDateParts } from "../date";
import { insertTask, insertTasks, loadTasks, patchTask } from "../api";
import { hostingTasksToInsert } from "./hostingIntelligence";
import type { ActionContext, ActionResult, PlannerActionRequest } from "./types";
import type { GiftItemStatus, PlannerProfile, TaskCategory } from "../types";
import { buildPlannerSnapshot } from "./snapshot";
import { DESTRUCTIVE_ACTIONS, previewPlannerAction, validatePlannerAction } from "./actionContract";

export { DESTRUCTIVE_ACTIONS, previewPlannerAction, validatePlannerAction } from "./actionContract";

export async function executePlannerAction(ctx: ActionContext, request: PlannerActionRequest): Promise<ActionResult> {
  const valid = validatePlannerAction(request);
  if (!valid.ok) return valid;

  if (ctx.profile.user_id !== ctx.userId) {
    return { ok: false, error: "You can only change your own planner.", code: "ownership" };
  }

  if (DESTRUCTIVE_ACTIONS.has(request.type) && !request.confirm) {
    return {
      ok: false,
      error: "Confirm these date changes before they are applied.",
      code: "confirm_required",
      preview: previewPlannerAction(request),
    };
  }

  const p = request.payload;
  const profileId = ctx.profile.id;

  if (request.type === "create_task") {
    const tasks = await loadTasks(profileId);
    const gate = canAddCustomTask(
      ctx.access,
      tasks.filter((t) => t.origin === "user").length,
      tasks.filter((t) => t.status === "open").length,
    );
    if (!gate.ok) return { ok: false, error: "Task limit reached.", code: "entitlement" };
    const row = await insertTask({
      profile_id: profileId,
      title: String(p.title).trim().slice(0, 160),
      category: ((p.category as TaskCategory) || "other"),
      due_on: (p.dueOn as string) || null,
      status: "open",
      priority: p.priority === "high" || p.priority === "low" ? p.priority : "normal",
      notes: "",
      origin: "user",
      template_key: null,
    });
    return row ? { ok: true, data: { id: row.id } } : { ok: false, error: "Could not create task.", code: "write_failed" };
  }

  if (request.type === "reschedule_task") {
    await patchTask(String(p.taskId), { due_on: String(p.dueOn), status: "rescheduled" });
    return { ok: true };
  }

  if (request.type === "reschedule_tasks") {
    const changes = p.changes as Array<{ taskId: string; dueOn: string }>;
    for (const change of changes) {
      await patchTask(change.taskId, { due_on: change.dueOn, status: "rescheduled" });
    }
    return { ok: true, data: { count: changes.length } };
  }

  if (request.type === "add_recipient") {
    const { count } = await supabase.from("christmas_gift_recipients").select("id", { count: "exact", head: true }).eq("profile_id", profileId);
    const gate = canAddRecipient(ctx.access, count || 0);
    if (!gate.ok) return { ok: false, error: "Recipient limit reached.", code: "entitlement" };
    const { data, error } = await supabase
      .from("christmas_gift_recipients")
      .insert({
        profile_id: profileId,
        display_name: String(p.displayName).trim().slice(0, 80),
        relationship: String(p.relationship || "other").slice(0, 40),
        budget_minor: p.budgetMinor != null ? Math.max(0, Number(p.budgetMinor)) : null,
      })
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, error: "Could not add recipient.", code: "write_failed" };
    return { ok: true, data: { id: data.id } };
  }

  if (request.type === "set_recipient_budget") {
    const { error } = await supabase
      .from("christmas_gift_recipients")
      .update({ budget_minor: p.budgetMinor == null ? null : Math.max(0, Number(p.budgetMinor)) })
      .eq("id", String(p.recipientId))
      .eq("profile_id", profileId);
    if (error) return { ok: false, error: "Could not update budget.", code: "write_failed" };
    return { ok: true };
  }

  if (request.type === "add_gift_idea") {
    const sourceType =
      p.sourceType === "gift_finder" || p.sourceType === "wishlist" || p.sourceType === "affiliate_product"
        ? p.sourceType
        : "manual";
    const sourceRef = p.sourceRef ? String(p.sourceRef).slice(0, 80) : null;
    if (sourceRef) {
      const { data: existing } = await supabase
        .from("christmas_gift_items")
        .select("id")
        .eq("profile_id", profileId)
        .eq("recipient_id", String(p.recipientId))
        .eq("source_ref", sourceRef)
        .maybeSingle();
      if (existing?.id) return { ok: true, data: { id: existing.id, duplicate: true } };
    }
    const { data, error } = await supabase
      .from("christmas_gift_items")
      .insert({
        profile_id: profileId,
        recipient_id: String(p.recipientId),
        idea: String(p.idea).trim().slice(0, 200),
        selected_gift: String(p.selectedGift || p.idea).trim().slice(0, 200),
        status: "idea",
        source_type: sourceType,
        source_ref: sourceRef,
      })
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, error: "Could not add gift.", code: "write_failed" };
    return { ok: true, data: { id: data.id } };
  }

  if (request.type === "update_gift_status") {
    const patch: Record<string, unknown> = { status: p.status as GiftItemStatus };
    if (p.actualPriceMinor != null && Number.isFinite(Number(p.actualPriceMinor))) {
      patch.actual_price_minor = Math.max(0, Number(p.actualPriceMinor));
    }
    const { error } = await supabase
      .from("christmas_gift_items")
      .update(patch)
      .eq("id", String(p.giftId))
      .eq("profile_id", profileId);
    if (error) return { ok: false, error: "Could not update gift.", code: "write_failed" };
    return { ok: true };
  }

  if (request.type === "set_total_budget") {
    if (ctx.access && !hasFeature(ctx.access, "budget")) {
      return { ok: false, error: "Budget is a paid module.", code: "entitlement" };
    }
    const { error } = await supabase
      .from("christmas_planner_profiles")
      .update({ total_budget_minor: Math.max(0, Number(p.totalMinor)) })
      .eq("id", profileId)
      .eq("user_id", ctx.userId);
    if (error) return { ok: false, error: "Could not set budget.", code: "write_failed" };
    return { ok: true };
  }

  if (request.type === "add_meal") {
    if (ctx.access && !hasFeature(ctx.access, "food_planner")) {
      return { ok: false, error: "Food planner is a paid module.", code: "entitlement" };
    }
    const { data, error } = await supabase
      .from("christmas_meals")
      .insert({
        profile_id: profileId,
        title: String(p.title).trim().slice(0, 120),
        section: String(p.section || "christmas_day"),
      })
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, error: "Could not add meal.", code: "write_failed" };
    return { ok: true, data: { id: data.id } };
  }

  if (request.type === "add_grocery_item") {
    const { data, error } = await supabase
      .from("christmas_grocery_items")
      .insert({
        profile_id: profileId,
        name: String(p.name).trim().slice(0, 120),
        quantity: String(p.quantity || "").slice(0, 40),
        status: "need",
        source_type: "manual",
      })
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, error: "Could not add grocery item.", code: "write_failed" };
    return { ok: true, data: { id: data.id } };
  }

  if (request.type === "add_event") {
    const { data, error } = await supabase
      .from("christmas_events")
      .insert({
        profile_id: profileId,
        title: String(p.title).trim().slice(0, 120),
        starts_on: String(p.startsOn),
        event_kind: String(p.eventKind || "personal"),
      })
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, error: "Could not add event.", code: "write_failed" };
    return { ok: true, data: { id: data.id } };
  }

  if (request.type === "add_guest") {
    if (ctx.access && !hasFeature(ctx.access, "hosting") && !hasFeature(ctx.access, "food_planner")) {
      return { ok: false, error: "Hosting is a paid module.", code: "entitlement" };
    }
    const adults = Math.min(20, Math.max(0, Number(p.adults ?? 1)));
    const kids = Math.min(20, Math.max(0, Number(p.kids ?? 0)));
    const { data, error } = await supabase
      .from("christmas_guests")
      .insert({
        profile_id: profileId,
        display_name: String(p.displayName || "Guest").trim().slice(0, 80),
        adults,
        kids,
        rsvp: "yes",
      })
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, error: "Could not add guest.", code: "write_failed" };
    return { ok: true, data: { id: data.id } };
  }

  if (request.type === "ensure_hosting_tasks") {
    if (!ctx.profile.hosting) return { ok: true, data: { inserted: 0 } };
    const tasks = await loadTasks(profileId);
    const snapshot = buildPlannerSnapshot({
      profile: ctx.profile as PlannerProfile,
      tasks,
      recipients: [],
      gifts: [],
      budgetEntries: [],
    });
    const today = localDateParts(new Date(), ctx.profile.timezone);
    const generated = hostingTasksToInsert(snapshot, today, christmasDayParts(ctx.profile.season_year));
    if (!generated.length) return { ok: true, data: { inserted: 0 } };
    const rows = await insertTasks(generated.map((t) => ({ ...t, profile_id: profileId })));
    return { ok: true, data: { inserted: rows.length } };
  }

  return { ok: false, error: "Unknown action.", code: "invalid_payload" };
}
