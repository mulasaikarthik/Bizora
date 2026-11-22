export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function Skeleton({ width, height, className }: SkeletonProps) {
  return (
    <span
      className={className ? `skeleton ${className}` : 'skeleton'}
      style={{
        display: 'block',
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      aria-hidden="true"
    />
  );
}

export interface SkeletonRowsProps {
  rows?: number;
}

export function SkeletonRows({ rows = 5 }: SkeletonRowsProps) {
  const indexes = Array.from({ length: rows }, (_, i) => i);
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {indexes.map((i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1fr 1fr',
            gap: 16,
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #3A3A52',
          }}
        >
          <Skeleton width="70%" height={14} />
          <Skeleton width="60%" height={14} />
          <Skeleton width="50%" height={14} />
          <Skeleton width="40%" height={14} />
        </div>
      ))}
    </div>
  );
}

export interface SkeletonCardsProps {
  count?: number;
}

export function SkeletonCards({ count = 4 }: SkeletonCardsProps) {
  const indexes = Array.from({ length: count }, (_, i) => i);
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
      }}
    >
      {indexes.map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 20,
            borderRadius: 16,
            border: '1px solid #3A3A52',
            background: '#2A1E4D',
          }}
        >
          <Skeleton width="40%" height={12} />
          <Skeleton width="65%" height={28} />
          <Skeleton width="50%" height={12} />
        </div>
      ))}
    </div>
  );
}
