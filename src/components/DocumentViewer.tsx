import React, { useEffect } from 'react';
import hpaiLogo from '../assets/hpai-logo.png';

export type DocumentField = {
  label: string;
  value: React.ReactNode;
};

export type DocumentSection = {
  title: string;
  fields: DocumentField[];
};

export type PrintableDocument = {
  type: string;
  reference: string;
  date?: string;
  status?: string;
  plant?: string;
  sections: DocumentSection[];
};

interface DocumentViewerProps {
  open: boolean;
  document: PrintableDocument | null;
  onClose: () => void;
  autoPrint?: boolean;
}

export default function DocumentViewer({ open, document, onClose, autoPrint = false }: DocumentViewerProps) {
  useEffect(() => {
    if (!open || !document || !autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 80);
    return () => window.clearTimeout(timer);
  }, [open, document?.reference, autoPrint]);

  if (!open) return null;

  return (
    <div className="document-viewer-overlay" role="dialog" aria-modal="true" aria-label={document ? `${document.type} ${document.reference}` : 'Document not found'}>
      <div className="document-viewer-shell">
        <div className="document-viewer-actions print-hidden">
          <button className="btn-primary" disabled={!document} onClick={() => document && window.print()}>Print</button>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
        {document ? (
          <article className="print-document">
            <header className="print-document-header">
              <img src={hpaiLogo} alt="Hydro Phil Asia, Inc." />
              <div>
                <div className="print-company-name">HYDRO PHIL ASIA, INC.</div>
                <div className="print-document-type">{document.type}</div>
              </div>
              <div className="print-document-reference">{document.reference}</div>
            </header>
            <div className="print-document-meta">
              {document.date && <div><span>Document Date</span><strong>{document.date}</strong></div>}
              {document.status && <div><span>Status</span><strong>{document.status}</strong></div>}
              {document.plant && <div><span>Plant / Department</span><strong>{document.plant}</strong></div>}
            </div>
            {document.sections.map(section => (
              <section className="print-document-section" key={section.title}>
                <h2>{section.title}</h2>
                <div className="print-document-grid">
                  {section.fields.filter(field => field.value !== undefined && field.value !== null && field.value !== '').map(field => (
                    <div className="print-document-field" key={field.label}>
                      <span>{field.label}</span>
                      <strong>{field.value}</strong>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            <footer className="print-document-footer">
              <span>System record: {document.reference}</span>
              <span>Printed from the live HPAI record</span>
            </footer>
          </article>
        ) : (
          <div className="print-document document-not-found">
            <strong>DOCUMENT NOT FOUND</strong>
            <p>The selected record could not be loaded.</p>
          </div>
        )}
      </div>
    </div>
  );
}
