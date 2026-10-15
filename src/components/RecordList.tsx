import React, { useEffect, useState } from "react"
import Pagination, { pageRecords } from "./Pagination"
import { EmptyState } from './UXFeedback';

export default function RecordList<T>({
  records,
  render,
  query = "",
  emptyMessage,
}: {
  records: readonly T[]
  render: (record: T) => React.ReactNode
  query?: string
  emptyMessage?: string | false
}) {
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [query])
  const safePage = Math.min(page, Math.max(1, Math.ceil(records.length / 10)))
  return (
    <>
      {records.length ? pageRecords(records, safePage).map(render) : emptyMessage === false ? null : <EmptyState message={emptyMessage} />}
      <Pagination
        page={safePage}
        totalRecords={records.length}
        onPageChange={setPage}
      />
    </>
  )
}
