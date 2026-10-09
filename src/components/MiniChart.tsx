import React from 'react';

interface BarData { label: string; value: number; color?: string; }

interface BarChartProps {
  data: BarData[];
  height?: number;
  showValues?: boolean;
  unit?: string;
  maxVal?: number;
}

export function BarChart({ data, height = 120, showValues = true, unit = '', maxVal }: BarChartProps) {
  const max = maxVal ?? Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: height + 30, paddingTop: 20, position: 'relative' }}>
      {data.map((d, i) => {
        const pct = max > 0 ? (d.value / max) * 100 : 0;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {showValues && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{d.value}{unit}</span>}
            <div style={{ width: '100%', height: height, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%', height: `${Math.max(2, pct)}%`, background: d.color || '#2563eb', borderRadius: '3px 3px 0 0', transition: 'height 0.3s', opacity: 0.9 }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

interface DonutProps {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}

export function DonutChart({ segments, size = 100 }: DonutProps) {
  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  let offset = 0;
  const r = 40; const cx = 50; const cy = 50; const stroke = 14;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="donut-chart" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circumference;
          const gap = circumference - dash;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color}
              strokeWidth={stroke} strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset} transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dasharray 0.4s' }}
            />
          );
          offset += dash;
          return el;
        })}
        <circle cx={cx} cy={cy} r={r - stroke / 2} fill="none" stroke="var(--card-border)" strokeWidth="1" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{seg.label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', marginLeft: 4 }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LineProps {
  points: { label: string; value: number }[];
  color?: string;
  height?: number;
  unit?: string;
}

export function LineChart({ points, color = '#2563eb', height = 80, unit = '' }: LineProps) {
  const vals = points.map(p => p.value);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const w = 300; const h = height;
  const pad = 8;
  const xs = points.map((_, i) => pad + (i / (points.length - 1 || 1)) * (w - pad * 2));
  const ys = vals.map(v => h - pad - ((v - min) / range) * (h - pad * 2));
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ');
  const areaD = pathD + ` L ${xs[xs.length - 1]} ${h} L ${xs[0]} ${h} Z`;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={w} height={h + 20} viewBox={`0 0 ${w} ${h + 20}`} style={{ width: '100%' }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#grad-${color.replace('#','')})`} />
        <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {xs.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={ys[i]} r="3" fill={color} />
            <text x={x} y={h + 14} textAnchor="middle" fontSize="9" fill="var(--text-muted)">{points[i].label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// Horizontal bar (for comparisons)
interface HBarData { label: string; value: number; max: number; color?: string; unit?: string; }
export function HorizontalBar({ data }: { data: HBarData[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex justify-between" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{d.value}{d.unit || ''}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min(100, (d.value / (d.max || 1)) * 100)}%`, background: d.color || '#2563eb' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Stat card helper used in reports
export function ReportCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="app-card" style={{ padding: '12px 14px' }}>
      <div className="flex items-start justify-between">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
          {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
        {icon && <div style={{ color: color || 'var(--text-muted)', opacity: 0.6 }}>{icon}</div>}
      </div>
    </div>
  );
}
