import type { Resource } from '../models.js';

// A real-time signal that one resource changed, so clients can patch just that
// resource instead of refetching the whole list.
export type ResourceChange =
  | { type: 'resource.updated'; resource: Resource }
  | { type: 'resource.removed'; resourceId: string };

export interface ResourcePublisher {
  publish(change: ResourceChange): void;
}
