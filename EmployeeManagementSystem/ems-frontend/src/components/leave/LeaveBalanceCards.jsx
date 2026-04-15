import Skeleton from '../ui/Skeleton'
import { Umbrella, Heart, Coffee, Ban, TrendingUp, Info } from 'lucide-react'

const BALANCE_ITEMS = [
  {
    key: 'annual', label: 'Annual / Earned Leave',
    icon: Umbrella, color: 'var(--accent)', bg: 'var(--accent-light)',
    totalKey: 'annualTotal', usedKey: 'annualUsed', remKey: 'annualRemaining',
    cfKey: 'annualCarriedForward', accKey: 'annualAccruedThisYear',
    carryForward: true,
    policy: '15 days/year · 1.25 days/month · Unused balance carries forward (max 15 days)',
  },
  {
    key: 'sick', label: 'Sick Leave',
    icon: Heart, color: 'var(--danger)', bg: 'var(--danger-light)',
    totalKey: 'sickTotal', usedKey: 'sickUsed', remKey: 'sickRemaining',
    cfKey: null, accKey: null,
    carryForward: false,
    policy: '6 days/year · Pro-rated from joining month · Resets Jan 1 (no carry-forward)',
  },
  {
    key: 'casual', label: 'Casual Leave',
    icon: Coffee, color: 'var(--info)', bg: 'var(--info-light)',
    totalKey: 'casualTotal', usedKey: 'casualUsed', remKey: 'casualRemaining',
    cfKey: null, accKey: null,
    carryForward: false,
    policy: '4 days/year · Pro-rated from joining month · Resets Jan 1 (no carry-forward)',
  },
  {
    key: 'unpaid', label: 'Unpaid Used',
    icon: Ban, color: 'var(--text-muted)', bg: 'var(--bg-tertiary)',
    totalKey: null, usedKey: 'unpaidUsed', remKey: null,
    cfKey: null, accKey: null,
    carryForward: false,
    policy: 'No limit · Tracked for payroll reporting',
  },
]

function getField(balance, ...keys) {
  for (const key of keys) {
    if (balance?.[key] != null) return balance[key]
  }
  return null
}

export default function LeaveBalanceCards({ balance }) {
  if (!balance) return (
    <div className="leave-balance-grid">
      {BALANCE_ITEMS.map((_, i) => (
        <div key={i} className="card" style={{ padding: 20 }}>
          <Skeleton height="16px" width="120px" style={{ marginBottom: 12 }} />
          <Skeleton height="36px" width="60px" style={{ marginBottom: 8 }} />
          <Skeleton height="8px" style={{ borderRadius: 4 }} />
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <div className="leave-balance-grid">
        {BALANCE_ITEMS.map(({ key, label, icon: Icon, color, bg, totalKey, usedKey, remKey, cfKey, accKey, carryForward, policy }) => {
          const total     = totalKey  ? getField(balance, totalKey)  : null
          const used      = getField(balance, usedKey)  ?? 0
          const remAlias  = remKey === 'annualRemaining'
            ? 'remainingAnnual'
            : remKey === 'sickRemaining'
              ? 'remainingSick'
              : remKey === 'casualRemaining'
                ? 'remainingCasual'
                : null
          const remaining = remKey    ? getField(balance, remKey, remAlias) : null
          const cf        = cfKey     ? getField(balance, cfKey)     : null
          const accrued   = accKey    ? getField(balance, accKey)    : null
          const pct       = total ? Math.min(Math.round((used / total) * 100), 100) : 0

          return (
            <div key={key} className="card leave-balance-card" style={{ position: 'relative' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={17} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {label}
                  </div>
                </div>
              </div>

              {/* Big number */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, color: remaining != null && remaining <= 1 && total ? 'var(--danger)' : color, fontFamily: 'var(--font-display)' }}>
                    {remaining ?? used}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    {remaining != null ? 'days remaining' : 'days used this year'}
                  </div>
                </div>
                {total && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{used} used</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>of {total} total</div>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {total && total > 0 && (
                <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${pct}%`,
                    background: pct >= 100 ? 'var(--danger)' : pct > 75 ? 'var(--warning)' : color,
                    transition: 'width 0.6s ease',
                  }}/>
                </div>
              )}

              {/* Breakdown for annual leave */}
              {cf != null && cf > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {accrued != null && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100,
                      background: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 600 }}>
                      {accrued} accrued this year
                    </span>
                  )}
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100,
                    background: 'var(--success-light)', color: 'var(--success)', fontWeight: 600 }}>
                    +{cf} carried forward
                  </span>
                </div>
              )}

            </div>
          )
        })}
      </div>
    </div>
  )
}
