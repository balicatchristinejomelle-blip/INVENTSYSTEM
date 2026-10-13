import React, { useEffect, useState } from "react"
import Pagination, { pageRecords } from "./Pagination"

export default function RecordList<T>({
  records,
  render,
  query = "",
}: {
  records: readonly T[]
  render: (record: T) => React.ReactNode
  query?: string
}) {
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [query])
  const safePage = Math.min(page, Math.max(1, Math.ceil(records.length / 10)))
  return (
    <>
      {pageRecords(records, safePage).map(render)}
      <Pagination
        page={safePage}
        totalRecords={records.length}
        onPageChange={setPage}
      />
    </>
  )
}
