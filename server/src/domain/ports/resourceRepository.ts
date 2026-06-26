import type { NewResource, Resource } from '../models.js';

export interface ResourceRepository {
  create(input: NewResource): Resource;
  findById(id: string): Resource | null;
  findAll(): Resource[];
  findActive(): Resource[];
  /** Decommission a resource (soft-deactivate). Returns the updated resource. */
  deactivate(id: string): Resource | null;
  delete(id: string): boolean;
}
