import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getResourceUsage, type ResourceUsage } from '../../api/resources';
import { getAuditPage, type AuditEntry } from '../../api/audit';
import { errorMessage } from '../../utils/errorMessage';
import { fillDailyWindow } from './usageWindow';
import UsageLineChart from './UsageLineChart';
import TierUsageBars from './TierUsageBars';

const WINDOW_DAYS = 30;

const fmt = (at: string) =>
  new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Crew-lead per-resource trend view: 30-day usage, tier breakdown, recent activity. */
export default function ResourceAnalyticsPage() {
  const { id = '' } = useParams();
  const [usage, setUsage] = useState<ResourceUsage | null>(null);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getResourceUsage(id, WINDOW_DAYS),
      getAuditPage({ page: 1, pageSize: 10, resourceId: id }),
    ])
      .then(([u, audit]) => {
        if (!active) return;
        setUsage(u);
        setActivity(audit.data);
      })
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <>
      <Link to="/resources" className="back-link">
        ← Resources
      </Link>

      {loading ? (
        <p className="muted mt-3">Loading usage…</p>
      ) : error || !usage ? (
        <p className="error mt-3">⚠ {error ?? 'Could not load this resource.'}</p>
      ) : (
        <>
          <section className="card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 text-[1.1rem]">{usage.resource.name}</h2>
              <span className={`tier tier-${usage.resource.minLevel}`}>
                {usage.resource.minLevel}
              </span>
            </div>
            <p className="muted mt-1 text-[0.85rem]">
              {usage.resource.remainingQty} / {usage.resource.maxQty} in stock ·{' '}
              {usage.resource.isDecommissioned ? 'Decommissioned' : 'Active'}
            </p>
            <div className="mt-4">
              <UsageLineChart
                points={fillDailyWindow(usage.daily, WINDOW_DAYS)}
                maxQty={usage.resource.maxQty}
              />
            </div>
          </section>

          <section className="card">
            <h3 className="m-0 text-[1rem]">Who uses it</h3>
            <p className="muted mb-3 mt-1 text-[0.8rem]">
              Consumption by membership tier.
            </p>
            <TierUsageBars data={usage.byTier} />
          </section>

          <section className="card">
            <h3 className="m-0 text-[1rem]">Recent activity</h3>
            {activity.length === 0 ? (
              <p className="muted mt-3">No activity recorded for this resource.</p>
            ) : (
              <table className="data-table mt-3">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Action</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((e) => (
                    <tr key={e.id}>
                      <td data-label="When">{fmt(e.at)}</td>
                      <td data-label="Who">
                        {e.userName}{' '}
                        <span className={`tier tier-${e.userLevel} ml-1 text-[0.62rem]`}>
                          {e.userLevel}
                        </span>
                      </td>
                      <td data-label="Action">{e.type}</td>
                      <td className="num" data-label="Amount">
                        {e.amount || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </>
  );
}
