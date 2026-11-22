import { useEffect, useId, useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { ForecastChart, type ForecastPoint } from '../components/Charts';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { forecast, useStore } from '../services/store';
import { apiGetForecast } from '../services/api';

type HorizonDays = 30 | 60 | 90;

export function ForecastPage() {
  const { state } = useStore();
  const animate = !useReducedMotion(state.settings.reducedMotionOverride);

  const [horizon, setHorizon] = useState<HorizonDays>(30);
  const [simulateLate, setSimulateLate] = useState<boolean>(false);
  const lateDays = simulateLate ? 15 : 0;

  const [serverForecast, setServerForecast] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const horizonId = useId();

  const money = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: state.settings.currency,
        maximumFractionDigits: 0,
      }),
    [state.settings.currency],
  );

  // Fetch deterministic forecast from server API
  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGetForecast(horizon, lateDays)
      .then((res) => {
        if (!active) return;
        if (res.ok && res.data) {
          setServerForecast(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [horizon, lateDays, state.invoices, state.payments, state.expenses]);

  // Fallback / standard points for the chart
  const points = useMemo<ForecastPoint[]>(() => {
    if (serverForecast?.baseline?.buckets && serverForecast.baseline.buckets.length > 0) {
      const activeScenario = simulateLate ? serverForecast.scenario : serverForecast.baseline;
      return activeScenario.buckets.map((b: any) => ({
        month: b.label,
        forecast: b.closing,
        low: Math.round(b.closing * 0.9),
        high: Math.round(b.closing * 1.1),
      }));
    }
    // Client-side fallback if server not reachable
    return forecast(horizon === 30 ? 1 : horizon === 60 ? 2 : 3, 2, state.invoices, state.expenses);
  }, [serverForecast, simulateLate, horizon, state.invoices, state.expenses]);

  const activeScenario = serverForecast
    ? simulateLate
      ? serverForecast.scenario
      : serverForecast.baseline
    : null;

  const startingCash = activeScenario?.openingBalance ?? 0;
  const expectedInflow = activeScenario?.inflows ?? 0;
  const expectedOutflow = activeScenario?.outflows ?? 0;
  const endingCash = activeScenario?.endingBalance ?? (startingCash + expectedInflow - expectedOutflow);
  const lowestCash = activeScenario?.lowestBalance ?? endingCash;
  const isShortage = lowestCash < 0;

  return (
    <div className="page forecast-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Deterministic Cash Flow Forecast</h1>
          <p className="page-subtitle">
            Dynamic {horizon}-day projections calculated from actual stored invoices, scheduled bills, and payment terms.
            {loading && <span style={{ marginLeft: 8, color: 'var(--c-accent)', fontWeight: 600 }}>• Updating projections...</span>}
          </p>
        </div>
      </header>

      {/* Horizon & What-If Scenario Controls */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label htmlFor={horizonId} style={{ fontWeight: 700, fontSize: 13, color: 'var(--c-text)' }}>
            Projection Horizon:
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {([30, 60, 90] as HorizonDays[]).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                className={horizon === h ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '6px 14px', fontSize: 13, fontWeight: 700 }}
              >
                {h} Days
              </button>
            ))}
          </div>
        </div>

        {/* 15-Day Late Payment Simulator Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 16px',
            borderRadius: 'var(--radius)',
            background: simulateLate ? 'var(--c-surface-soft)' : 'var(--c-surface)',
            border: `1.5px solid ${simulateLate ? 'var(--c-accent)' : 'var(--c-border)'}`,
            transition: 'all 0.2s ease',
          }}
        >
          <input
            id="late-simulator"
            type="checkbox"
            checked={simulateLate}
            onChange={(e) => setSimulateLate(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--c-accent)' }}
          />
          <label htmlFor="late-simulator" style={{ cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--c-text)' }}>
              15-Day Client Delay Simulator
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--c-text-2)' }}>
              Simulate cash impact if all clients remit payment 15 days late
            </span>
          </label>
        </div>
      </div>

      {/* What-If Delay Warning Alert */}
      {simulateLate && activeScenario?.pushedOutCount > 0 && (
        <div
          style={{
            padding: '14px 18px',
            marginBottom: 20,
            borderRadius: 'var(--radius)',
            background: 'var(--c-surface-soft)',
            border: '1.5px solid var(--c-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--c-accent)' }}>
              ⚠️ Late Payment Scenario Impact
            </h4>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--c-text-2)' }}>
              A 15-day client remittance delay would push <strong>{activeScenario.pushedOutCount} invoice(s)</strong> totaling{' '}
              <strong>{money.format(activeScenario.pushedOutAmount)}</strong> outside your {horizon}-day projection window.
            </p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-accent)', whiteSpace: 'nowrap' }}>
            Recommended: Send Follow-Up Reminders
          </span>
        </div>
      )}

      {/* Cash Flow Trajectory Chart */}
      <Card title={`Projected Cash Balance (${horizon} Days ${simulateLate ? '— 15-Day Delay' : '— Baseline'})`}>
        <ForecastChart data={points} animate={animate} />
      </Card>

      {/* Key Financial Projection Metrics */}
      <div className="stat-grid" style={{ marginTop: 20 }}>
        <Card title="Starting Cash Balance">
          <p className="stat-value">{money.format(startingCash)}</p>
          <span style={{ fontSize: 11.5, color: 'var(--c-text-3)' }}>Current liquid funds</span>
        </Card>

        <Card title={`Expected Inflows (${horizon}d)`}>
          <p className="stat-value" style={{ color: 'var(--c-accent)' }}>{money.format(expectedInflow)}</p>
          <span style={{ fontSize: 11.5, color: 'var(--c-text-3)' }}>From scheduled invoices</span>
        </Card>

        <Card title={`Upcoming Bills (${horizon}d)`}>
          <p className="stat-value">{money.format(expectedOutflow)}</p>
          <span style={{ fontSize: 11.5, color: 'var(--c-text-3)' }}>Expenses & studio rent</span>
        </Card>

        <Card title={`Projected Closing (${horizon}d)`}>
          <p className="stat-value" style={{ color: isShortage ? '#E11D48' : 'var(--c-text)' }}>
            {money.format(endingCash)}
          </p>
          <span style={{ fontSize: 11.5, color: isShortage ? '#E11D48' : 'var(--c-text-3)' }}>
            {isShortage ? '⚠️ Cash shortage projected' : `Lowest point: ${money.format(lowestCash)}`}
          </span>
        </Card>
      </div>
    </div>
  );
}
