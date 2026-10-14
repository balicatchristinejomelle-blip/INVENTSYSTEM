import React, { createContext, useContext, useEffect, useState } from "react"
import { useApp } from "../store"
import { withPrintSearch } from '../printableRecords';
import ProductFilters, { useProductFilters } from './ProductFilters';
import { emptyProductFilter, matchesProductFilter, type ProductFilter } from '../productFilters';

export const normalizeQuery = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim()
const privateKeys = new Set([
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
])
export function searchableText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value !== "object") return String(value)
  if (Array.isArray(value)) return value.map(searchableText).join(" ")
  return Object.entries(value)
    .filter(([key]) => !privateKeys.has(key))
    .map(([, field]) => searchableText(field))
    .join(" ")
}
export function matchesRecord(record: unknown, query: string) {
  const needle = normalizeQuery(query)
  if (!needle) return true
  const text = normalizeQuery(searchableText(record))
  return (
    text.includes(needle) ||
    text.replace(/\s+/g, "").includes(needle.replace(/\s+/g, ""))
  )
}

type App = ReturnType<typeof useApp>
export type RecordCollection = {
  [Key in keyof App]-?: App[Key] extends readonly unknown[] ? Key : never
}[keyof App]
const SearchContext = createContext<{
  query: string
  collections: readonly RecordCollection[]
  productFilter?: ProductFilter
}>({ query: "", collections: [] })
export const useRecordQuery = () => useContext(SearchContext).query

/** A read-only view of this page's authorized collections; store actions keep their original state. */
export function useSearchableApp(): App {
  const app = useApp()
  const { query, collections, productFilter } = useContext(SearchContext)
  if (!query.trim() && !productFilter) return app
  const filtered = Object.fromEntries(
    collections.map((key) => [
      key,
      (app[key] as readonly unknown[]).filter((record) =>
        matchesRecord(record && typeof record === 'object' && 'id' in record ? withPrintSearch(app, record as { id: string }) : record, query)
          && (!productFilter || !['orders', 'manufacturingOrders', 'productionOrders', 'finishedGoods', 'pellets', 'colorants', 'rejectedMaterials', 'transactions', 'turnovers'].includes(key) || matchesProductFilter(record, productFilter, app)),
      ),
    ]),
  )
  return { ...app, ...filtered }
}

export function useSearchPaginationReset(
  ...resetters: Array<(page: number) => void>
) {
  const { query, productFilter } = useContext(SearchContext)
  useEffect(() => {
    resetters.forEach((reset) => reset(1))
  }, [query, productFilter])
}

export function withRecordSearch(
  Page: React.ComponentType,
  collections: readonly RecordCollection[],
  productControls = false,
) {
  return function SearchableRecordPage() {
    const [query, setQuery] = useState("")
    const productFilters = useProductFilters();
    return (
      <SearchContext.Provider value={{ query, collections, productFilter: productControls && Object.keys(emptyProductFilter).some(key => productFilters.value[key as keyof ProductFilter]) ? productFilters.value : undefined }}>
        <div className={`page-stack${productControls ? ' product-filter-page' : ''}`}>
          <div className="record-filter-bar">
            <input
              className="app-input record-search"
              type="search"
              aria-label="Search page records"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reference, name, specification, barcode, location, date, or status..."
            />
          </div>
          {productControls && <ProductFilters value={productFilters.value} onChange={productFilters.change} includeProduct includeGrade includeColor includeLocation includeLength />}
          <Page />
        </div>
      </SearchContext.Provider>
    )
  }
}
