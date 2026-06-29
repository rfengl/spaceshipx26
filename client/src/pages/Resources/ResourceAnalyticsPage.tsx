import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getResourceUsage, listResources, type ResourceUsage } from '../../api/resources';
import { getAuditPage, type AuditEntry } from '../../api/audit';
import type { Resource } from '../../types';
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
  const navigate = useNavigate();

  const [resources, setResources] = useState<Resource[]>([]);
  const [usage, setUsage] = useState<ResourceUsage | null>(null);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The resource list powers the switcher.
  useEffect(() => {
    listResources()
      .then(setResources)
      .catch(() => {});
  }, []);

  // Reached without a resource (e.g. from the dashboard) — open the first one.
  useEffect(() => {
    if (!id && resources.length) {
      navigate(`/resources/${resources[0].id}`, { replace: true });
    }
  }, [id, resources, navigate]);

  // Load the selected resource's usage + recent activity.
  useEffect(() => {
    if (!id) return;
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

      <section className="card">
        <div className="flex items-center justify-between gap-3">
          <select
            className="input max-w-[18rem] text-[1rem] font-semibold"
            value={id}
            onChange={(e) => navigate(`/resources/${e.target.value}`)}
            aria-label="Choose a resource"
          >
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {usage && (
            <span className={`tier tier-${usage.resource.minLevel}`}>
              {usage.resource.minLevel}
            </span>
          )}
        </div>

        {loading ? (
          <p className="muted mt-3">Loading usage…</p>
        ) : error || !usage ? (
          <p className="error mt-3">⚠ {error ?? 'Could not load this resource.'}</p>
        ) : (
          <>
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
          </>
        )}
      </section>

      {!loading && usage && (
        <>
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
