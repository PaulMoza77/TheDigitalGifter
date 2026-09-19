import type { DerivedCalendarItem, PlannerSnapshot } from "./types";
import { giftLabel } from "./giftIntelligence";
import { earliestDeparture } from "./travelIntelligence";

export function deriveCalendarItems(snapshot: PlannerSnapshot): DerivedCalendarItem[] {
  const items: DerivedCalendarItem[] = [];
  const seen = new Set<string>();

  const push = (item: DerivedCalendarItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };

  for (const task of snapshot.tasks) {
    if (!task.due_on) continue;
    push({
      id: `task:${task.id}`,
      date: task.due_on,
      title: task.title,
      kind: "task",
      sourceId: task.id,
      href: "/account/christmas/plan",
    });
  }

  for (const event of snapshot.events) {
    push({
      id: `event:${event.id}`,
      date: event.starts_on,
      title: event.title,
      kind: "event",
      sourceId: event.id,
      href: "/account/christmas/calendar",
    });
  }

  for (const gift of snapshot.gifts) {
    if (gift.delivery_on) {
      push({
        id: `gift-delivery:${gift.id}`,
        date: gift.delivery_on,
        title: `Delivery: ${giftLabel(gift)}`,
        kind: "gift_delivery",
        sourceId: gift.id,
        href: `/account/christmas/gifts?gift=${encodeURIComponent(gift.id)}`,
      });
    }
    if (gift.return_deadline) {
      push({
        id: `gift-return:${gift.id}`,
        date: gift.return_deadline,
        title: `Return by: ${giftLabel(gift)}`,
        kind: "gift_return",
        sourceId: gift.id,
        href: `/account/christmas/gifts?gift=${encodeURIComponent(gift.id)}`,
      });
    }
  }

  const depart = earliestDeparture(snapshot);
  const trip = snapshot.trips.find((t) => t.start_on === depart);
  if (depart && trip) {
    push({
      id: `travel-start:${trip.id}`,
      date: depart,
      title: "Travel starts",
      kind: "travel",
      sourceId: trip.id,
      href: "/account/christmas/travel",
    });
    if (trip.end_on) {
      push({
        id: `travel-end:${trip.id}`,
        date: trip.end_on,
        title: "Travel ends",
        kind: "travel",
        sourceId: trip.id,
        href: "/account/christmas/travel",
      });
    }
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
