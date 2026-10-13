import React, { createContext, useContext, useEffect, useState } from "react"
import { useApp } from "../store"

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
  [Key in keyof App]: App[Key] extends readonly unknown[] ? Key : never
}[keyof App]
const SearchContext = createContext<{
  query: string
  collections: readonly RecordCollection[]
}>({ query: "", collections: [] })
export const useRecordQuery = () => useContext(SearchContext).query

/** A read-only view of this page's authorized collections; store actions keep their original state. */
export function useSearchableApp(): App {
  const app = useApp()
  const { query, collections } = useContext(SearchContext)
  if (!query.trim()) return app
  const filtered = Object.fromEntries(
    collections.map((key) => [
      key,
      (app[key] as readonly unknown[]).filter((record) =>
        matchesRecord(record, query),
      ),
    ]),
  )
  return { ...app, ...filtered }
}

export function useSearchPaginationReset(
  ...resetters: Array<(page: number) => void>
) {
  const query = useRecordQuery()
  useEffect(() => {
    resetters.forEach((reset) => reset(1))
  }, [query])
}

export function withRecordSearch(
  Page: React.ComponentType,
  collections: readonly RecordCollection[],
) {
  return function SearchableRecordPage() {
    const [query, setQuery] = useState("")
    return (
      <SearchContext.Provider value={{ query, collections }}>
        <div className="page-stack">
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
          <Page />
        </div>
      </SearchContext.Provider>
    )
  }
}
