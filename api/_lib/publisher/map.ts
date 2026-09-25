import { isPublisherDestination } from "../../../src/features/publisher/destinations";
import type { PublisherDestination } from "../../../src/features/publisher/types";

export function asDestinations(values: unknown): PublisherDestination[] {
  return (Array.isArray(values) ? values : []).map(String).filter(isPublisherDestination);
}
