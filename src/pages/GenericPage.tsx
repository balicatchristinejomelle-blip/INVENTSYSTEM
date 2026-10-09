import React from 'react';

interface Props {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export default function GenericPage({ title, description, children }: Props) {
  return (
    <div>
      {description && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{description}</p>}
      {children || (
        <div className="app-card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>This section is under construction. Full functionality will be available in the production system.</div>
        </div>
      )}
    </div>
  );
}
