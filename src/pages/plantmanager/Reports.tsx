import RecordReference from '../../components/RecordReference';
import { useViewState } from '../../uiViewState';
import { TableBody } from '../../components/UXFeedback';
import { matchesRecord } from "../../components/RecordSearch"

import ProductFilters, { useProductFilters } from '../../components/ProductFilters';

import SearchableDropdown from "../../components/SearchableDropdown"

import { finishedGoodsSummary, finishedPipeInventory } from '../../finishedGoodsInventory';
import StoragePurposeFilter, { type StoragePurposeSelection } from '../../components/StoragePurposeFilter';
import { inventoryLocationLabel, matchesLocation, locationQuantity } from '../../locationMaster';
import MaterialLocationFilters from '../../components/MaterialLocationFilters';
import { matchesInventoryColor } from '../../productFilters';
import LegacyBarcodeNotice from '../../components/LegacyBarcodeNotice';
import React, { useMemo, useState } from "react"
import FinishedGoodsMetrics from '../../components/FinishedGoodsMetrics';

import { calculateRecyclingMetrics, useApp } from "../../store"

import CategoryTabs from "../../components/CategoryTabs"

import Pagination, { pageRecords } from "../../components/Pagination"

import StatusBadge from "../../components/StatusBadge"

import PeriodSelector, {
  dateInPeriod,
  usePeriod,
} from "../../components/PeriodSelector"

import {
  MATERIAL_CATEGORIES,
  MATERIAL_GRADES, materialGradeFilterLabel,
  normalizedProductType,
  type MaterialCategoryTab,
  type PipeProductType,
} from "../../inventoryCategories"

const REPORTS = [
  "Material Inventory",
  "Finished Goods",
  "Production",
  "Material Usage",
  "Recycling",
] as const

type Report = typeof REPORTS[number]

type Lifecycle = "All" | "Available" | "Open / WIP" | "Fully Consumed"

type FinishedStatus = "All Statuses" | "Awaiting Label / Storage" | "Available" | "Reserved" | "Temporary Storage" | "Ready for Ship Out" | "Released / Shipped Out"

const lifecycleForPellet = (status: string): Exclude<Lifecycle, "All"> => {
  if (status === "Fully Consumed") return "Fully Consumed"

  if (status === "Loaded" || status === "Partially Consumed")
    return "Open / WIP"

  return "Available"
}

export default function PlantManagerReports() {
  const {
    productionOrders,

    pellets,

    colorants,

    finishedGoods,

    materialUsageTransactions,

    rejectedMaterials,

    recyclingBatches,

    turnovers,

    attendance,

    transactions,
  } = useApp()


  const [report, setReport] = useViewState<Report>("plantmanager/Reports:report", "Material Inventory")

  const [page, setPage] = useViewState("plantmanager/Reports:page", 1)
  const productFilters = useProductFilters(() => setPage(1));

  const [search, setSearch] = useViewState("plantmanager/Reports:search", "")
  const period = usePeriod("month", search);

  const [materialCategory, setMaterialCategory] =
    useState<MaterialCategoryTab>("Virgin Pellets")

  const [grade, setGrade] = useViewState("plantmanager/Reports:grade", "All")

  const [lifecycle, setLifecycle] = useState<Lifecycle>("All")

  const [recycledForm, setRecycledForm] =
    useState<"All" | "Complete 25 kg Bags" | "Loose Recycled Pellet">("All")

  const [productType, setProductType] = useViewState<"All" | PipeProductType>("plantmanager/Reports:productType", "All")

  const [finishedGrade, setFinishedGrade] = useViewState("plantmanager/Reports:finishedGrade", "All")
  const [purpose, setPurpose] = useViewState<StoragePurposeSelection>("plantmanager/Reports:purpose", 'All');


  const [finishedStatus, setFinishedStatus] =
    useViewState<FinishedStatus>("plantmanager/Reports:finishedStatus", "All Statuses")

  const [materialLocation, setMaterialLocation] = useState('All');
  const [materialColor, setMaterialColor] = useState('');

  const resetPage = () => setPage(1)

  const periodUsage = materialUsageTransactions.filter((item) =>
    dateInPeriod(item.dateTime, period.range),
  )

  const periodOutput = transactions.filter(
    (item) =>
      item.transactionType === "Production Output" &&
      dateInPeriod(item.date, period.range),
  )

  const activePeriodPOs = new Set(periodOutput.map((item) => item.reference))

  const periodProductionOrders = productionOrders.filter((item) =>
    activePeriodPOs.has(item.poNo),
  )

  const target = periodProductionOrders.reduce(
    (sum, item) => sum + item.targetQty,
    0,
  )

  const actual = periodOutput.reduce(
    (sum, item) => sum + Math.abs(item.qtyChanged),
    0,
  )

  const pelletUsed = periodUsage
    .filter((item) => item.materialType !== "COLORANT")
    .reduce((sum, item) => sum + item.quantity, 0)

  const colorantUsed = periodUsage
    .filter((item) => item.materialType === "COLORANT")
    .reduce((sum, item) => sum + item.quantity, 0)

  const virgin = pellets
    .filter(
      (item) => item.type === "Virgin" && item.inventoryStatus === "Available",
    )
    .reduce((sum, item) => sum + item.availableKg, 0)

  const recycled = pellets
    .filter(
      (item) =>
        item.type === "Recycled" && item.inventoryStatus === "Available",
    )
    .reduce((sum, item) => sum + item.availableKg, 0)

  const periodRejected = rejectedMaterials.filter((item) =>
    dateInPeriod(item.date, period.range),
  )

  const periodRecycling = recyclingBatches.filter((item) =>
    dateInPeriod(item.date, period.range),
  )

  const rejected = periodRejected.reduce((sum, item) => sum + item.weightKg, 0)

  const recovered = periodRecycling.reduce(
    (sum, item) => sum + (item.recoveredKg || 0),
    0,
  )

  const pendingTurnovers = turnovers.filter(
    (item) => item.status === "Pending",
  ).length

  const presentEmployees = attendance.filter(
    (item) => item.status === "Active",
  ).length

  const materialRecords = useMemo(() => {
    if (materialCategory === "Colorants") {
      return colorants.map((item) => ({
        id: item.id,

        date: item.lastUpdated,
        reference: item.colorantId,
        color: item.color,

        category:
          item.usageType === "BASE_COLORANT"
            ? "Base Colorant"
            : "Stripe Colorant",

        grade: "—",

        status: item.status,

        location: inventoryLocationLabel(item),

        balance: `${locationQuantity(item, materialLocation).toFixed(3)} kg`,

        searchable: `${item.colorantId} ${item.name} ${item.color} ${item.status}`,
      }))
    }

    const type = materialCategory === "Virgin Pellets" ? "Virgin" : "Recycled"

    const bags = pellets
      .filter((item) => item.type === type)
      .map((item) => ({
        id: item.id,

        date: item.receivedDate,
        reference: `${item.batchNo} · ${item.bagNo}`,
        color: item.color,

        category: `${item.type} · Complete 25 kg Bag`,

        grade: item.grade || "—",

        status: lifecycleForPellet(item.inventoryStatus),

        location: item.currentLocation || "Not Yet Assigned",

        balance: `${item.availableKg.toFixed(3)} kg`,

        searchable: `${item.barcode} ${item.batchNo} ${item.bagNo} ${item.grade} ${item.color} ${item.currentLocation}`,
      }))

    const loose =
      type === "Recycled"
        ? recyclingBatches
            .filter((item) => (item.looseKg || 0) > 0)
            .map((item) => ({
              id: `loose-${item.id}`,

              date: item.date,
              reference: item.batchNo,
              color: 'Not specified',

              category: "Recycled · Loose Recycled Pellet",

              grade: "—",

              status: item.status === "Completed" ? "Available" : "Open / WIP",

              location:
                item.status === "Completed"
                  ? "Recycling Output"
                  : "Recycling Area",

              balance: `${(item.looseKg || 0).toFixed(3)} kg`,

              searchable: `${item.batchNo} ${item.status} ${item.sourcePO || ""}`,
            }))
        : []

    return [...bags, ...loose]
  }, [colorants, materialCategory, pellets, recyclingBatches, materialLocation])

  const filteredMaterials = materialRecords.filter(
    (item) =>
      dateInPeriod(item.date, period.range) && ((() => { const original = pellets.find(row => row.id === item.id) || colorants.find(row => row.id === item.id); return original ? matchesLocation(original, materialLocation) && matchesInventoryColor(original.color, materialColor) : materialLocation === 'All' && !materialColor; })()) &&
      (materialCategory === "Colorants" ||
        grade === "All" ||
        item.grade === grade) &&
      (materialCategory !== "Recycled Pellets" ||
        recycledForm === "All" ||
        (recycledForm === "Complete 25 kg Bags"
          ? item.category.includes("Complete")
          : item.category.includes("Loose"))) &&
      (materialCategory === "Colorants" ||
        lifecycle === "All" ||
        item.status === lifecycle) &&
      matchesRecord(item, search),
  )

  const finishedProductEligible = useMemo(
    () =>
      finishedGoods.filter(
        (item) =>
          productType === "All" ||
          normalizedProductType(item.product) === productType,
      ),
    [finishedGoods, productType],
  )



  const filteredFinished = finishedProductEligible.filter((item) => {
    if (!dateInPeriod(item.productionDate, period.range)) return false;
    if (purpose !== 'All' && finishedPipeInventory(item).purpose !== purpose) return false;
    const statusMatches =
      finishedStatus === "All Statuses" ||
      (finishedStatus === "Awaiting Label / Storage" &&
        item.locationStatus === "Awaiting Storage") ||
      (finishedStatus === "Available" &&
        item.status === "Available" &&
        item.releaseStatus !== "Released") ||
      (finishedStatus === "Reserved" && finishedPipeInventory(item).bucket === 'Reserved') ||
      (finishedStatus === "Temporary Storage" && finishedPipeInventory(item).bucket === 'Temporary Storage') ||
      (finishedStatus === "Ready for Ship Out" &&
        item.status === "Ready for Release") ||
      (finishedStatus === "Released / Shipped Out" &&
        item.releaseStatus === "Released")

    return (
      statusMatches &&
      (finishedGrade === "All" || item.grade === finishedGrade) &&
      productFilters.matches(item, { product: '', grade: '' }) &&
      ([
        item.barcode,
        item.fgId,
        item.product,
        item.grade,
        item.diameter,
        item.sdr,
        item.poRef,
        item.reservedForOrderRef || "",
      ]

        .some((value) => value.toLowerCase().includes(search.toLowerCase())) ||
        matchesRecord(item, search))
    )
  })

  const filteredProduction = periodProductionOrders.filter(
    (item) =>
      productFilters.matches(item, { product: '' }) &&
      (productType === "All" ||
        normalizedProductType(item.product) === productType) &&
      ([
        item.poNo,
        item.moRef,
        item.product,
        item.grade,
        item.diameter,
        item.productionLine,
        item.status,
      ]

        .some((value) => value.toLowerCase().includes(search.toLowerCase())) ||
        matchesRecord(item, search)),
  )

  const filteredUsage = periodUsage.filter(
    (item) =>
      [
        item.transactionId,
        item.productionOrderRef,
        item.materialType,
        item.materialName,
        item.employeeName,
      ]

        .some((value) => value.toLowerCase().includes(search.toLowerCase())) ||
      matchesRecord(item, search),
  )

  const filteredRecycling = periodRecycling.filter(
    (item) =>
      productFilters.matches(item) && ([item.batchNo, item.status, item.sourcePO || "", item.product || ""]

        .some((value) => value.toLowerCase().includes(search.toLowerCase())) ||
      matchesRecord(item, search)),
  )

  const recyclingMetrics = periodRecycling

    .filter((item) => item.recoveredKg != null)

    .map((item) =>
      calculateRecyclingMetrics(
        item.originalKg,
        item.cutMaterialKg ?? item.originalKg,
        item.recoveredKg!,
      ),
    )

  const totalRecyclingLoss = recyclingMetrics.reduce(
    (sum, item) => sum + item.totalRecyclingLossKg,
    0,
  )

  const changeReport = (next: Report) => {
    setReport(next)

    setSearch("")

    resetPage()
  }

  return (
    <div className="page-stack">
      <PeriodSelector period={period} search={search} onSearchChange={value => { setSearch(value); resetPage(); }} onDateChange={resetPage} />
      <CategoryTabs
        items={REPORTS}
        value={report}
        onChange={changeReport}
        label="Report type"
      />
      {report === 'Recycling' && <ProductFilters records={[...rejectedMaterials, ...recyclingBatches].filter(item => dateInPeriod(item.date, period.range) && matchesRecord(item, search))} value={productFilters.value} onChange={productFilters.change} includeProduct includeGrade includeColor includeLocation includeLength />}

      {report === "Material Inventory" && (
        <>
          <div className="kpi-grid">
            {[
              ["Current Virgin Pellet", `${virgin.toFixed(1)} kg`],
              ["Current Recycled Pellet", `${recycled.toFixed(1)} kg`],
              [
                "Current Open WIP",
                `${pellets
                  .filter((item) =>
                    ["Loaded", "Partially Consumed"].includes(
                      item.inventoryStatus,
                    ),
                  )
                  .reduce((sum, item) => sum + item.availableKg, 0)
                  .toFixed(1)} kg`,
              ],
              [
                "Current Fully Consumed Bags",
                pellets.filter(
                  (item) => item.inventoryStatus === "Fully Consumed",
                ).length,
              ],
            ].map(([label, value]) => (
              <div className="app-card kpi-card" key={label}>
                <div>{label}</div>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <CategoryTabs
            items={MATERIAL_CATEGORIES}
            value={materialCategory}
            onChange={(value) => {
              setMaterialCategory(value)
              setGrade("All")
              setLifecycle("All")
              setRecycledForm("All")
              resetPage()
            }}
            label="Material report category"
          />
          <div className="app-card detail-card page-stack">
            {materialCategory === "Recycled Pellets" && (
              <CategoryTabs
                items={
                  [
                    "All",
                    "Complete 25 kg Bags",
                    "Loose Recycled Pellet",
                  ] as const
                }
                value={recycledForm}
                onChange={(value) => {
                  setRecycledForm(value)
                  resetPage()
                }}
                label="Recycled pellet form"
              />
            )}

            <MaterialLocationFilters status={lifecycle} onStatusChange={materialCategory === 'Colorants' ? undefined : value => { setLifecycle(value as Lifecycle); resetPage(); }} statusFor={item => item.inventoryStatus ? lifecycleForPellet(item.inventoryStatus) : item.status || ''} records={materialRecords.filter(item => dateInPeriod(item.date, period.range) && matchesRecord(item, search) && (materialCategory !== 'Recycled Pellets' || recycledForm === 'All' || (recycledForm === 'Complete 25 kg Bags' ? item.category.includes('Complete') : item.category.includes('Loose')))).map(item => pellets.find(record => record.id === item.id) || colorants.find(record => record.id === item.id) || {})} grade={grade} onGradeChange={materialCategory === 'Colorants' ? undefined : value => { setGrade(value); resetPage(); }} color={materialColor} location={materialLocation} onColorChange={value => { setMaterialColor(value); resetPage(); }} onLocationChange={value => { setMaterialLocation(value); resetPage(); }} />
          </div>
          <div className="app-card table-scroll">
            <div className="table-title">{materialCategory} Detail</div>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Category / Form</th>
                  <th>Material Grade</th>
                  <th>Color</th>
                  <th>Lifecycle</th>
                  <th>Location</th>
                  <th>Available</th>
                </tr>
              </thead>
              <TableBody>
                {pageRecords(filteredMaterials, page).map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono po-column">{item.reference}</td>
                    <td>{item.category}</td>
                    <td>{item.grade}</td>
                    <td>{item.color}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{item.location}</td>
                    <td className="font-mono">{item.balance}</td>
                  </tr>
                ))}
              </TableBody>
            </table>
            <Pagination
              page={page}
              totalRecords={filteredMaterials.length}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {report === "Finished Goods" && (
        <>
          <LegacyBarcodeNotice query={search} pipes={finishedGoods} />
          <div className="kpi-grid">
            {[
              ["Matching Pipes", filteredFinished.length],
              [
                "Available",
                filteredFinished.filter((item) => item.status === "Available")
                  .length,
              ],
              [
                "Reserved",
                filteredFinished.filter((item) => item.status === "Reserved")
                  .length,
              ],
              [
                "Ready for Ship Out",
                filteredFinished.filter(
                  (item) => item.status === "Ready for Release",
                ).length,
              ],
            ].map(([label, value]) => (
              <div className="app-card kpi-card" key={label}>
                <div>{label}</div>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <FinishedGoodsMetrics pipes={filteredFinished} />
          <div className="filter-panel product-filter-panel">

            <ProductFilters value={productFilters.value} onChange={productFilters.change} product={productType} onProductChange={value => { setProductType(value as 'All' | PipeProductType); resetPage(); }} grade={finishedGrade} onGradeChange={value => { setFinishedGrade(value); resetPage(); }} includeColor includeLocation includeLength
              records={finishedGoods.filter(item => dateInPeriod(item.productionDate, period.range) && matchesRecord(item, search))}
              purpose={purpose} onPurposeChange={value => { setPurpose(value as StoragePurposeSelection); resetPage(); }}
              status={finishedStatus} onStatusChange={value => { setFinishedStatus(value as FinishedStatus); resetPage(); }}
              statusOptions={['Awaiting Label / Storage', 'Available', 'Reserved', 'Temporary Storage', 'Ready for Ship Out', 'Released / Shipped Out']}
              statusFor={pipe => pipe.releaseStatus === 'Released' ? 'Released / Shipped Out' : pipe.locationStatus === 'Awaiting Storage' ? 'Awaiting Label / Storage' : pipe.status === 'Ready for Release' ? 'Ready for Ship Out' : ['Available','Reserved','Temporary Storage'].includes(finishedPipeInventory(pipe).bucket) ? finishedPipeInventory(pipe).bucket : ''} />
          </div>
          <div className="app-card table-scroll">
            <div className="table-title">Finished Goods / Pipe Inventory</div>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Product Type</th>
                  <th>Grade</th>
                  <th>Size / SDR-Thickness / Length</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th className="po-column">PO</th>
                  <th>Customer Order</th>
                </tr>
              </thead>
              <TableBody>
                {pageRecords(filteredFinished, page).map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono"><RecordReference value={item.barcode} /></td>
                    <td>{normalizedProductType(item.product)}</td>
                    <td>{item.grade}</td>
                    <td>
                      {item.diameter} · {item.sdr} · {item.length}
                    </td>
                    <td>
                      <StatusBadge
                        status={
                          item.releaseStatus === "Released"
                            ? "Released"
                            : item.status
                        }
                      />
                    </td>
                    <td>{item.currentLocation}</td>
                    <td className="font-mono po-column"><RecordReference value={item.poRef} /></td>
                    <td className="font-mono">
                      {item.reservedForOrderRef || "—"}
                    </td>
                  </tr>
                ))}
              </TableBody>
            </table>
            <Pagination
              page={page}
              totalRecords={filteredFinished.length}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {report === "Production" && (
        <>
          <div className="kpi-grid">
            {[
              ["Total Production", actual],
              ["Production Target", target],
              [
                "Completion",
                `${target ? ((actual / target) * 100).toFixed(1) : 0}%`,
              ],
              [
                "Active Orders",
                productionOrders.filter(
                  (item) => item.status === "In Production",
                ).length,
              ],
            ].map(([label, value]) => (
              <div className="app-card kpi-card" key={label}>
                <div>{label}</div>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="toolbar">

            <ProductFilters records={periodProductionOrders.filter(item => matchesRecord(item, search))} value={productFilters.value} onChange={productFilters.change} product={productType} onProductChange={value => { setProductType(value as 'All' | PipeProductType); resetPage(); }} includeGrade includeColor includeLocation includeLength />
          </div>
          <div className="app-card table-scroll">
            <div className="table-title">Production Order Detail</div>
            <table className="app-table">
              <thead>
                <tr>
                  <th className="po-column">Production Order</th>
                  <th>MO</th>
                  <th>Product Type</th>
                  <th>Grade / Size</th>
                  <th>Line</th>
                  <th>Completed / Target</th>
                  <th>Status</th>
                </tr>
              </thead>
              <TableBody>
                {pageRecords(filteredProduction, page).map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono po-column"><RecordReference value={item.poNo} /></td>
                    <td className="font-mono"><RecordReference value={item.moRef} /></td>
                    <td>{normalizedProductType(item.product)}</td>
                    <td>
                      {item.grade} · {item.diameter}
                    </td>
                    <td>{item.productionLine}</td>
                    <td>
                      {item.completedQty} / {item.targetQty}
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </TableBody>
            </table>
            <Pagination
              page={page}
              totalRecords={filteredProduction.length}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {report === "Material Usage" && (
        <>
          <div className="kpi-grid">
            {[
              ["Pellet Consumption", `${pelletUsed.toFixed(3)} kg`],
              ["Colorant Consumption", `${colorantUsed.toFixed(3)} kg`],
              [
                "Total Consumption",
                `${(pelletUsed + colorantUsed).toFixed(3)} kg`,
              ],
              ["Employees Present", presentEmployees],
            ].map(([label, value]) => (
              <div className="app-card kpi-card" key={label}>
                <div>{label}</div>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div className="app-card table-scroll">
            <div className="table-title">Inventory Transaction Detail</div>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th className="po-column">PO</th>
                  <th>Material Type</th>
                  <th>Material</th>
                  <th>Employee</th>
                  <th>Used kg</th>
                  <th>Date / Time</th>
                </tr>
              </thead>
              <TableBody>
                {pageRecords(filteredUsage, page).map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono">{item.transactionId}</td>
                    <td className="font-mono po-column">{item.productionOrderRef}</td>
                    <td>{item.materialType.replace(/_/g, " ")}</td>
                    <td>{item.materialName}</td>
                    <td>{item.employeeName}</td>
                    <td>{item.quantity.toFixed(3)}</td>
                    <td>{new Date(item.dateTime).toLocaleString("en-PH")}</td>
                  </tr>
                ))}
              </TableBody>
            </table>
            <Pagination
              page={page}
              totalRecords={filteredUsage.length}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {report === "Recycling" && (
        <>
          <div className="kpi-grid">
            {[
              ["Rejected Material", `${rejected.toFixed(3)} kg`],
              ["Recovered Pellets", `${recovered.toFixed(3)} kg`],
              ["Total Recycling Loss", `${totalRecyclingLoss.toFixed(3)} kg`],
              ["Pending Turnovers", pendingTurnovers],
            ].map(([label, value]) => (
              <div className="app-card kpi-card" key={label}>
                <div>{label}</div>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div className="app-card table-scroll">
            <div className="table-title">Recycling Batch Detail</div>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th className="po-column">Source PO</th>
                  <th>Product</th>
                  <th>Input kg</th>
                  <th>Recovered kg</th>
                  <th>Loose kg</th>
                  <th>Status</th>
                </tr>
              </thead>
              <TableBody>
                {pageRecords(filteredRecycling, page).map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono"><RecordReference value={item.batchNo} /></td>
                    <td className="font-mono po-column">{item.sourcePO || "—"}</td>
                    <td>{item.product || "—"}</td>
                    <td>{item.originalKg.toFixed(3)}</td>
                    <td>{item.recoveredKg?.toFixed(3) || "—"}</td>
                    <td>{item.looseKg?.toFixed(3) || "—"}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </TableBody>
            </table>
            <Pagination
              page={page}
              totalRecords={filteredRecycling.length}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  )
}
