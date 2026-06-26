import { randomUUID } from 'node:crypto';

import type { DB } from '../../db/connection.js';
import type { CrewLeadRepository } from '../../domain/ports/crewLeadRepository.js';
import type { CrewLead, NewCrewLead } from '../../domain/models.js';

interface CrewLeadRow {
  id: string;
  name: string;
  created_at: string;
}

const toModel = (row: CrewLeadRow): CrewLead => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
});

export class SqliteCrewLeadRepository implements CrewLeadRepository {
  constructor(private readonly db: DB) {}

  create(input: NewCrewLead): CrewLead {
    const row: CrewLeadRow = {
      id: randomUUID(),
      name: input.name,
      created_at: new Date().toISOString(),
    };
    this.db
      .prepare('INSERT INTO crew_leads (id, name, created_at) VALUES (?, ?, ?)')
      .run(row.id, row.name, row.created_at);
    return toModel(row);
  }

  findById(id: string): CrewLead | null {
    const row = this.db
      .prepare('SELECT * FROM crew_leads WHERE id = ?')
      .get(id) as CrewLeadRow | undefined;
    return row ? toModel(row) : null;
  }

  findAll(): CrewLead[] {
    const rows = this.db
      .prepare('SELECT * FROM crew_leads ORDER BY created_at')
      .all() as CrewLeadRow[];
    return rows.map(toModel);
  }

  count(): number {
    const { n } = this.db
      .prepare('SELECT COUNT(*) AS n FROM crew_leads')
      .get() as { n: number };
    return n;
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM crew_leads WHERE id = ?').run(id).changes > 0;
  }
}
