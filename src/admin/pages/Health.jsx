import { buildHealth } from '../analytics/insights'
import { EmptyState, StatusPill } from '../components/states'
import { DataGate, Panel, Section, useAdminData } from '../components/Section'
import { formatRelativeDate } from '../../lib/constants'

/* Subsystem status, with "غير معروف" as a real answer.

   A row with no telemetry is grey, never green: an all-clear the product
   cannot actually verify is the most dangerous thing a health page can
   show, because it stops the owner from looking. */
export function Health() {
  const { metrics, loading, error, refresh, range } = useAdminData()
  const rows = loading ? [] : buildHealth(metrics)

  return (
    <DataGate error={error} refresh={refresh}>
      <Section
        title="صحة النظام"
        en="System Health"
        purpose="حالة الأنظمة الفرعية خلال الفترة المختارة. الرمادي يعني ما نقيسه — مو إنه سليم."
      >
        <Panel wide>
          {loading ? (
            <div className="ad-panel-loading" />
          ) : rows.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="ad-health">
              {rows.map((row) => (
                <li key={row.key} className={`ad-health-row is-${row.status}`}>
                  <div className="ad-health-name">
                    <strong>{row.label}</strong>
                    <span>{row.en}</span>
                  </div>
                  <p className="ad-health-detail">{row.detail}</p>
                  <div className="ad-health-status">
                    <StatusPill status={row.status} />
                    {row.lastEvent && <span className="ad-health-time">آخر حدث: {formatRelativeDate(row.lastEvent)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="نطاق البيانات">
          <dl className="ad-defs">
            <div>
              <dt>الفترة</dt>
              <dd>{range?.preset?.label ?? '—'}</dd>
            </div>
            <div>
              <dt>آخر حساب</dt>
              <dd>{metrics?.generatedAt ? formatRelativeDate(metrics.generatedAt) : '—'}</dd>
            </div>
          </dl>
        </Panel>
      </Section>
    </DataGate>
  )
}
