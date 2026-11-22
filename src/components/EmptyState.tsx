import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  text: string;
  action?: ReactNode;
}

function ReceiptIllustration() {
  return (
    <svg width="160" height="120" viewBox="0 0 160 120" fill="none" aria-hidden="true">
      {/* back receipt */}
      <rect x="44" y="8" width="72" height="92" rx="8" fill="#2A1E4D" stroke="#3A3A52" strokeWidth="1.5" />
      <rect x="54" y="22" width="40" height="5" rx="2.5" fill="#5A3B8C" />
      <rect x="54" y="34" width="52" height="4" rx="2" fill="#3A3A52" />
      <rect x="54" y="44" width="46" height="4" rx="2" fill="#3A3A52" />
      {/* middle receipt */}
      <rect x="30" y="16" width="72" height="92" rx="8" fill="#3A3A52" stroke="#5A3B8C" strokeWidth="1.5" />
      <rect x="40" y="30" width="44" height="5" rx="2.5" fill="#8B7CC7" />
      <rect x="40" y="42" width="52" height="4" rx="2" fill="#5A3B8C" />
      <rect x="40" y="52" width="36" height="4" rx="2" fill="#5A3B8C" />
      {/* front receipt */}
      <rect x="14" y="24" width="72" height="92" rx="8" fill="#2A1E4D" stroke="#8B7CC7" strokeWidth="1.5" />
      <rect x="24" y="38" width="36" height="5" rx="2.5" fill="#C9C2E3" />
      <rect x="24" y="50" width="52" height="4" rx="2" fill="#8B7CC7" />
      <rect x="24" y="60" width="44" height="4" rx="2" fill="#5A3B8C" />
      <rect x="24" y="82" width="20" height="6" rx="3" fill="#C9C2E3" />
      <circle cx="122" cy="98" r="10" fill="#5A3B8C" stroke="#C9C2E3" strokeWidth="1.5" />
      <path d="M117 98h10M122 93v10" stroke="#C9C2E3" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ title, text, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 12,
        padding: '40px 24px',
      }}
    >
      <ReceiptIllustration />
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#C9C2E3' }}>{title}</h3>
      <p style={{ margin: 0, maxWidth: 360, fontSize: 14, lineHeight: 1.5, color: '#8B7CC7' }}>{text}</p>
      {action !== undefined && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
