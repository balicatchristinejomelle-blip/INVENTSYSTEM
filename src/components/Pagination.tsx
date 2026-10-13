import React from "react"

export const PAGE_SIZE = 10

export const pageRecords = <T,>(records: readonly T[], page: number) =>
  records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

interface PaginationProps {
  page: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  noun?: string;
}

export default function Pagination({ page, totalRecords, onPageChange, noun = 'records' }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  const safePage = Math.max(1, Math.min(page, totalPages))

  const firstRecord = totalRecords ? (safePage - 1) * PAGE_SIZE + 1 : 0;

  const lastRecord = Math.min(safePage * PAGE_SIZE, totalRecords);

  return (
    <div className="pagination-bar" aria-label="Table pagination">
      <div className="pagination-count">
        Showing {firstRecord}–{lastRecord} of {totalRecords} {noun}
      </div>
      <div className="pagination-controls">
        <button className="btn-secondary btn-compact" disabled={safePage === 1} onClick={() => onPageChange(safePage - 1)}>
          <span className="desktop-pagination-label">Previous</span>
          <span className="mobile-pagination-label">Prev</span>
        </button>
        <strong>
          <span className="desktop-pagination-label">Page </span>
          {safePage} <span className="desktop-pagination-label">of</span>
          <span className="mobile-pagination-label">/</span> {totalPages}
        </strong>
        <button className="btn-secondary btn-compact" disabled={safePage === totalPages} onClick={() => onPageChange(safePage + 1)}>Next</button>
      </div>
    </div>
  )
}
