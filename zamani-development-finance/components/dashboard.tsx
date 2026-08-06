"use client";

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { Landmark, Wallet, Users, Package, type LucideIcon } from 'lucide-react'
import { CommandBar, useClickOutside } from './command-bar'
import { AiWidget } from './ai-widget'
import { AnimatedNumber } from './animated-kpi'

// ─── Types ───────────────────────────────────────────────────────────────────

export type RiskPriority = 'high' | 'medium' | 'low'
export type RiskStatus = 'open' | 'investigating' | 'escalated' | 'resolved'
export type DomainKey = 'lending' | 'finance' | 'partners' | 'procurement'
// What kind of consequence a risk represents - the Risk Center filters on
// this (not severity) so a click answers "show me the money problems" rather
// than just "show me the bad ones".
export type RiskCategory = 'money' | 'credit' | 'compliance' | 'reporting'
type RiskFilter = 'all' | RiskCategory

export interface RiskEvidence {
  time: string
  note: string
  source: string
}

export interface Risk {
  id: string
  priority: RiskPriority
  status: RiskStatus
  title: string
  subtitle: string
  description: string
  time: string
  impactLevel: string
  impactAreas: string[]
  category: RiskCategory
  /** Names what the row's button actually does ("Chase the partner"),
   * never a generic "Investigate". */
  actionLabel: string
  /** Real money genuinely stuck or overspent because of this issue - omitted
   * where the issue isn't a money event. */
  impactAmount?: number
  /** The presented day-count behind `time` - omitted where there's no "age"
   * to the issue. */
  ageDays?: number
  aiAnalysis: string
  evidence: RiskEvidence[]
  assignedTo?: string
  recommendedActions: { label: string; urgency: 'immediate' | 'soon' | 'watch' }[]
}

export interface Domain {
  key: DomainKey
  label: string
  score: number
  trend: 'up' | 'down' | 'stable'
  trendValue: string
  status: 'healthy' | 'attention' | 'critical'
  aiSummary: string
  kpis: { key: string; label: string; value: string; delta?: string; deltaDir?: 'up' | 'down'; deltaGood?: boolean; href?: string }[]
  /** Compact-tile facts for the Executive Overview's Domain Overview card - a
   * real headline figure, a real supporting detail, and a status driven by a
   * stated threshold rather than the composite score above. */
  tileHeadline: string
  tileSupporting: string
  tileStatusTone: 'healthy' | 'attention' | 'critical'
}

export interface TimelineEvent {
  time: string
  description: string
  category: string
  aiGenerated?: boolean
}

export interface BriefPoint {
  tone: 'good' | 'watch' | 'critical'
  lead: string
  detail: string
}

export interface DashboardProps {
  greetingName: string
  briefSummary: string
  briefPoints: BriefPoint[]
  asOfLabel: string
  domains: Domain[]
  risks: Risk[]
  timeline: TimelineEvent[]
  lapsedApprovalsCount: number
  overduePartnersCount: number
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'healthy' | 'attention' | 'critical' }) {
  const colors = { healthy: '#059669', attention: '#D97706', critical: '#DC2626' }
  if (status === 'critical') return <LiveDot color={colors.critical} size={8} />
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status], display: 'inline-block', flexShrink: 0 }} />
}

/** A small pulsing "alive" dot - a static ring animates outward and fades
 * while a solid center dot stays put, the standard "live"/"recording"
 * pattern. Used for critical alerts (to read as genuinely alarming) and for
 * "this data is being watched" signals elsewhere in the UI. */
function LiveDot({ color = '#0F8A4B', size = 8 }: { color?: string; size?: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
      <motion.span
        style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }}
        animate={{ scale: [1, 2.4, 1], opacity: [0.55, 0, 0.55] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span style={{ position: 'relative', width: size, height: size, borderRadius: '50%', background: color }} />
    </span>
  )
}

export function AiBadge({ label = 'Ada' }: { label?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'linear-gradient(135deg,#E7F6ED,#E8F0FF)', border: '1px solid rgba(15, 138, 75,0.2)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0F8A4B', fontFamily: 'Inter', letterSpacing: '0.04em' }}>
      ✦ {label}
    </span>
  )
}

/** A real multi-segment breakdown ring - each wedge is an actual count from a
 * real bucket (risk priority, domain status...), never a blended index. Reads
 * as the same "beautiful ring" language as the rest of the app (MiniRing,
 * LiveDot) while staying traceable: point at any wedge and name what it is. */
function SegmentRing({
  segments,
  size = 96,
  strokeWidth = 10,
  centerValue,
  centerLabel,
}: {
  segments: { value: number; color: string }[]
  size?: number
  strokeWidth?: number
  centerValue: string
  centerLabel: string
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  let offsetAccum = 0
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F7" strokeWidth={strokeWidth} />
        {total > 0 &&
          segments.map((seg, i) => {
            if (seg.value <= 0) return null
            const segLen = (seg.value / total) * circ
            const startOffset = -offsetAccum
            offsetAccum += segLen
            return (
              <motion.circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
                strokeDasharray={`${segLen} ${circ - segLen}`}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: startOffset }}
                transition={{ duration: 0.9, delay: i * 0.12, ease: [0.4, 0, 0.2, 1] }}
              />
            )
          })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: `0 ${strokeWidth + 4}px` }}>
        <AnimatedNumber value={centerValue} style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: size * 0.24, fontWeight: 700, color: '#0A0E1A', letterSpacing: '-0.01em', lineHeight: 1 }} />
        <span style={{ fontSize: Math.max(8.5, size * 0.08), color: '#6B7A94', fontFamily: 'Inter', lineHeight: 1.15, marginTop: 3, whiteSpace: 'nowrap' }}>{centerLabel}</span>
      </div>
    </div>
  )
}


// ─── Risk Detail Panel ────────────────────────────────────────────────────────

const ASSIGNMENT_TEAMS = ['Credit & Risk', 'Finance & Treasury', 'Partner Relations', 'Procurement', 'Executive Office']
const BRIEF_TONE_COLORS: Record<'good' | 'watch' | 'critical', string> = { good: '#1A2035', watch: '#B45309', critical: '#B91C1C' }
// A bare system name ("Lending", "Procurement"...) tells a first-time viewer
// nothing about what it covers or why it matters - these frame each domain as
// the plain-English question it actually answers, the same way a human
// walkthrough of this dashboard would introduce it before showing the number.
export const DOMAIN_TAGLINES: Record<DomainKey, string> = {
  lending: 'Are we lending, and is it coming back?',
  finance: 'Where does our money stand — coming in and going out?',
  partners: 'Are our partner institutions performing, and reporting reliably?',
  procurement: "What's moving through procurement, and is it compliant?",
}
// The Decision Workspaces card and the "Where things stand" tile above it
// must never disagree on status - but they used to repeat the exact same
// headline fact too, which just reads as clutter. Each card here leads with
// a different real KPI (already computed, already on domain.kpis) so opening
// the workspace answers a genuinely new question instead of restating one.
const DOMAIN_HEADLINE_KPI_KEY: Record<DomainKey, string> = {
  lending: 'mandate-reach',
  finance: 'funding-liquidity',
  partners: 'probation-exposure',
  procurement: 'vendor-compliance',
}
// One real icon per domain, used everywhere a domain needs identity (domain
// cards, health-card tiles, the workspace panel header) instead of the
// hand-picked Unicode glyphs (◈ ◎ ⬡ ◇) used previously - those read as a
// placeholder next to the real lucide icons the persona pages already use.
const DOMAIN_ICON_COMPONENT: Record<DomainKey, LucideIcon> = {
  lending: Landmark,
  finance: Wallet,
  partners: Users,
  procurement: Package,
}
// Risk.subtitle carries the real source-system name, not a DomainKey, so it
// needs its own lookup - same icons as DOMAIN_ICON_COMPONENT above, for one
// consistent icon language across the app.
const RISK_SOURCE_ICON: Record<string, LucideIcon> = {
  'ZDF (CMS)': Landmark,
  'Microsoft Dynamics (ERP)': Wallet,
  'ZDF PFI Partners Portal': Users,
  'ZDF e-Procurement Portal': Package,
}
// Filter-chip identity for the Risk Center - by consequence, not severity, so
// picking one answers "what kind of problem is this" rather than "how bad is
// it" (severity is still visible via each card's colour bar and status pill).
const CATEGORY_LABELS: Record<RiskCategory, string> = { money: 'Money held', credit: 'Credit', compliance: 'Compliance', reporting: 'Reporting' }
const CATEGORY_COLORS: Record<RiskCategory, string> = { money: '#0F8A4B', credit: '#B91C1C', compliance: '#B45309', reporting: '#2563EB' }
// Mount-triggered (not scroll-triggered) stagger, deliberately not the
// shared AnimatedGrid/AnimatedGridItem: those use `whileInView`+`once`, which
// is right for static content but wrong here - this grid's contents change
// via filter clicks, not scrolling, and a card can end up positioned oddly
// relative to the viewport right after a click. `whileInView` doesn't
// reliably re-fire for that case and can leave a card stuck invisible
// (confirmed: opacity stayed 0 indefinitely). Animating on mount instead
// means every filter change - which always remounts this grid, see the
// `${riskFilter}-${tier}` key below - animates in correctly regardless of
// scroll position.
const riskGridContainer: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const riskGridItem: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }
const formatNaira = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}bn`
  if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}m`
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
}

function RiskDetailPanel({
  risk,
  onClose,
  onStatusChange,
  onAskAI,
  onAssign,
}: {
  risk: Risk
  onClose: () => void
  onStatusChange: (id: string, status: RiskStatus) => void
  onAskAI: (question: string) => void
  onAssign: (id: string, team: string) => void
}) {
  const priorityColors: Record<RiskPriority, { bg: string; text: string; border: string }> = {
    high: { bg: 'rgba(220,38,38,0.07)', text: '#B91C1C', border: 'rgba(220,38,38,0.2)' },
    medium: { bg: 'rgba(217,119,6,0.07)', text: '#B45309', border: 'rgba(217,119,6,0.2)' },
    low: { bg: 'rgba(5,150,105,0.07)', text: '#047857', border: 'rgba(5,150,105,0.2)' },
  }
  const statusFlow: RiskStatus[] = ['open', 'investigating', 'escalated', 'resolved']
  const statusLabels: Record<RiskStatus, string> = { open: 'Open', investigating: 'Investigating', escalated: 'Escalated', resolved: 'Resolved' }
  const urgencyColors: Record<string, { bg: string; text: string }> = {
    immediate: { bg: 'rgba(220,38,38,0.07)', text: '#B91C1C' },
    soon: { bg: 'rgba(15, 138, 75,0.07)', text: '#0F8A4B' },
    watch: { bg: 'rgba(107,122,148,0.07)', text: '#6B7A94' },
  }
  const pc = priorityColors[risk.priority]
  const evidenceRef = useRef<HTMLDivElement>(null)
  const [doneActions, setDoneActions] = useState<Set<string>>(new Set())
  const toggleActionDone = (label: string) => {
    setDoneActions((prev) => {
      const next = new Set(prev)
      const key = `${risk.id}::${label}`
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const doneCount = risk.recommendedActions.filter((a) => doneActions.has(`${risk.id}::${a.label}`)).length
  const [assignOpen, setAssignOpen] = useState(false)
  const assignRef = useClickOutside(() => setAssignOpen(false))

  const downloadRiskReport = () => {
    const lines = [
      `RISK REPORT — ${risk.title}`,
      `Priority: ${risk.priority.toUpperCase()} · Status: ${statusLabels[risk.status]} · ${risk.subtitle} · ${risk.time}`,
      '',
      risk.aiAnalysis,
      '',
      'EVIDENCE',
      ...risk.evidence.map((e) => `- [${e.time}] (${e.source}) ${e.note}`),
      '',
      'RECOMMENDED ACTIONS',
      ...risk.recommendedActions.map((a) => `- [${a.urgency}] ${a.label}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `risk-${risk.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="workspace-overlay" onClick={onClose} />
      <div className="workspace-panel" style={{ width: 'min(720px, 100vw)' }}>
        {/* Header */}
        <div style={{ padding: '28px 32px 22px', background: 'white', borderBottom: '1px solid rgba(10,14,26,0.07)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7A94', letterSpacing: '0.08em', fontFamily: 'Inter', textTransform: 'uppercase' }}>Risk Investigation</span>
            </div>
            <button onClick={onClose} style={{ background: '#F4F6F9', border: 'none', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18, color: '#6B7A94' }}>×</button>
          </div>
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#0A0E1A', margin: '0 0 14px', letterSpacing: '-0.02em', lineHeight: 1.25 }}>{risk.title}</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'Inter', background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}>
              {risk.priority === 'high' ? 'High Priority' : risk.priority === 'medium' ? 'Medium' : 'Low'}
            </span>
            <span style={{ fontSize: 11, color: '#6B7A94', fontFamily: 'Inter', background: '#F4F6F9', padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(10,14,26,0.07)' }}>{risk.subtitle}</span>
            <span style={{ fontSize: 11, color: '#6B7A94', fontFamily: 'Inter' }}>{risk.time}</span>
          </div>

          {/* Status stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 18 }}>
            {statusFlow.map((s, i) => {
              const isActive = s === risk.status
              const isPast = statusFlow.indexOf(risk.status) > i
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < statusFlow.length - 1 ? 1 : undefined }}>
                  <button
                    onClick={() => onStatusChange(risk.id, s)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 20,
                      border: isActive ? '1.5px solid #0F8A4B' : '1px solid rgba(10,14,26,0.1)',
                      background: isActive ? '#E7F6ED' : isPast ? '#F0F9F4' : 'white',
                      color: isActive ? '#0F8A4B' : isPast ? '#059669' : '#6B7A94',
                      fontSize: 11,
                      fontWeight: isActive ? 700 : 500,
                      fontFamily: 'Inter',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isPast && !isActive ? '✓ ' : ''}{statusLabels[s]}
                  </button>
                  {i < statusFlow.length - 1 && (
                    <div style={{ flex: 1, height: 1, background: isPast ? 'rgba(5,150,105,0.3)' : 'rgba(10,14,26,0.08)', margin: '0 4px' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ padding: 32 }}>

          {/* Impact */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ background: 'white', border: '1px solid rgba(10,14,26,0.07)', borderRadius: 10, padding: '12px 16px', flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 10, color: '#6B7A94', fontFamily: 'Inter', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Impact Level</div>
                <div className="font-display" style={{ fontSize: 17, fontWeight: 700, color: '#0A0E1A' }}>{risk.impactLevel}</div>
              </div>
              <div style={{ background: 'white', border: '1px solid rgba(10,14,26,0.07)', borderRadius: 10, padding: '12px 16px', flex: 2 }}>
                <div style={{ fontSize: 10, color: '#6B7A94', fontFamily: 'Inter', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Areas Affected</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {risk.impactAreas.map((a) => (
                    <span key={a} style={{ fontSize: 11, background: '#F4F6F9', border: '1px solid rgba(10,14,26,0.08)', borderRadius: 5, padding: '2px 8px', color: '#2D3748', fontFamily: 'Inter' }}>{a}</span>
                  ))}
                </div>
              </div>
              {risk.assignedTo && (
                <div style={{ background: 'white', border: '1px solid rgba(10,14,26,0.07)', borderRadius: 10, padding: '12px 16px', flex: 1.5 }}>
                  <div style={{ fontSize: 10, color: '#6B7A94', fontFamily: 'Inter', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assigned To</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0A0E1A', fontFamily: 'Inter' }}>{risk.assignedTo}</div>
                </div>
              )}
            </div>
          </div>

          {/* AI Analysis */}
          <div style={{ marginBottom: 24 }}>
            <div className="ai-glow" style={{ borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <AiBadge label="Ada's Analysis" />
                <span style={{ fontSize: 11, color: '#6B7A94', fontFamily: 'Inter' }}>Based on historical patterns and live data</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: '#1A2035', margin: '0 0 14px', fontFamily: 'Inter' }}>{risk.aiAnalysis}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="ghost-btn" onClick={() => evidenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} style={{ padding: '5px 12px', fontSize: 12 }}>Show evidence</button>
                {[
                  { label: 'Why did this happen?', question: `Why did this happen: "${risk.title}"? Walk through the root cause using the evidence trail.` },
                  { label: 'Forecast impact', question: `Forecast the likely impact of "${risk.title}" if it isn't addressed in the next 30 days.` },
                  { label: 'Compare to past incidents', question: `Are there similar risks to "${risk.title}" currently in the register? Compare them.` },
                ].map((a) => (
                  <button key={a.label} className="ghost-btn" onClick={() => onAskAI(a.question)} style={{ padding: '5px 12px', fontSize: 12 }}>{a.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Evidence Timeline */}
          <div ref={evidenceRef} style={{ marginBottom: 24, scrollMarginTop: 20 }}>
            <h3 className="font-display" style={{ fontSize: 13, fontWeight: 700, color: '#6B7A94', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>Evidence Trail</h3>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, width: 1, background: 'rgba(10,14,26,0.07)' }} />
              {risk.evidence.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 32, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 3 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.source === 'Copilot' ? '#D97706' : '#0F8A4B', border: '2px solid white', boxShadow: '0 0 0 1px rgba(10,14,26,0.1)', zIndex: 1, position: 'relative' }} />
                  </div>
                  <div style={{ flex: 1, background: 'white', border: '1px solid rgba(10,14,26,0.07)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#6B7A94', fontFamily: '"JetBrains Mono",monospace', letterSpacing: '0.04em' }}>{ev.time}</span>
                      <span style={{ fontSize: 10, color: ev.source === 'Copilot' ? '#D97706' : '#0F8A4B', fontWeight: 600, fontFamily: 'Inter', background: ev.source === 'Copilot' ? 'rgba(217,119,6,0.08)' : 'rgba(15, 138, 75,0.06)', padding: '1px 7px', borderRadius: 4 }}>{ev.source}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#1A2035', lineHeight: 1.5, fontFamily: 'Inter' }}>{ev.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Actions */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 className="font-display" style={{ fontSize: 13, fontWeight: 700, color: '#6B7A94', letterSpacing: '0.07em', textTransform: 'uppercase', margin: 0 }}>Recommended Actions</h3>
              {risk.recommendedActions.length > 0 && (
                <span style={{ fontSize: 11, color: '#6B7A94', fontFamily: 'Inter' }}>{doneCount} of {risk.recommendedActions.length} done</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {risk.recommendedActions.map((action) => {
                const uc = urgencyColors[action.urgency]
                const done = doneActions.has(`${risk.id}::${action.label}`)
                return (
                  <button
                    key={action.label}
                    onClick={() => toggleActionDone(action.label)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: done ? '#F0F9F4' : 'white', border: done ? '1px solid rgba(5,150,105,0.25)' : '1px solid rgba(10,14,26,0.07)', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', transition: 'all 0.15s', width: '100%', textAlign: 'left', fontFamily: 'Inter' }}
                  >
                    <span style={{ fontSize: 13, color: done ? '#059669' : '#0A0E1A', fontFamily: 'Inter', textDecoration: done ? 'line-through' : 'none' }}>{action.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: done ? '#059669' : uc.text, background: done ? 'rgba(5,150,105,0.1)' : uc.bg, padding: '2px 8px', borderRadius: 5, fontWeight: 600, fontFamily: 'Inter' }}>{done ? 'Done' : action.urgency.charAt(0).toUpperCase() + action.urgency.slice(1)}</span>
                      <span style={{ color: '#0F8A4B', fontSize: 14 }}>{done ? '✓' : '→'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Actions footer */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid rgba(10,14,26,0.07)' }}>
            <button className="ms-blue-btn" onClick={() => onStatusChange(risk.id, 'escalated')} style={{ padding: '9px 18px' }}>Escalate to Board</button>
            <div ref={assignRef} style={{ position: 'relative' }}>
              <button className="ghost-btn" onClick={() => setAssignOpen((v) => !v)} style={{ padding: '9px 18px' }}>
                {risk.assignedTo ? `Assigned: ${risk.assignedTo}` : 'Assign to Team'}
              </button>
              {assignOpen && (
                <div className="dropdown-pop" style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, width: 200, background: 'white', border: '1px solid rgba(10,14,26,0.08)', borderRadius: 10, boxShadow: '0 8px 24px rgba(10,14,26,0.12)', padding: 6, zIndex: 30 }}>
                  {ASSIGNMENT_TEAMS.map((team) => {
                    const active = team === risk.assignedTo
                    return (
                      <button
                        key={team}
                        onClick={() => { onAssign(risk.id, team); setAssignOpen(false) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 6, border: 'none', background: active ? '#E7F6ED' : 'transparent', color: active ? '#0F8A4B' : '#0A0E1A', fontSize: 12, fontWeight: active ? 700 : 500, fontFamily: 'Inter', cursor: 'pointer' }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#F4F6F9' }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                      >
                        {team}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <button className="ghost-btn" onClick={downloadRiskReport} style={{ padding: '9px 18px' }}>Generate Report</button>
            <button onClick={() => onStatusChange(risk.id, 'resolved')} style={{ padding: '9px 18px', background: 'transparent', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#047857', fontFamily: 'Inter', cursor: 'pointer' }}>Mark Resolved</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Domain Workspace Panel ───────────────────────────────────────────────────

function WorkspacePanel({ domain, onClose, onAskAI }: { domain: Domain; onClose: () => void; onAskAI: (question: string) => void }) {
  const statusColors = { healthy: '#059669', attention: '#D97706', critical: '#DC2626' }
  const statusLabels = { healthy: 'Healthy', attention: 'Needs Attention', critical: 'Critical' }

  // Real .ics download - same "real artifact" pattern as the report/register
  // exports elsewhere, since there's no real calendar/stakeholder system to
  // book against here.
  const scheduleStakeholderReview = () => {
    const now = new Date()
    const start = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    start.setHours(10, 0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Zamani Development Finance//Enterprise Intelligence Platform//EN',
      'BEGIN:VEVENT',
      `UID:${domain.key}-stakeholder-review-${Date.now()}@zamani-df`,
      `DTSTAMP:${fmt(now)}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${domain.label} — Stakeholder Review`,
      `DESCRIPTION:${domain.aiSummary.replace(/\r?\n/g, ' ')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${domain.key}-stakeholder-review.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadDomainReport = () => {
    const lines = [
      `${domain.label} — DOMAIN REPORT`,
      `Status: ${statusLabels[domain.tileStatusTone]} · ${domain.tileHeadline}`,
      '',
      domain.aiSummary,
      '',
      'KEY PERFORMANCE INDICATORS',
      ...domain.kpis.map((k) => `- ${k.label}: ${k.value}${k.delta ? ` (${k.delta})` : ''}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${domain.key}-domain-report.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="workspace-overlay" onClick={onClose} />
      <div className="workspace-panel" style={{ width: 'min(680px, 100vw)' }}>
        <div style={{ padding: '28px 32px 24px', background: 'white', borderBottom: '1px solid rgba(10,14,26,0.07)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                {(() => { const Icon = DOMAIN_ICON_COMPONENT[domain.key]; return <Icon size={20} color="#0F8A4B" strokeWidth={2} /> })()}
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7A94', letterSpacing: '0.08em', fontFamily: 'Inter', textTransform: 'uppercase' }}>Decision Workspace</span>
              </div>
              <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: '#0A0E1A', margin: 0 }}>{domain.label}</h2>
              <p style={{ fontSize: 13.5, color: '#6B7A94', fontFamily: 'Inter', margin: '4px 0 0' }}>{DOMAIN_TAGLINES[domain.key]}</p>
            </div>
            <button onClick={onClose} style={{ background: '#F4F6F9', border: 'none', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18, color: '#6B7A94' }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${statusColors[domain.tileStatusTone]}14`, border: `1px solid ${statusColors[domain.tileStatusTone]}30`, borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, color: statusColors[domain.tileStatusTone] }}>
              <StatusDot status={domain.tileStatusTone} />{statusLabels[domain.tileStatusTone]}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F4F6F9', border: '1px solid rgba(10,14,26,0.07)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#6B7A94' }}>
              {domain.tileHeadline}
            </span>
          </div>
        </div>
        <div style={{ padding: 32 }}>
          <div style={{ marginBottom: 28 }}>
            <div className="ai-glow" style={{ borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><AiBadge label="Ada's Take" /></div>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: '#1A2035', margin: 0, fontFamily: 'Inter' }}>{domain.aiSummary}</p>
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="ghost-btn" onClick={downloadDomainReport} style={{ padding: '5px 12px', fontSize: 12 }}>Generate report</button>
                {[
                  { label: 'Explain this', question: `Explain why the ${domain.label} domain is marked ${statusLabels[domain.tileStatusTone]} — ${domain.tileHeadline}, ${domain.tileSupporting} — and what to do about it.` },
                  { label: 'Forecast', question: `Based on current data, forecast how the ${domain.label} domain is likely to trend over the next quarter.` },
                ].map((a) => (
                  <button key={a.label} className="ghost-btn" onClick={() => onAskAI(a.question)} style={{ padding: '5px 12px', fontSize: 12 }}>{a.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 28 }}>
            <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, color: '#6B7A94', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Key Performance Indicators</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
              {domain.kpis.map((kpi) => {
                const cardStyle: React.CSSProperties = { background: 'white', border: '1px solid rgba(10,14,26,0.07)', borderRadius: 12, padding: '16px 18px', display: 'block', textDecoration: 'none' }
                const content = (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontSize: 11, color: '#6B7A94', marginBottom: 6, fontFamily: 'Inter' }}>{kpi.label}</div>
                      {kpi.href && <span style={{ fontSize: 11, color: '#0F8A4B', fontFamily: 'Inter', flexShrink: 0 }}>Drill in →</span>}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#0A0E1A', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>{kpi.value}</div>
                    {kpi.delta && <div style={{ fontSize: 11, marginTop: 4, color: kpi.deltaGood ? '#059669' : '#DC2626', fontWeight: 500 }}>{kpi.deltaDir === 'up' ? '↑' : '↓'} {kpi.delta} vs last period</div>}
                  </>
                )
                return kpi.href ? (
                  <Link key={kpi.label} href={kpi.href} style={{ ...cardStyle, cursor: 'pointer' }}>
                    {content}
                  </Link>
                ) : (
                  <div key={kpi.label} style={cardStyle}>
                    {content}
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ marginBottom: 28 }}>
            <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, color: '#6B7A94', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Recommended Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[{ label: 'Review detailed performance breakdown', urgency: 'Now' }, { label: 'Request AI-generated executive summary', urgency: 'Suggested' }, { label: 'Schedule stakeholder review', urgency: 'This week' }].map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    if (action.label.startsWith('Review')) document.querySelector('h3')?.scrollIntoView({ behavior: 'smooth' })
                    else if (action.label.startsWith('Request')) onAskAI(`Generate an executive summary for the ${domain.label} domain — current performance, key risks, and recommended next steps, grounded in the real KPI data.`)
                    else scheduleStakeholderReview()
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', border: '1px solid rgba(10,14,26,0.07)', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'Inter' }}
                >
                  <span style={{ fontSize: 13, color: '#0A0E1A', fontFamily: 'Inter' }}>{action.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: '#6B7A94', background: '#F4F6F9', padding: '2px 8px', borderRadius: 4 }}>{action.urgency}</span>
                    <span style={{ color: '#0F8A4B', fontSize: 14 }}>→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Enterprise Health Card (premium redesign) ────────────────────────────────

function EnterpriseHealthCard({
  domains,
  attentionSummary,
  asOfLabel,
  onDomainClick,
}: {
  domains: Domain[]
  attentionSummary: string
  asOfLabel: string
  onDomainClick: (key: DomainKey) => void
}) {
  // A deliberately different, deeper tone family from the bright red/amber/
  // green used by the risk-priority ring on the card beside this one - same
  // severity language (red=critical, amber=watch, green=on track), just a
  // visually distinct palette so the two rings don't read as one repeated.
  const statusColors = { healthy: '#047857', attention: '#B45309', critical: '#B91C1C' }
  const statusChipLabels = { healthy: 'On track', attention: 'Watch', critical: 'Needs attention' }
  const onTrackCount = domains.filter((d) => d.tileStatusTone === 'healthy').length
  const watchCount = domains.filter((d) => d.tileStatusTone === 'attention').length
  const criticalCount = domains.filter((d) => d.tileStatusTone === 'critical').length
  const attentionCount = watchCount + criticalCount
  const [explainOpen, setExplainOpen] = useState(false)
  const explainRef = useClickOutside(() => setExplainOpen(false))

  return (
    <div className="enterprise-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Card top bar */}
      <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid rgba(10,14,26,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7A94', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Inter', marginBottom: 3 }}>Across the organisation</div>
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: '#0A0E1A', margin: 0, letterSpacing: '-0.01em' }}>Where things stand</h3>
          </div>
          <div ref={explainRef} style={{ position: 'relative' }}>
            <button className="ghost-btn" onClick={() => setExplainOpen((v) => !v)} style={{ padding: '4px 10px', fontSize: 11 }}>✦ Explain</button>
            {explainOpen && (
              <div className="dropdown-pop" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 280, background: 'white', border: '1px solid rgba(10,14,26,0.08)', borderRadius: 10, boxShadow: '0 8px 24px rgba(10,14,26,0.12)', padding: 12, zIndex: 30 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A94', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Inter', marginBottom: 8 }}>
                  Why each status
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {domains.map((d) => (
                    <div key={d.key} style={{ fontSize: 12, lineHeight: 1.5, fontFamily: 'Inter' }}>
                      <span style={{ fontWeight: 700, color: '#0A0E1A' }}>{d.label} — </span>
                      <span style={{ color: '#6B7A94' }}>{d.tileHeadline}, {d.tileSupporting}.</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real domain-status breakdown, not a composite score - a different real
          count from the risk-priority ring on the card beside this one, so
          the two don't read as the same fact shown twice. */}
      <div style={{ padding: '18px 24px', background: attentionCount > 0 ? 'linear-gradient(160deg, #FFFBEB 0%, #FEF3E2 100%)' : 'linear-gradient(160deg, #F6FBF7 0%, #E7F6ED 100%)', borderBottom: '1px solid rgba(10,14,26,0.06)', display: 'flex', alignItems: 'center', gap: 18 }}>
        <SegmentRing
          size={88}
          strokeWidth={9}
          segments={[
            { value: criticalCount, color: statusColors.critical },
            { value: watchCount, color: statusColors.attention },
            { value: onTrackCount, color: statusColors.healthy },
          ]}
          centerValue={String(attentionCount)}
          centerLabel="areas"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: attentionCount > 0 ? '#B45309' : '#059669', fontFamily: 'Inter' }}>
            {attentionCount === 0 ? 'Every area is on track' : `${attentionCount} area${attentionCount === 1 ? '' : 's'} need${attentionCount === 1 ? 's' : ''} attention`}
          </div>
          <div style={{ fontSize: 12, color: '#6B7A94', fontFamily: 'Inter', marginTop: 2 }}>{attentionSummary}</div>
        </div>
      </div>

      {/* Domain tiles - a real headline figure, a real supporting fact, a
          status chip driven by a stated threshold. No /100 ring, no score. */}
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 0 }}>
        {domains.map((d, i) => {
          const isBottom = i >= domains.length - 2
          const isRight = i % 2 === 1
          return (
            <div
              key={d.key}
              onClick={() => onDomainClick(d.key)}
              title={`${d.label} system · data as of ${asOfLabel}`}
              style={{
                padding: '16px 18px',
                borderBottom: isBottom ? 'none' : '1px solid rgba(10,14,26,0.06)',
                borderRight: isRight ? 'none' : '1px solid rgba(10,14,26,0.06)',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFD')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg,#E7F6ED,#DCF3E3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F8A4B', flexShrink: 0 }}>
                    {(() => { const Icon = DOMAIN_ICON_COMPONENT[d.key]; return <Icon size={12} strokeWidth={2.25} /> })()}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#6B7A94', fontFamily: 'Inter' }}>{d.label}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: statusColors[d.tileStatusTone], background: `${statusColors[d.tileStatusTone]}12`, border: `1px solid ${statusColors[d.tileStatusTone]}30`, borderRadius: 5, padding: '1px 7px', fontFamily: 'Inter', flexShrink: 0 }}>
                  <StatusDot status={d.tileStatusTone} />{statusChipLabels[d.tileStatusTone]}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
                <div>
                  <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: '#0A0E1A', letterSpacing: '-0.01em', lineHeight: 1.25, marginBottom: 3 }}>{d.tileHeadline}</div>
                  <div style={{ fontSize: 11.5, color: '#6B7A94', fontFamily: 'Inter' }}>{d.tileSupporting}</div>
                </div>
                <span aria-hidden style={{ color: '#0F8A4B', fontSize: 15, flexShrink: 0, opacity: 0.6 }}>↗</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(10,14,26,0.06)', background: '#FAFBFD', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#6B7A94', fontFamily: 'Inter' }}>Data as of {asOfLabel} · Microsoft Fabric</span>
        <a href="#business-domains" style={{ fontSize: 11, color: '#0F8A4B', fontFamily: 'Inter', fontWeight: 500, textDecoration: 'none' }}>See all areas →</a>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export function Dashboard({ greetingName, briefSummary, briefPoints, asOfLabel, domains, risks: initialRisks, timeline, lapsedApprovalsCount, overduePartnersCount }: DashboardProps) {
  const [activeWorkspace, setActiveWorkspace] = useState<Domain | null>(null)
  const [activeRisk, setActiveRisk] = useState<Risk | null>(null)
  const [risks, setRisks] = useState<Risk[]>(initialRisks)
  const [aiOpen, setAiOpen] = useState(false)
  const [briefIndex, setBriefIndex] = useState(0)
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
  const askAI = (question?: string) => {
    if (question) setPendingQuestion(question)
    setAiOpen(true)
  }
  const [currentTime, setCurrentTime] = useState(new Date())
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
  const [showResolvedOnly, setShowResolvedOnly] = useState(false)
  const [timelineExpanded, setTimelineExpanded] = useState(false)
  const [recommendOpen, setRecommendOpen] = useState(false)
  const recommendRef = useClickOutside(() => setRecommendOpen(false))

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // Rotates the executive brief through its real, already-computed points
  // rather than showing one static paragraph forever - the card should read
  // as actively watching the data, not a one-time snapshot.
  useEffect(() => {
    if (briefPoints.length <= 1) return
    const t = setInterval(() => setBriefIndex((i) => (i + 1) % briefPoints.length), 20000)
    return () => clearInterval(t)
  }, [briefPoints.length])

  // Real, addressable domain-view navigation: /?domain=finance opens straight
  // to that workspace on load, so the command bar's tabs and search results
  // produce shareable URLs instead of only client-side-only modal state.
  useEffect(() => {
    const domainKey = new URLSearchParams(window.location.search).get('domain')
    if (!domainKey) return
    const domain = domains.find((d) => d.key === domainKey)
    if (domain) setActiveWorkspace(domain)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const timeStr = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateStr = currentTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const hour = currentTime.getHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  const handleStatusChange = (id: string, status: RiskStatus) => {
    setRisks((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    if (activeRisk?.id === id) setActiveRisk((r) => r ? { ...r, status } : r)
  }

  const handleAssign = (id: string, team: string) => {
    setRisks((prev) => prev.map((r) => (r.id === id ? { ...r, assignedTo: team } : r)))
    if (activeRisk?.id === id) setActiveRisk((r) => r ? { ...r, assignedTo: team } : r)
  }

  const baseFilteredRisks = riskFilter === 'all' ? risks : risks.filter((r) => r.category === riskFilter)
  const filteredRisks = showResolvedOnly ? baseFilteredRisks.filter((r) => r.status === 'resolved') : baseFilteredRisks

  // Register-level facts, not a severity mix - what's actually at stake
  // (money) and how stale the oldest open item is, so the header answers
  // "should I care" before a reader opens a single card.
  const categoryCounts: Record<RiskFilter, number> = {
    all: risks.length,
    money: risks.filter((r) => r.category === 'money').length,
    credit: risks.filter((r) => r.category === 'credit').length,
    compliance: risks.filter((r) => r.category === 'compliance').length,
    reporting: risks.filter((r) => r.category === 'reporting').length,
  }
  const heldUpTotal = risks.reduce((s, r) => s + (r.impactAmount ?? 0), 0)
  const oldestAgeDays = risks.reduce((m, r) => Math.max(m, r.ageDays ?? 0), 0)

  const exportRiskRegister = () => {
    const header = 'id,category,priority,status,title,subtitle,time,impact_level'
    const rows = filteredRisks.map((r) =>
      [r.id, r.category, r.priority, r.status, r.title, r.subtitle, r.time, r.impactLevel].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zamani-risk-register-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const mostUrgentRisk = [...risks].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 }
    return rank[a.priority] - rank[b.priority]
  })[0]

  const riskCounts = {
    all: risks.length,
    high: risks.filter((r) => r.priority === 'high').length,
    medium: risks.filter((r) => r.priority === 'medium').length,
    low: risks.filter((r) => r.priority === 'low').length,
  }

  const priorityColors: Record<RiskPriority, { bg: string; text: string; border: string; dot: string }> = {
    high: { bg: 'rgba(220,38,38,0.07)', text: '#B91C1C', border: 'rgba(220,38,38,0.18)', dot: '#DC2626' },
    medium: { bg: 'rgba(217,119,6,0.07)', text: '#B45309', border: 'rgba(217,119,6,0.18)', dot: '#D97706' },
    low: { bg: 'rgba(5,150,105,0.07)', text: '#047857', border: 'rgba(5,150,105,0.18)', dot: '#059669' },
  }

  const statusStyles: Record<RiskStatus, { label: string; bg: string; text: string }> = {
    open: { label: 'Open', bg: '#F4F6F9', text: '#6B7A94' },
    investigating: { label: 'Investigating', bg: 'rgba(15, 138, 75,0.07)', text: '#0F8A4B' },
    escalated: { label: 'Escalated', bg: 'rgba(220,38,38,0.07)', text: '#B91C1C' },
    resolved: { label: 'Resolved', bg: 'rgba(5,150,105,0.07)', text: '#047857' },
  }

  const handleDomainClick = (key: DomainKey) => {
    const domain = domains.find((d) => d.key === key)
    if (domain) setActiveWorkspace(domain)
  }

  const handleGoHome = () => {
    setActiveWorkspace(null)
    setActiveRisk(null)
  }

  // Keyed off tileStatusTone (the real, threshold-driven field), not the
  // composite-score-derived status - so this summary always agrees with the
  // tile chips and ring it sits above.
  const healthyDomainCount = domains.filter((d) => d.tileStatusTone === 'healthy').length
  const attentionDomains = domains.filter((d) => d.tileStatusTone !== 'healthy')
  const attentionDomainCount = attentionDomains.length
  // Names the actual domain(s) needing attention instead of just a count, so
  // the health score card is legible at a glance without reading further.
  const attentionSummary =
    attentionDomains.length === 0
      ? 'every domain is healthy'
      : attentionDomains.length === 1
        ? `${attentionDomains[0].label} needs attention`
        : `${attentionDomains.map((d) => d.label).join(', ')} need attention`

  // Live count of things genuinely awaiting the MD's decision - the open items
  // in the Risk Center - rather than a static "here's what matters" line.
  const openRisksCount = risks.filter((r) => r.status !== 'resolved').length
  const heroSubLine =
    openRisksCount === 0
      ? 'Nothing is waiting on you.'
      : `${openRisksCount === 1 ? 'One thing needs' : `${openRisksCount} things need`} you today.`

  // Real report, assembled from the same data already on screen - no AI
  // involved, just formatting. Downloads as a plain-text file.
  const downloadReport = () => {
    const lines = [
      'ZAMANI DEVELOPMENT FINANCE — EXECUTIVE REPORT',
      `Generated ${new Date().toLocaleString('en-GB')} · Data as of ${asOfLabel}`,
      '',
      `${healthyDomainCount} domain(s) healthy, ${attentionDomainCount} requiring attention: ${attentionSummary}`,
      '',
      'EXECUTIVE SUMMARY',
      briefSummary,
      '',
      'DOMAIN BREAKDOWN',
      ...domains.map((d) => `- ${d.label}: ${d.tileHeadline} (${d.tileStatusTone === 'healthy' ? 'Healthy' : d.tileStatusTone === 'attention' ? 'Needs Attention' : 'Critical'}) — ${d.tileSupporting}`),
      '',
      `RISK REGISTER (${risks.length} item${risks.length === 1 ? '' : 's'})`,
      ...risks.map((r) => `- [${r.priority.toUpperCase()}] ${r.title} — ${r.description}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zamani-executive-report-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>

      <CommandBar
        domains={domains}
        risks={risks}
        asOfLabel={asOfLabel}
        timeStr={timeStr}
        onOpenDomain={handleDomainClick}
        onGoHome={handleGoHome}
        onOpenRisk={setActiveRisk}
        onOpenAI={() => askAI()}
      />

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="px-4 sm:px-6 lg:px-8" style={{ maxWidth: 1480, margin: '0 auto', paddingTop: 32, paddingBottom: 80 }}>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 40, position: 'relative' }}>
          {/* Soft ambient glow - the page's one deliberate color moment on
              its single most important piece of real estate, instead of
              flat text on flat background. Ties back to the same green
              identity as .ai-glow just below rather than inventing a new
              decorative color. Purely atmospheric: aria-hidden, no pointer
              events, sits behind the text. */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -140,
              right: -60,
              width: 460,
              height: 460,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(15,138,75,0.14) 0%, rgba(15,138,75,0) 70%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, position: 'relative', zIndex: 1 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7A94', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Inter', margin: '0 0 8px' }}>{dateStr}</p>
              <h1 className="font-display" style={{ fontSize: 'clamp(28px,5vw,52px)', fontWeight: 800, color: '#0A0E1A', letterSpacing: '-0.025em', lineHeight: 1.05, margin: 0 }}>Good {timeOfDay}, {greetingName}.</h1>
              <p style={{ fontSize: 16, color: '#6B7A94', marginTop: 10, fontFamily: 'Inter', fontWeight: 400, letterSpacing: '-0.01em' }}>{heroSubLine}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="ghost-btn" onClick={downloadReport} style={{ padding: '8px 16px' }}>Generate Board Report</button>
              <button className="ms-blue-btn" onClick={() => askAI()} style={{ padding: '8px 16px' }}>✦ &nbsp;Ask Ada</button>
            </div>
          </div>
        </div>

        {/* ── AI Brief + Domain Overview ────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr]" style={{ gap: 20, marginBottom: 20 }}>
          <div className="ai-glow" style={{ borderRadius: 16, padding: 24, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <AiBadge label="Ada's Briefing" />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#0F8A4B', fontFamily: 'Inter', fontWeight: 600 }}>
                    <LiveDot size={7} /> Live
                  </span>
                  <span style={{ fontSize: 11, color: '#6B7A94', fontFamily: 'Inter' }}>As of {asOfLabel}</span>
                </div>
                <h2 className="font-display" style={{ fontSize: 22, fontWeight: 700, color: '#0A0E1A', margin: 0, letterSpacing: '-0.02em' }}>Today's Executive Summary</h2>
              </div>
            </div>
            {/* Real risk-register breakdown, not a composite score - every wedge
                is an actual priority count you can check against the Risk
                Center below, not a blended index that can't be explained. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
              <SegmentRing
                size={92}
                segments={[
                  { value: riskCounts.high, color: '#DC2626' },
                  { value: riskCounts.medium, color: '#D97706' },
                  { value: riskCounts.low, color: '#059669' },
                ]}
                centerValue={String(riskCounts.all)}
                centerLabel="open"
              />
              <div>
                <div style={{ fontSize: 11, color: '#6B7A94', fontFamily: 'Inter', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Risk Queue</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: riskCounts.high > 0 ? '#B91C1C' : '#059669', fontFamily: 'Inter', marginBottom: 2 }}>
                  {riskCounts.high > 0 ? `${riskCounts.high} high priority` : 'Nothing high priority'}
                </div>
                <div style={{ fontSize: 12, color: '#6B7A94', fontFamily: 'Inter' }}>{riskCounts.medium} medium &nbsp;·&nbsp; {riskCounts.low} low</div>
              </div>
            </div>
            <div style={{ marginBottom: 20, minHeight: 74 }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={briefPoints[briefIndex]?.lead ?? briefSummary}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.4 }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
                >
                  {briefPoints[briefIndex]?.tone === 'critical' && <span style={{ marginTop: 5, flexShrink: 0 }}><LiveDot color="#DC2626" size={7} /></span>}
                  <div>
                    <p style={{ fontSize: 15, lineHeight: 1.6, fontFamily: 'Inter', fontWeight: 600, color: BRIEF_TONE_COLORS[briefPoints[briefIndex]?.tone ?? 'good'], margin: 0 }}>
                      {briefPoints[briefIndex]?.lead ?? briefSummary}
                    </p>
                    {briefPoints[briefIndex]?.detail && (
                      <p style={{ fontSize: 13.5, lineHeight: 1.6, fontFamily: 'Inter', fontWeight: 400, color: '#6B7A94', margin: '4px 0 0' }}>
                        {briefPoints[briefIndex].detail}
                      </p>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
              {briefPoints.length > 1 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
                  {briefPoints.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setBriefIndex(i)}
                      aria-label={`Show insight ${i + 1}`}
                      style={{ width: i === briefIndex ? 18 : 6, height: 4, borderRadius: 2, background: i === briefIndex ? '#0F8A4B' : 'rgba(10,14,26,0.12)', border: 'none', padding: 0, cursor: 'pointer', transition: 'width 0.3s, background 0.3s' }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7A94', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'Inter' }}>Recommended Actions</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button className="ms-blue-btn" onClick={() => handleDomainClick('partners')} style={{ padding: '7px 14px' }}>
                  See the {overduePartnersCount} late partner{overduePartnersCount === 1 ? '' : 's'}
                </button>
                <Link href="/drill/lapsed-approvals" className="ghost-btn" style={{ padding: '7px 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  Open the {lapsedApprovalsCount} approval{lapsedApprovalsCount === 1 ? '' : 's'} waiting on you
                </Link>
                <button className="ghost-btn" onClick={downloadReport} style={{ padding: '7px 14px' }}>Generate board report</button>
                <a href="#risk-center" className="ghost-btn" style={{ padding: '7px 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Go to Risk Center →</a>
              </div>
            </div>
          </div>
          <EnterpriseHealthCard domains={domains} attentionSummary={attentionSummary} asOfLabel={asOfLabel} onDomainClick={handleDomainClick} />
        </div>

        {/* ── Risk Center ────────────────────────────────────────────────── */}
        {/* No outer card here, deliberately - this section already contains
            its own grid of real, individually elevated risk cards below,
            same as Business Domains contains its own domain cards. Wrapping
            that grid in another white/border/shadow card on top would be a
            card-of-cards: the exact "identical card grids repeated
            everywhere" pattern the rest of the page was starting to fall
            into. The header sits directly on the page background instead,
            matching how the Business Domains header already works. */}
        <div id="risk-center" style={{ marginBottom: 20, scrollMarginTop: 72 }}>
          {/* Header */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7A94', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Inter', marginBottom: 3 }}>Live Business Issues</div>
                <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: '#0A0E1A', margin: 0, letterSpacing: '-0.01em' }}>Enterprise Risk Center</h3>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {([['all', 'All', '#6B7A94'], ['money', CATEGORY_LABELS.money, CATEGORY_COLORS.money], ['credit', CATEGORY_LABELS.credit, CATEGORY_COLORS.credit], ['compliance', CATEGORY_LABELS.compliance, CATEGORY_COLORS.compliance], ['reporting', CATEGORY_LABELS.reporting, CATEGORY_COLORS.reporting]] as [RiskFilter, string, string][])
                    .filter(([f]) => categoryCounts[f] > 0)
                    .map(([f, label, color]) => (
                    <button
                      key={f}
                      onClick={() => setRiskFilter(f)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 20,
                        border: riskFilter === f ? `1.5px solid ${color}` : '1px solid rgba(10,14,26,0.1)',
                        background: riskFilter === f ? `${color}0D` : 'white',
                        color: riskFilter === f ? color : '#6B7A94',
                        fontSize: 12,
                        fontWeight: riskFilter === f ? 700 : 400,
                        cursor: 'pointer',
                        fontFamily: 'Inter',
                        transition: 'all 0.15s',
                      }}
                    >
                      {label} <span style={{ opacity: 0.7 }}>({categoryCounts[f]})</span>
                    </button>
                  ))}
                </div>
                <div className="hidden sm:block" style={{ width: 1, height: 20, background: 'rgba(10,14,26,0.1)' }} />
                <div ref={recommendRef} style={{ position: 'relative' }}>
                  <button className="ghost-btn" style={{ padding: '4px 12px', fontSize: 12, background: 'white' }} onClick={() => setRecommendOpen((v) => !v)}>✦ Recommend Actions</button>
                  {recommendOpen && (
                    <div className="dropdown-pop" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 280, background: 'white', border: '1px solid rgba(10,14,26,0.08)', borderRadius: 10, boxShadow: '0 8px 24px rgba(10,14,26,0.12)', padding: 12, zIndex: 30 }}>
                      {mostUrgentRisk ? (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A94', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Inter', marginBottom: 6 }}>Most urgent</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0A0E1A', fontFamily: 'Inter', marginBottom: 8 }}>{mostUrgentRisk.title}</div>
                          <button
                            className="ms-blue-btn"
                            style={{ padding: '6px 12px', fontSize: 12 }}
                            onClick={() => { setActiveRisk(mostUrgentRisk); setRecommendOpen(false) }}
                          >
                            {mostUrgentRisk.actionLabel}
                          </button>
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: '#6B7A94', fontFamily: 'Inter' }}>No open risks right now.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary line - one sentence a reader can act on, instead of
                four pills that all say "some things are wrong" without
                saying what's actually at stake. */}
            <div style={{ fontSize: 14, color: '#1A2035', fontFamily: 'Inter' }}>
              <span style={{ fontWeight: 700 }}>{risks.length} open issue{risks.length === 1 ? '' : 's'}</span>
              {heldUpTotal > 0 && <> · <span style={{ fontWeight: 700, color: '#B91C1C' }}>{formatNaira(heldUpTotal)}</span> held up</>}
              {oldestAgeDays > 0 && <> · oldest {oldestAgeDays} days</>}
            </div>
          </div>

          {/* Risk grid - grouped by real severity, each item a card with real
              visual weight (icon, accent bar, hover-lift) instead of a thin
              row in a flat table. Filtering is by consequence category above;
              grouping stays by severity here since the two are independent -
              a tier header only appears when the filtered set actually spans
              more than one severity. */}
          <div>
            {filteredRisks.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: '#6B7A94', fontFamily: 'Inter' }}>No items match this filter.</div>
            )}
            {(() => {
              const visibleTierCount = (['high', 'medium', 'low'] as const).filter((tier) => filteredRisks.some((r) => r.priority === tier)).length
              return (['high', 'medium', 'low'] as const).map((tier) => {
              const tierRisks = filteredRisks.filter((r) => r.priority === tier)
              if (tierRisks.length === 0) return null
              const pc = priorityColors[tier]
              const tierLabel = tier === 'high' ? 'High Priority' : tier === 'medium' ? 'Medium Priority' : 'Low Priority'
              return (
                // Keyed on the filter too, not just the tier - forces a clean
                // remount whenever the filter changes so each card's
                // scroll-triggered entrance animation re-fires reliably. The
                // grid is already on screen when a filter chip is clicked, so
                // this reads as a deliberate "refresh" rather than a delay.
                // (Without this, whileInView's `once: true` can leave a card
                // stuck invisible - it doesn't reliably re-trigger just
                // because the same tier's contents changed underneath it.)
                <div key={`${riskFilter}-${tier}`} style={{ marginBottom: 24 }}>
                  {visibleTierCount > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: pc.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: pc.text, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tierLabel}</span>
                      <span style={{ fontSize: 12, color: '#6B7A94', fontFamily: 'Inter' }}>({tierRisks.length})</span>
                    </div>
                  )}
                  <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                    style={{ gap: 12 }}
                    variants={riskGridContainer}
                    initial="hidden"
                    animate="show"
                  >
                    {tierRisks.map((risk) => {
                      const ss = statusStyles[risk.status]
                      return (
                        <motion.div
                          key={risk.id}
                          variants={riskGridItem}
                          whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(10,14,26,0.1)' }}
                          transition={{ duration: 0.2 }}
                          style={{ height: '100%' }}
                        >
                          <div
                            onClick={() => setActiveRisk(risk)}
                            style={{
                              position: 'relative',
                              overflow: 'hidden',
                              background: 'white',
                              border: `1px solid ${pc.border}`,
                              borderRadius: 12,
                              padding: '16px 16px 14px',
                              cursor: 'pointer',
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                            }}
                          >
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: pc.dot }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                              <span style={{ width: 30, height: 30, borderRadius: 8, background: `${pc.dot}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pc.text, flexShrink: 0 }}>
                                {(() => { const Icon = RISK_SOURCE_ICON[risk.subtitle] ?? Landmark; return <Icon size={15} strokeWidth={2} /> })()}
                              </span>
                              <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 600, fontFamily: 'Inter', background: ss.bg, color: ss.text, flexShrink: 0 }}>{ss.label}</span>
                            </div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0A0E1A', fontFamily: 'Inter', lineHeight: 1.35, marginBottom: 4 }}>{risk.title}</div>
                            <div style={{ fontSize: 11.5, color: '#6B7A94', fontFamily: 'Inter', marginBottom: 12, lineHeight: 1.4 }}>{risk.description}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 4 }}>
                              <span style={{ fontSize: 11, color: '#0F8A4B', fontFamily: 'Inter', fontWeight: 500 }}>{risk.assignedTo ?? ''}</span>
                              <button
                                className="ms-blue-btn"
                                style={{ padding: '5px 12px', fontSize: 11.5, flexShrink: 0 }}
                                onClick={(e) => { e.stopPropagation(); setActiveRisk(risk) }}
                              >
                                {risk.actionLabel}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </motion.div>
                </div>
              )
              })
            })()}
          </div>

          {/* Footer - a plain hairline rule, not a filled bar, since there's
              no card edge underneath it to anchor a footer strip to. */}
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(10,14,26,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#6B7A94', fontFamily: 'Inter' }}>Showing {filteredRisks.length} of {risks.length} items · Data as of {asOfLabel}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="ghost-btn" onClick={() => setShowResolvedOnly((v) => !v)} style={{ padding: '4px 12px', fontSize: 12 }}>
                {showResolvedOnly ? 'Show all items' : 'View resolved items'}
              </button>
              <button className="ghost-btn" onClick={exportRiskRegister} style={{ padding: '4px 12px', fontSize: 12 }}>Export risk register</button>
            </div>
          </div>
        </div>

        {/* ── Business Domains ──────────────────────────────────────────── */}
        <div id="business-domains" style={{ marginBottom: 20, scrollMarginTop: 72 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7A94', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Inter', marginBottom: 3 }}>Business Domains</div>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: '#0A0E1A', margin: 0 }}>Decision Workspaces</h3>
            </div>
            <span style={{ fontSize: 12, color: '#6B7A94', fontFamily: 'Inter' }}>Select a domain to open its workspace →</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
            {domains.map((domain) => {
              // Status chip is keyed off tileStatusTone, same real threshold
              // field the "Where things stand" card above uses - the two
              // cards must never disagree on THAT. But headline/body here
              // deliberately pull a different real KPI and the fuller
              // analysis paragraph, rather than repeating the tile's own
              // headline verbatim - this card's job is "why would I open the
              // workspace", not a rerun of the summary above it.
              const statusColors = { healthy: '#059669', attention: '#D97706', critical: '#DC2626' }
              const statusChipLabels = { healthy: 'On track', attention: 'Watch', critical: 'Needs attention' }
              const headlineKpi = domain.kpis.find((k) => k.key === DOMAIN_HEADLINE_KPI_KEY[domain.key]) ?? domain.kpis[0]
              return (
                <div key={domain.key} className="domain-card" onClick={() => setActiveWorkspace(domain)} style={{ padding: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#E7F6ED,#DCF3E3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F8A4B' }}>
                        {(() => { const Icon = DOMAIN_ICON_COMPONENT[domain.key]; return <Icon size={18} strokeWidth={2} /> })()}
                      </div>
                      <div>
                        <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: '#0A0E1A' }}>{domain.label}</div>
                        <div style={{ fontSize: 11, color: '#6B7A94', fontFamily: 'Inter', marginTop: 1 }}>{DOMAIN_TAGLINES[domain.key]}</div>
                      </div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: statusColors[domain.tileStatusTone], background: `${statusColors[domain.tileStatusTone]}10`, border: `1px solid ${statusColors[domain.tileStatusTone]}25`, borderRadius: 6, padding: '2px 8px', fontFamily: 'Inter', flexShrink: 0 }}>
                      <StatusDot status={domain.tileStatusTone} />{statusChipLabels[domain.tileStatusTone]}
                    </span>
                  </div>
                  {headlineKpi && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                      <span className="font-display" style={{ fontSize: 24, fontWeight: 700, color: '#0A0E1A', letterSpacing: '-0.01em' }}>{headlineKpi.value}</span>
                      <span style={{ fontSize: 12, color: '#6B7A94', fontFamily: 'Inter' }}>{headlineKpi.label}</span>
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: '#6B7A94', lineHeight: 1.6, margin: '0 0 14px', fontFamily: 'Inter', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{domain.aiSummary}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <AiBadge />
                    <span style={{ fontSize: 12, color: '#0F8A4B', fontWeight: 500, fontFamily: 'Inter' }}>Open Workspace →</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Activity Timeline ─────────────────────────────────────────── */}
        <div className="enterprise-card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7A94', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Inter', marginBottom: 3 }}>Recent activity</div>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: '#0A0E1A', margin: 0 }}>Activity Timeline</h3>
            </div>
            {timeline.length > 4 && (
              <button className="ghost-btn" onClick={() => setTimelineExpanded((v) => !v)} style={{ padding: '4px 12px', fontSize: 12 }}>
                {timelineExpanded ? 'Show fewer' : `View all (${timeline.length})`}
              </button>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 52, top: 0, bottom: 0, width: 1, background: 'rgba(10,14,26,0.06)' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(timelineExpanded ? timeline : timeline.slice(0, 4)).map((event, i) => {
                const catColors: Record<string, string> = { Lending: '#0F8A4B', Finance: '#7C3AED', Partners: '#059669', 'AI Insight': '#D97706', Executive: '#0A0E1A', Procurement: '#0891B2' }
                const color = catColors[event.category] || '#6B7A94'
                return (
                  <div key={i} style={{ display: 'flex', gap: 20, padding: '12px 0', alignItems: 'flex-start' }}>
                    <div style={{ width: 40, flexShrink: 0, textAlign: 'right', paddingTop: 2 }}>
                      <span className="font-mono" style={{ fontSize: 11, color: '#6B7A94', letterSpacing: '0.05em' }}>{event.time}</span>
                    </div>
                    <div style={{ position: 'relative', zIndex: 1, flexShrink: 0, paddingTop: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: event.aiGenerated ? '#D97706' : color, border: '2px solid white', boxShadow: `0 0 0 1px ${event.aiGenerated ? '#D97706' : color}30` }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color, background: `${color}10`, border: `1px solid ${color}25`, borderRadius: 4, padding: '1px 6px', fontFamily: 'Inter', letterSpacing: '0.04em' }}>{event.category}</span>
                        {event.aiGenerated && <span style={{ fontSize: 10, color: '#D97706', fontWeight: 600, fontFamily: 'Inter' }}>✦ AI Detected</span>}
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#1A2035', lineHeight: 1.55, fontFamily: 'Inter' }}>{event.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>

      {/* ── Panels ───────────────────────────────────────────────────────── */}
      {activeRisk && (
        <RiskDetailPanel
          risk={activeRisk}
          onClose={() => setActiveRisk(null)}
          onStatusChange={handleStatusChange}
          onAskAI={askAI}
          onAssign={handleAssign}
        />
      )}
      {activeWorkspace && !activeRisk && (
        <WorkspacePanel domain={activeWorkspace} onClose={() => setActiveWorkspace(null)} onAskAI={askAI} />
      )}

      <AiWidget open={aiOpen} onOpenChange={setAiOpen} pendingQuestion={pendingQuestion} onPendingQuestionHandled={() => setPendingQuestion(null)} />
    </div>
  )
}
