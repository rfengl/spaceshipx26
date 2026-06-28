import { useEffect, useState } from 'react';

import { getAggregateReport, type TierSummary } from '../../api/reports';
import BackDashboardButton from '../../components/BackDashboardButton';
import { errorMessage } from '../../utils/errorMessage';

// Colour the stock bar by how full it is (matches the shortage hints elsewhere).
function barColor(ratio: number) {
  if (ratio < 1 / 3) return 'bg-[#ff6b6b]';
  if (ratio < 0.5) return 'bg-[#ffd86b]';
  return 'bg-[#8ef5b0]';
}

const emptyTotals = {
  passengers: 0,
  resources: 0,
  capacity: 0,
  remaining: 0,
  uses: 0,
};

export default function AggregatedReportsPage() {
  const [rows, setRows] = useState<TierSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAggregateReport()
      .then(setRows)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  const totals = rows.reduce(
    (a, r) => ({
      passengers: a.passengers + r.passengers,
      resources: a.resources + r.resources,
      capacity: a.capacity + r.capacity,
      remaining: a.remaining + r.remaining,
      uses: a.uses + r.uses,
    }),
    emptyTotals,
  );

  return (
    <>
      <BackDashboardButton />

      <section className="card">
        <h2 className="m-0 text-[1.1rem]">Aggregated reports</h2>
        <p className="muted mt-1 text-[0.9rem]">
          Ship-wide resource distribution, grouped by passenger membership level.
        </p>

        {error && <p className="error mt-3">⚠ {error}</p>}

        {loading ? (
          <p className="muted mt-4">Loading report…</p>
        ) : (
          <table className="data-table mt-4">
            <thead>
              <tr>
                <th>Tier</th>
                <th className="num">Passengers</th>
                <th className="num">Resources</th>
                <th>Stock (remaining / capacity)</th>
                <th className="num">Uses</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ratio = r.capacity > 0 ? r.remaining / r.capacity : 0;
                return (
                  <tr key={r.level}>
                    <td data-label="Tier">
                      <span className={`tier tier-${r.level}`}>{r.level}</span>
                    </td>
                    <td className="num" data-label="Passengers">
                      {r.passengers}
                    </td>
                    <td className="num" data-label="Resources">
                      {r.resources}
                    </td>
                    <td data-label="Stock">
                      <div className="flex min-w-[8rem] flex-col gap-1">
                        <span className="text-[0.85rem]">
                          {r.remaining} / {r.capacity}
                        </span>
                        <span className="block h-1.5 w-full overflow-hidden rounded bg-white/10">
                          <span
                            className={`block h-full rounded ${barColor(ratio)}`}
                            style={{ width: `${Math.round(ratio * 100)}%` }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="num" data-label="Uses">
                      {r.uses}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td data-label="Tier">All tiers</td>
                <td className="num" data-label="Passengers">
                  {totals.passengers}
                </td>
                <td className="num" data-label="Resources">
                  {totals.resources}
                </td>
                <td data-label="Stock">
                  <div className="flex min-w-[8rem] flex-col gap-1">
                    <span className="text-[0.85rem]">
                      {totals.remaining} / {totals.capacity}
                    </span>
                    <span className="block h-1.5 w-full overflow-hidden rounded bg-white/10">
                      <span
                        className={`block h-full rounded ${barColor(
                          totals.capacity > 0 ? totals.remaining / totals.capacity : 0,
                        )}`}
                        style={{
                          width: `${Math.round(
                            (totals.capacity > 0
                              ? totals.remaining / totals.capacity
                              : 0) * 100,
                          )}%`,
                        }}
                      />
                    </span>
                  </div>
                </td>
                <td className="num" data-label="Uses">
                  {totals.uses}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>
    </>
  );
}
