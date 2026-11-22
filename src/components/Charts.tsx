import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';

export interface ExpenseCategoryMeta {
  color: string;
  colorName: string;
  bgPastel: string;
}

export const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  Gear: '#5A388C',          // Primary Purple
  'Studio rent': '#7E68C8', // Deep Lavender Purple
  Insurance: '#887CC7',     // Interactive Lavender
  Travel: '#9D8EE6',        // Luminous Lilac
  Marketing: '#B5A8E0',     // Soft Lilac
  Software: '#3A3A52',      // Midnight Slate
};

export const EXPENSE_CATEGORY_METADATA: Record<string, ExpenseCategoryMeta> = {
  Gear: { color: '#5A388C', colorName: 'Primary Purple', bgPastel: 'rgba(90, 56, 140, 0.12)' },
  'Studio rent': { color: '#7E68C8', colorName: 'Deep Lavender', bgPastel: 'rgba(126, 104, 200, 0.12)' },
  Insurance: { color: '#887CC7', colorName: 'Interactive Lavender', bgPastel: 'rgba(136, 124, 199, 0.14)' },
  Travel: { color: '#9D8EE6', colorName: 'Luminous Lilac', bgPastel: 'rgba(157, 142, 230, 0.14)' },
  Marketing: { color: '#B5A8E0', colorName: 'Soft Lilac', bgPastel: 'rgba(181, 168, 224, 0.15)' },
  Software: { color: '#3A3A52', colorName: 'Midnight Slate', bgPastel: 'rgba(58, 58, 82, 0.12)' },
};

const PALETTE = ['#5A388C', '#7E68C8', '#887CC7', '#9D8EE6', '#B5A8E0', '#3A3A52'] as const;
const GRID_STROKE = '#E6E0F0';
const AXIS_TICK = { fill: '#5B5270', fontSize: 12, fontWeight: 500 };
const AXIS_LINE = { stroke: '#E6E0F0' };

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatValue(value: unknown): string {
  return typeof value === 'number' ? currency.format(value) : String(value ?? '');
}

/* =========================================================================
   SVG SPARKLINE COMPONENT
   Draws a smooth curve trend beside KPI numbers with gradient fill & pulse dot
   ========================================================================= */

export interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({
  data,
  color = '#5A3BBC',
  width = 96,
  height = 36,
  className = '',
}: SparklineProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const paddingY = 5;
  const availableHeight = height - paddingY * 2;

  // Map data to x, y coordinates with strict bounds clamping to prevent jumping or clipping
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (width - 10) + 5;
    const normalized = (val - min) / range;
    const y = Math.max(paddingY, Math.min(height - paddingY, height - paddingY - normalized * availableHeight));
    return { x, y };
  });

  // Construct smooth, non-hitching Catmull-Rom cubic bezier curve
  let pathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Smooth tangent control points with 0.18 tension for gentle, elegant curve without hitching
    const tension = 0.18;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = Math.max(paddingY, Math.min(height - paddingY, p1.y + (p2.y - p0.y) * tension));
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = Math.max(paddingY, Math.min(height - paddingY, p2.y - (p3.y - p1.y) * tension));

    pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  // Smooth Area path for gradient fill
  const last = points[points.length - 1];
  const first = points[0];
  const areaD = `${pathD} L ${last.x.toFixed(1)} ${height} L ${first.x.toFixed(1)} ${height} Z`;

  // Deterministic gradient ID based on color and endpoints to eliminate random ID re-render flickering
  const safeColor = color.replace(/[^a-zA-Z0-9]/g, '');
  const gradId = `spark-grad-${safeColor}-${data.length}-${Math.round(points[0].y)}-${Math.round(last.y)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`sparkline-svg ${className}`}
      style={{ overflow: 'visible', display: 'inline-block', verticalAlign: 'middle' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      {/* Fill Area */}
      <path d={areaD} fill={`url(#${gradId})`} />
      {/* Line Curve */}
      <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Glowing End Point */}
      <circle cx={last.x} cy={last.y} r={3.5} fill={color} stroke="#FFFFFF" strokeWidth={1.5} />
    </svg>
  );
}

/* =========================================================================
   STANDARD REVENUE / EXPENSE CHART TOOLTIP
   ========================================================================= */

export function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1.5px solid #E6E0F0',
        borderRadius: 12,
        padding: '10px 14px',
        minWidth: 150,
        boxShadow: '0 8px 24px rgba(36, 28, 56, 0.12)',
      }}
    >
      {label !== undefined && label !== null && (
        <div style={{ fontSize: 12, color: '#887CC7', fontWeight: 600, marginBottom: 6 }}>
          {String(label)}
        </div>
      )}
      {payload.map((entry) => (
        <div
          key={String(entry.dataKey ?? entry.name)}
          style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13, margin: '2px 0' }}
        >
          <span style={{ color: entry.color ?? '#5A3BBC', fontWeight: 500 }}>{entry.name}</span>
          <span style={{ color: '#241C38', fontWeight: 700 }}>{formatValue(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* =========================================================================
   PIE CHART TOOLTIP WITH CATEGORY PERCENTAGE
   ========================================================================= */

interface PieTooltipProps extends TooltipProps<number, string> {
  totalSum?: number;
}

export function PieCategoryTooltip({ active, payload, totalSum = 1 }: PieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const value = Number(item.value ?? 0);
  const pct = totalSum > 0 ? Math.round((value / totalSum) * 100) : 0;
  const color = item.payload?.fill ?? '#5A3BBC';

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: `1.5px solid ${color}`,
        borderRadius: 12,
        padding: '10px 14px',
        boxShadow: '0 10px 25px -4px rgba(36, 28, 56, 0.15)',
        minWidth: 140,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#241C38' }}>{item.name}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#241C38' }}>{formatValue(value)}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, background: 'rgba(90, 59, 188, 0.08)', padding: '1px 6px', borderRadius: 4 }}>
          {pct}% of total
        </span>
      </div>
    </div>
  );
}

/* =========================================================================
   REVENUE & EXPENSES AREA CHART
   ========================================================================= */

export interface RevenueExpensePoint {
  month: string;
  revenue: number;
  expenses: number;
}

export interface RevenueExpenseChartProps {
  data: RevenueExpensePoint[];
  animate: boolean;
}

export function RevenueExpenseChart({ data, animate }: RevenueExpenseChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5A3BBC" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#5A3BBC" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#887CC7" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#887CC7" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="month" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => currency.format(v)}
          width={80}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#887CC7', strokeWidth: 1.5 }} />
        <Area
          type="monotone"
          name="Revenue"
          dataKey="revenue"
          stroke="#5A3BBC"
          strokeWidth={2.5}
          fill="url(#revenueFill)"
          isAnimationActive={animate}
        />
        <Area
          type="monotone"
          name="Expenses"
          dataKey="expenses"
          stroke="#887CC7"
          strokeWidth={2}
          fill="url(#expenseFill)"
          isAnimationActive={animate}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* =========================================================================
   SOLID ANIMATED PIE CHART FOR EXPENSE CATEGORIES
   Full pie chart with radial sector animations, elevation & interactive hover
   ========================================================================= */

export interface DonutDatum {
  name: string;
  value: number;
}

export interface DonutChartProps {
  data: DonutDatum[];
  animate: boolean;
  activeName?: string | null;
  onHover?: (name: string | null) => void;
}

interface SectorShapeProps {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
}

function renderActivePieSector(props: SectorShapeProps) {
  const { cx = 0, cy = 0, innerRadius = 0, outerRadius = 0, startAngle = 0, endAngle = 0, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#FFFFFF"
        strokeWidth={3}
        filter="drop-shadow(0 4px 10px rgba(90, 59, 188, 0.3))"
      />
    </g>
  );
}

export function CategoryPieChart({ data, animate, activeName, onHover }: DonutChartProps) {
  const activeIndex = activeName ? data.findIndex((d) => d.name === activeName) : -1;
  const totalSum = data.reduce((sum, d) => sum + d.value, 0);

const renderPieSliceLabel = ({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }: any) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.62;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="#FFFFFF"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={800}
        style={{ pointerEvents: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
      >
        {`${Math.round(percent * 100)}%`}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={290}>
      <PieChart>
        <Tooltip content={<PieCategoryTooltip totalSum={totalSum} />} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={0}
          outerRadius={105}
          paddingAngle={2.5}
          stroke="#FFFFFF"
          strokeWidth={2.5}
          labelLine={false}
          label={renderPieSliceLabel}
          isAnimationActive={animate}
          activeIndex={activeIndex >= 0 ? activeIndex : undefined}
          activeShape={renderActivePieSector}
          onMouseEnter={(_: unknown, index: number) => onHover?.(data[index]?.name ?? null)}
          onMouseLeave={() => onHover?.(null)}
        >
          {data.map((entry, i) => {
            const sliceColor = EXPENSE_CATEGORY_COLORS[entry.name] ?? PALETTE[i % PALETTE.length];
            return <Cell key={entry.name} fill={sliceColor} />;
          })}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

// Keep DonutChart alias pointing to CategoryPieChart so all consumers render the solid animated pie chart!
export const DonutChart = CategoryPieChart;

/* =========================================================================
   FORECAST CHART
   ========================================================================= */

export interface ForecastPoint {
  month: string;
  actual?: number;
  forecast: number;
  low: number;
  high: number;
}

export interface ForecastChartProps {
  data: ForecastPoint[];
  animate: boolean;
}

export function ForecastChart({ data, animate }: ForecastChartProps) {
  const rows = data.map((d) => ({ ...d, band: d.high - d.low }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="month" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => currency.format(v)}
          width={80}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#5A3BBC', strokeWidth: 1.5 }} />
        {/* low-to-high confidence band */}
        <Area
          type="monotone"
          name="Low"
          dataKey="low"
          stackId="band"
          stroke="none"
          fill="transparent"
          legendType="none"
          isAnimationActive={animate}
        />
        <Area
          type="monotone"
          name="Range"
          dataKey="band"
          stackId="band"
          stroke="none"
          fill="#887CC7"
          fillOpacity={0.18}
          isAnimationActive={animate}
        />
        <Line
          type="monotone"
          name="Forecast"
          dataKey="forecast"
          stroke="#887CC7"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          isAnimationActive={animate}
        />
        <Line
          type="monotone"
          name="Actual"
          dataKey="actual"
          stroke="#5A3BBC"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#5A3BBC', stroke: '#FFFFFF', strokeWidth: 1.5 }}
          connectNulls={false}
          isAnimationActive={animate}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
