import React, { useEffect, useState } from "react"
import Pagination, { pageRecords } from "./Pagination"
import { useRecordQuery } from "./RecordSearch"

/** Paginate record tables that previously rendered an unbounded map. */
export default function RecordRows<T>({
  records,
  render,
}: {
  records: readonly T[]
  render: (record: T, index: number) => React.ReactNode
}) {
  const [page, setPage] = useState(1)
  const query = useRecordQuery()
  const recordIds = records
    .map((record) =>
      record && typeof record === "object" && "id" in record
        ? String(record.id)
        : String(record),
    )
    .join("|")
  useEffect(() => setPage(1), [query, recordIds])
  const safePage = Math.min(page, Math.max(1, Math.ceil(records.length / 10)))
  return (
    <>
      {pageRecords(records, safePage).map((record, index) =>
        render(record, (safePage - 1) * 10 + index),
      )}
      <tr>
        <td colSpan={100}>
          <Pagination
            page={safePage}
            totalRecords={records.length}
            onPageChange={setPage}
          />
        </td>
      </tr>
    </>
  )
}
