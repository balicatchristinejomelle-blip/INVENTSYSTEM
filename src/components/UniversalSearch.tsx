import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, USERS } from "../store"
import type {
  ProductSpecification,
  Role,
  StockTarget,
  StorageLocation,
} from "../types"
import {
  normalizeProductSpecification,
  specificationLength,
} from "../productMaster"
import Modal from "./Modal"
import Pagination, { pageRecords } from "./Pagination"
import { matchesRecord, searchableText } from "./RecordSearch"
import { canViewRequest, metadataFor, printState } from '../reprintWorkflow';
import { printableRecords } from '../printableRecords';
import { pipeSearchRecord } from '../finishedPipeRelations';

export interface SearchResult {
  id: string
  group: string
  title: string
  subtitle: string
  page: string
  record: object
}
type App = ReturnType<typeof useApp>
type SearchableRecord = { id: string }

/** Explicit collection access: Production history is scoped to the logged-in employee. */
interface SearchConfiguration {
  specifications?: readonly ProductSpecification[]
  stockTargets?: readonly StockTarget[]
  locations?: readonly StorageLocation[]
}
export function buildUniversalIndex(
  app: App,
  configuration: SearchConfiguration = {},
): SearchResult[] {
  const user = app.currentUser
  if (!user) return []
  const role = user.role
  const owner = role === "OWNER_SUPER_ADMIN"
  const results: SearchResult[] = []
  function add<T extends SearchableRecord>(
    group: string,
    records: readonly T[],
    pages: Partial<Record<Role, string>>,
    describe: (record: T) => [string, string],
  ) {
    const page = pages[role]
    if (!page) return
    records.forEach((record) => {
      const [title, subtitle] = describe(record)
      results.push({ id: record.id, group, title, subtitle, page, record })
    })
  }
  add(
    "PRODUCTION ORDERS",
    app.productionOrders,
    {
      OWNER_SUPER_ADMIN: "owner-records",
      management: "mgmt-operations",
      plantmanager: "pm-production-orders",
      production: "prod-orders",
      marketing: "mkt-mo-tracking",
    },
    (item) => [
      item.poNo,
      `${item.source || 'Manufacturing Order'} · ${item.product} · ${item.grade} · ${item.diameter} · ${item.sdr} · ${item.status}`,
    ],
  )
  add(
    "MANUFACTURING ORDERS",
    app.manufacturingOrders,
    {
      OWNER_SUPER_ADMIN: "owner-records",
      plantmanager: "pm-production-orders",
      marketing: "mkt-mo-tracking",
    },
    (item) => [
      item.moNo,
      `${item.orderRef} · ${item.product} · ${item.grade} · ${item.diameter} · ${item.sdr} · ${item.status}`,
    ],
  )
  add(
    "CUSTOMER ORDERS",
    app.orders,
    { OWNER_SUPER_ADMIN: "owner-records", marketing: "mkt-orders" },
    (item) => [
      item.orderNo,
      `${item.customerName} · ${item.product} · ${item.grade} · ${item.diameter} · ${item.sdr} · ${item.status}`,
    ],
  )
  add(
    "CUSTOMERS",
    app.customers,
    { OWNER_SUPER_ADMIN: "owner-records", marketing: "mkt-customers" },
    (item) => [item.name, `${item.code} · ${item.contact} · ${item.status}`],
  )
  add(
    "FINISHED PIPES",
    app.finishedGoods,
    {
      OWNER_SUPER_ADMIN: "owner-records",
      management: "mgmt-operations",
      plantmanager: "pm-finished-goods",
      production: "prod-finished-pipes",
      marketing: "mkt-finished-goods",
    },
    (item) => [
      item.barcode || item.fgId,
      `${item.product} · ${item.grade} · ${item.diameter} · ${item.sdr} · ${item.length} · ${item.status}`,
    ],
  )
  add(
    "MATERIAL REQUESTS",
    app.materialRequests,
    {
      OWNER_SUPER_ADMIN: "owner-records",
      plantmanager: "pm-requests",
      accounting: "acc-branch-requests",
    },
    (item) => [
      item.refNo,
      `${item.materialCategory || item.pelletType} · ${item.grade} · ${item.requestedKg} kg · ${item.status}`,
    ],
  )
  add(
    "TRANSFERS",
    app.transfers,
    {
      OWNER_SUPER_ADMIN: "owner-records",
      plantmanager: "pm-transfers",
      accounting: "acc-transfers",
    },
    (item) => [
      item.refNo,
      `${item.source} → ${item.destination} · ${item.grade} · ${item.status}`,
    ],
  )
  add(
    "RECEIVING REPORTS",
    app.rrRecords,
    { OWNER_SUPER_ADMIN: "owner-records", accounting: "acc-rr-records" },
    (item) => [
      item.rrNumber,
      `${item.supplier} · ${item.grade} · ${item.status}`,
    ],
  )
  add(
    "PELLET BAGS",
    app.pellets,
    {
      OWNER_SUPER_ADMIN: "owner-records",
      management: "mgmt-operations",
      plantmanager: "pm-pellets",
      production: "prod-pellets",
      accounting: "acc-raw-materials",
    },
    (item) => [
      item.barcode || item.bagNo,
      `${item.type} · ${item.grade} · ${item.batchNo} · ${item.inventoryStatus} · ${item.currentLocation}`,
    ],
  )
  add(
    "COLORANTS",
    app.colorants,
    {
      OWNER_SUPER_ADMIN: "owner-records",
      management: "mgmt-operations",
      plantmanager: "pm-pellets",
      production: "prod-pellets",
      accounting: "acc-raw-materials",
    },
    (item) => [
      item.colorantId,
      `${item.name} · ${item.usageType} · ${item.status}`,
    ],
  )
  add(
    "EMPLOYEES",
    app.employees,
    { OWNER_SUPER_ADMIN: "owner-users", management: "mgmt-employees" },
    (item) => [
      `${item.firstName} ${item.lastName}`,
      `${item.employeeId} · ${item.role} · ${item.plant} · ${item.defaultShift} · ${item.status}`,
    ],
  )
  const attendance =
    role === "production"
      ? app.attendance.filter((item) => item.employeeId === user.employeeId)
      : app.attendance
  add(
    "ATTENDANCE",
    attendance,
    {
      OWNER_SUPER_ADMIN: "owner-reports",
      management: "mgmt-employees",
      plantmanager: "pm-attendance",
      production: "prod-history",
    },
    (item) => [
      item.employeeName,
      `${item.employeeId} · ${item.date} · ${item.shift} · ${item.status}`,
    ],
  )
  const turnovers =
    role === "production"
      ? app.turnovers.filter(
          (item) =>
            item.outgoingEmployeeId === user.employeeId ||
            item.acceptedByEmployeeId === user.employeeId ||
            item.id === app.pendingTurnover?.id,
        )
      : app.turnovers
  add(
    "SHIFT TURNOVERS",
    turnovers,
    {
      OWNER_SUPER_ADMIN: "owner-records",
      management: "mgmt-reports",
      plantmanager: "pm-turnover",
      production: "prod-history",
    },
    (item) => [
      item.turnoverNo,
      `${item.poRef} · ${item.outgoingEmployee} · ${item.outgoingShift} · ${item.status}`,
    ],
  )
  add(
    "RECYCLING BATCHES",
    app.recyclingBatches,
    {
      OWNER_SUPER_ADMIN: "owner-records",
      management: "mgmt-reports",
      plantmanager: "pm-recycling",
      production: "prod-recycling",
    },
    (item) => [
      item.batchNo,
      `${item.sourcePO || ""} · ${item.product || ""} · ${item.status}`,
    ],
  )
  add(
    "REJECTED MATERIAL",
    app.rejectedMaterials,
    {
      OWNER_SUPER_ADMIN: "owner-records",
      management: "mgmt-reports",
      plantmanager: "pm-recycling",
      production: "prod-recycling",
    },
    (item) => [
      item.rejectionId,
      `${item.poRef} · ${item.product} · ${item.reason}`,
    ],
  )
  const transactions =
    role === "production"
      ? app.transactions.filter((item) => item.employeeId === user.employeeId)
      : app.transactions
  add(
    "INVENTORY MOVEMENTS",
    transactions,
    {
      OWNER_SUPER_ADMIN: "owner-records",
      accounting: "acc-transactions",
      production: "prod-history",
    },
    (item) => [
      item.txId,
      `${item.reference} · ${item.transactionType} · ${item.item} · ${item.status}`,
    ],
  )
  add(
    "MATERIAL USAGE",
    app.materialUsageTransactions,
    {
      OWNER_SUPER_ADMIN: "owner-reports",
      management: "mgmt-reports",
      plantmanager: "pm-material-usage",
    },
    (item) => [
      item.transactionId,
      `${item.productionOrderRef} · ${item.materialName} · ${item.employeeName}`,
    ],
  )
  const auditLogs =
    role === "management"
      ? app.auditLogs.filter(
          (log) =>
            log.role !== "Owner / Super Admin" &&
            !/access change|account created/i.test(log.action),
        )
      : app.auditLogs
  add(
    "AUDIT LOGS",
    auditLogs,
    { OWNER_SUPER_ADMIN: "owner-audit", management: "mgmt-audit" },
    (item) => [
      item.reference || item.id,
      `${item.user} · ${item.action} · ${item.date}`,
    ],
  )
  if (owner)
    add(
      "SYSTEM ACCOUNTS",
      USERS.map(({ password: _password, ...user }) => user),
      { OWNER_SUPER_ADMIN: "owner-users" },
      (item) => [
        item.name,
        `${item.employeeId} · ${item.role} · ${item.status}`,
      ],
    )
  add(
    "PRODUCT SPECIFICATIONS",
    configuration.specifications || [],
    { OWNER_SUPER_ADMIN: "owner-settings" },
    (item) => [
      item.id,
      `${item.productType} · ${item.materialGrade} · ${item.size} · ${item.sdr} · ${specificationLength(item)} · ${item.color} · ${item.stripe}`,
    ],
  )
  add(
    "STOCK TARGETS",
    configuration.stockTargets || [],
    { OWNER_SUPER_ADMIN: "owner-settings" },
    (item) => [
      item.id,
      `${item.plant} · ${item.inventoryType} · ${item.materialGrade || item.color || item.productSpecificationId} · ${item.minimumStock} / ${item.targetStock} · ${item.status}`,
    ],
  )
  add(
    "STORAGE LOCATIONS",
    configuration.locations || [],
    { OWNER_SUPER_ADMIN: "owner-settings" },
    (item) => [
      item.name,
      `${item.plant} · ${item.locationType} · ${item.status}`,
    ],
  )
  add(
    "NOTIFICATIONS",
    app.notifications.filter((item) => (owner || item.roles.includes(role)) && (!item.recipientEmployeeId || owner || item.recipientEmployeeId === user.employeeId)),
    {
      OWNER_SUPER_ADMIN: "notifications",
      accounting: "notifications",
      marketing: "notifications",
      management: "notifications",
      plantmanager: "notifications",
      production: "notifications",
    },
    (item) => [item.title, `${item.priority} · ${item.description}`],
  )
  const printables = printableRecords(app);
  for (const result of results) {
    if (result.group === 'FINISHED PIPES') {
      const pipe = app.finishedGoods.find(item => item.id === result.id);
      if (pipe) result.record = pipeSearchRecord(pipe, { ...app, specifications: configuration.specifications || [] });
    }
    const record = printables.find(item => item.recordId === result.id && (item.reference === result.title || item.value === result.title));
    if (record) result.record = { ...result.record, printStatus: printState(app, record), ...metadataFor(app, record) };
  }
  for (const request of app.reprintRequests || []) {
    if (!canViewRequest(user, request)) continue;
    results.push({ id: request.id, group: 'REPRINT REQUESTS', title: request.printable.reference, subtitle: `${request.id} · ${request.requesterName} · ${request.reason} · ${request.status}`, page: owner ? 'owner-records' : role === 'management' ? 'mgmt-operations' : 'notifications', record: request });
  }
  return results
}

function readConfiguration(): SearchConfiguration {
  try {
    return {
      specifications: (JSON.parse(
        window.localStorage.getItem("hpai:product-specifications-v1") || "[]",
      ) as unknown[])
        .map(normalizeProductSpecification)
        .filter((item): item is ProductSpecification => !!item),
      stockTargets: JSON.parse(
        window.localStorage.getItem("hpai:stock-targets-v1") || "[]",
      ) as StockTarget[],
      locations: JSON.parse(
        window.localStorage.getItem("hpai:storage-locations-v1") || "[]",
      ) as StorageLocation[],
    }
  } catch {
    return {}
  }
}

const fieldLabel = (key: string) =>
  key === "sdr"
    ? "SDR / Thickness"
    : key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (letter) => letter.toUpperCase())

export default function UniversalSearch() {
  const app = useApp()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<{ group: string ; id: string } | null>(
    null,
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const index = useMemo(
    () => buildUniversalIndex(app, readConfiguration()),
    [app, query, open],
  )
  const visible = query.trim()
    ? index.filter((result) =>
        matchesRecord([result.title, result.subtitle, result.record], query),
      )
    : []
  const currentResults = pageRecords(visible, page)
  const groups = Array.from(
    new Set(currentResults.map((result) => result.group)),
  )
  const selectedRecord = selected
    ? index.find(
        (result) =>
          result.id === selected.id && result.group === selected.group,
      )
    : undefined
  useEffect(() => {
    const close = (event: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", key)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); };
  }, [])
  return (
    <div className="universal-search" ref={rootRef}>
      <input
        className="app-input universal-search-input"
        type="search"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setPage(1)
          setOpen(true)
        }}
        placeholder="Search authorized records..."
        aria-label="Universal search"
        aria-expanded={open}
      />
      {open && query.trim() && (
        <div className="universal-search-results" role="dialog" aria-label="Universal search results">
          {groups.map((group) => (
            <section key={group}>
              <div className="universal-search-group">{group}</div>
              {currentResults
                .filter((result) => result.group === group)
                .map((result) => (
                  <button
                    type="button"
                    key={`${group}-${result.id}`}
                    onClick={() => {
                      if (result.group === 'REPRINT REQUESTS') { app.openReprintRequest(result.id); setOpen(false); return; }
                      setSelected({ group, id: result.id })
                      setOpen(false)
                    }}
                  >
                    <strong>{result.title}</strong>
                    <span>{result.subtitle}</span>
                  </button>
                ))}
            </section>
          ))}
          {!visible.length && <div className="universal-search-empty">No authorized records match “{query.trim()}”.</div>}
          <Pagination
            page={page}
            totalRecords={visible.length}
            onPageChange={setPage}
            noun="results"
          />
        </div>
      )}
      <Modal
        open={!!selectedRecord}
        title={
          selectedRecord
            ? `${selectedRecord.group} · ${selectedRecord.title}`
            : "Record"
        }
        onClose={() => setSelected(null)}
        width="760px"
      >
        {selectedRecord && (
          <div className="page-stack">
            <p>{selectedRecord.subtitle}</p>
            <div className="responsive-grid">
              {Object.entries(selectedRecord.record)
                .filter(
                  ([key, value]) =>
                    !/password|token/i.test(key) &&
                    value !== undefined &&
                    value !== null,
                )
                .map(([key, value]) => (
                  <div key={key}>
                    <div className="field-label">{fieldLabel(key)}</div>
                    <div className="field-value search-record-value">
                      {searchableText(value) || "—"}
                    </div>
                  </div>
                ))}
            </div>
            <div className="form-actions">
              <button
                className="btn-secondary"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  app.navigate(selectedRecord.page)
                  setSelected(null)
                  setQuery("")
                }}
              >
                Open Module
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
