import React, { createContext, useContext } from "react"
import { useApp } from "../store"
import { withPrintSearch } from '../printableRecords';
import ProductFilters, { useProductFilters } from './ProductFilters';
import { emptyProductFilter, matchesProductFilter, type ProductFilter } from '../productFilters';
import { useViewState, useFilterChangeEffect } from '../uiViewState';
import { ActiveFilters } from './UXFeedback';
import PeriodSelector, { usePeriod } from './PeriodSelector';
import { DateSearchContext } from './DateSearchContext';
import { COLLECTION_DATE_FIELDS, dateInPeriod, matchesRecordDate, parseSpecificDate, primaryRecordDate, type PeriodRange } from '../datePeriods';

export const normalizeQuery = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim()
const privateKeys = new Set(["password", "passwordHash", "token", "accessToken", "refreshToken"])
export function searchableText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value !== "object") return String(value)
  if (Array.isArray(value)) return value.map(searchableText).join(" ")
  return Object.entries(value).filter(([key]) => !privateKeys.has(key)).map(([, field]) => searchableText(field)).join(" ")
}
export function matchesRecord(record: unknown, query: string) {
  const needle = normalizeQuery(query)
  if (!needle) return true
  const exact = parseSpecificDate(needle)
  if (exact) return matchesRecordDate(record, exact)
  const text = normalizeQuery(searchableText(record))
  return text.includes(needle) || text.replace(/\s+/g, "").includes(needle.replace(/\s+/g, ""))
}

type App = ReturnType<typeof useApp>
export type RecordCollection = { [Key in keyof App]-?: App[Key] extends readonly unknown[] ? Key : never }[keyof App]
const SearchContext = createContext<{
  query: string; collections: readonly RecordCollection[]; productFilter?: ProductFilter; dateRange?: PeriodRange;
}>({ query: "", collections: [] })
export const useRecordQuery = () => useContext(SearchContext).query

/** Read-only page views: operational store records and actions retain their original state. */
export function useSearchableApp(): App {
  const app = useApp()
  const { query, collections, productFilter, dateRange } = useContext(SearchContext)
  if (!query.trim() && !productFilter && !dateRange?.start) return app
  const filtered = Object.fromEntries(collections.map(key => [key, (app[key] as readonly unknown[]).filter(record =>
    (!dateRange || !COLLECTION_DATE_FIELDS[key] || dateInPeriod(primaryRecordDate(record, COLLECTION_DATE_FIELDS[key]), dateRange))
    && matchesRecord(record && typeof record === 'object' && 'id' in record ? withPrintSearch(app, record as { id: string }) : record, query)
    && (!productFilter || !['orders', 'manufacturingOrders', 'productionOrders', 'finishedGoods', 'pellets', 'colorants', 'rejectedMaterials', 'transactions', 'turnovers'].includes(key) || matchesProductFilter(record, productFilter, app))
  )]))
  return { ...app, ...filtered }
}
export function useSearchPaginationReset(...resetters: Array<(page: number) => void>) {
  const { query, productFilter, dateRange } = useContext(SearchContext)
  useFilterChangeEffect(() => { resetters.forEach(reset => reset(1)) }, [query, productFilter, dateRange?.start, dateRange?.end])
}
export function withRecordSearch(Page: React.ComponentType, collections: readonly RecordCollection[], productControls = false, dateControls = true) {
  return function SearchableRecordPage() {
    const [query, setQuery] = useViewState('page-search', "")
    const productFilters = useProductFilters(undefined, 'page-product-filters')
    const period = usePeriod('all', query)
    const showPeriod = dateControls && collections.some(key => !!COLLECTION_DATE_FIELDS[key])
    return <DateSearchContext.Provider value={{ query, clear: () => setQuery('') }}>
      <SearchContext.Provider value={{ query, collections, dateRange: showPeriod ? period.range : undefined,
        productFilter: productControls && Object.keys(emptyProductFilter).some(key => productFilters.value[key as keyof ProductFilter]) ? productFilters.value : undefined }}>
        <div className={'page-stack' + (productControls ? ' product-filter-page' : '')}>
          {showPeriod ? <PeriodSelector period={period} search={query} onSearchChange={setQuery}
            placeholder="Search reference, name, specification, barcode, location, date, or status..." /> : <>
            <div className="record-filter-bar"><input className="app-input record-search" type="search" aria-label="Search page records"
              value={query} onChange={event => setQuery(event.target.value)}
              placeholder="Search reference, name, specification, barcode, location, date, or status..." /></div>
            <ActiveFilters items={parseSpecificDate(query) ? [] : [['Search', query]]} onClear={() => setQuery('')} clearLabel="Clear search" />
          </>}
          {productControls && <ProductFilters value={productFilters.value} onChange={productFilters.change} includeProduct includeGrade includeColor includeLocation includeLength />}
          <Page />
        </div>
      </SearchContext.Provider>
    </DateSearchContext.Provider>
  }
}
