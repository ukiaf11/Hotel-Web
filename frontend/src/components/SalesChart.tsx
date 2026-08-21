import { useId, useState } from 'react'

import { money } from '../lib/format'

interface Point {
  label: string
  value: number
}

interface Props {
  data: Point[]
  type?: 'bar' | 'line'
  height?: number
  ariaLabel?: string
}

const PAD = { top: 16, right: 12, bottom: 26, left: 46 }

/** Dependency-free SVG chart with hover tooltips (docs 09 & 14). */
export function SalesChart({ data, type = 'bar', height = 220, ariaLabel = 'Sales chart' }: Props) {
  const gradientId = useId().replace(/:/g, '')
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null)
  const width = 640
  const innerW = width - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom

  if (!data.length) {
    return <p className="small muted">No data for this period.</p>
  }

  const peak = Math.max(...data.map((point) => point.value), 1)
  const niceMax = Math.ceil(peak / 4) * 4 || 4
  const stepX = innerW / Math.max(data.length, 1)
  const yOf = (value: number) => PAD.top + innerH - (value / niceMax) * innerH
  const xOf = (index: number) => PAD.left + stepX * index + stepX / 2

  const linePath = data
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xOf(index).toFixed(1)} ${yOf(point.value).toFixed(1)}`)
    .join(' ')
  const areaPath = `${linePath} L ${xOf(data.length - 1)} ${PAD.top + innerH} L ${xOf(0)} ${PAD.top + innerH} Z`

  return (
    <div style={{ position: 'relative' }}>
      <svg
        className="chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
        style={{ height, width: '100%' }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`bar-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-primary)" />
            <stop offset="100%" stopColor="var(--brand-hover)" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={`area-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = PAD.top + innerH * ratio
          return (
            <g key={ratio}>
              <line className="grid-line" x1={PAD.left} y1={y} x2={width - PAD.right} y2={y} />
              <text className="axis-text" x={PAD.left - 8} y={y + 3} textAnchor="end">
                {Math.round(niceMax * (1 - ratio))}
              </text>
            </g>
          )
        })}

        {type === 'line' ? (
          <>
            <path className="area" d={areaPath} fill={`url(#area-${gradientId})`} />
            <path className="line" d={linePath} />
          </>
        ) : null}

        {data.map((point, index) => {
          const barW = Math.min(stepX * 0.56, 42)
          const y = yOf(point.value)
          return (
            <g
              key={`${point.label}-${index}`}
              onMouseEnter={() => setHover({ index, x: (xOf(index) / width) * 100, y: (y / height) * 100 })}
            >
              {type === 'bar' ? (
                <rect
                  className="bar"
                  fill={`url(#bar-${gradientId})`}
                  x={xOf(index) - barW / 2}
                  y={y}
                  width={barW}
                  height={Math.max(PAD.top + innerH - y, 1)}
                  rx={5}
                />
              ) : (
                <circle className="point" cx={xOf(index)} cy={y} r={hover?.index === index ? 5.5 : 3.5} />
              )}
              <rect x={xOf(index) - stepX / 2} y={PAD.top} width={stepX} height={innerH} fill="transparent" />
              <text className="axis-text" x={xOf(index)} y={height - 8} textAnchor="middle">
                {point.label}
              </text>
            </g>
          )
        })}
      </svg>

      {hover ? (
        <span className="chart-tip" style={{ left: `${hover.x}%`, top: `${hover.y}%` }}>
          {data[hover.index].label}: {money(data[hover.index].value)}
        </span>
      ) : null}
    </div>
  )
}
