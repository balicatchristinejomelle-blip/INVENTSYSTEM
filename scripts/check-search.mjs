import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
})
let checks = 0
const check = (name, callback) => {
  callback()
  checks += 1
  console.log(`PASS ${name}`)
}
try {
  const master = await server.ssrLoadModule("/src/productMaster.ts")
  const { filterSelectOptions } = await server.ssrLoadModule(
    "/src/components/SearchableSelect.tsx",
  )
  const { matchesRecord, searchableText } = await server.ssrLoadModule(
    "/src/components/RecordSearch.tsx",
  )
  const { pageRecords } = await server.ssrLoadModule(
    "/src/components/Pagination.tsx",
  )
  const { buildUniversalIndex } = await server.ssrLoadModule(
    "/src/components/UniversalSearch.tsx",
  )
  const { AppProvider, useApp, USERS } =
    await server.ssrLoadModule("/src/store.tsx")
  const asOptions = (values) => values.map((value) => ({ value, label: value }))
  const searchValues = (values, query) =>
    filterSelectOptions(asOptions(values), query).map((option) => option.value)

  check("all 18 Standard sizes in numeric order", () =>
    assert.deepEqual(master.sizesForProduct("HDPE Pipe"), [
      "13mm",
      "20mm",
      "25mm",
      "32mm",
      "40mm",
      "50mm",
      "63mm",
      "75mm",
      "90mm",
      "110mm",
      "160mm",
      "225mm",
      "280mm",
      "315mm",
      "355mm",
      "400mm",
      "450mm",
      "500mm",
    ]),
  )
  check("Commercial sizes use the same official master", () =>
    assert.deepEqual(
      master.sizesForProduct("Commercial HDPE Pipe (CGPE)"),
      master.STANDARD_DIAMETER_OPTIONS,
    ),
  )
  check(
    "inventory size filters sort numerically and fractions stay ordered",
    () => {
      assert.deepEqual(master.sortSizes(["110mm", "13mm", "90mm", "500mm"]), [
        "13mm",
        "90mm",
        "110mm",
        "500mm",
      ])
      assert.deepEqual(master.sortSizes(['1"', '3/4"', '1/2"']), [
        '1/2"',
        '3/4"',
        '1"',
      ])
    },
  )
  check("315 search and clearing restores 18 sizes", () => {
    assert.deepEqual(searchValues(master.STANDARD_DIAMETER_OPTIONS, " 315 "), [
      "315mm",
    ])
    assert.equal(searchValues(master.STANDARD_DIAMETER_OPTIONS, "").length, 18)
  })
  check("size search ignores spaces and case", () =>
    assert.deepEqual(
      searchValues(master.STANDARD_DIAMETER_OPTIONS, "1 1 0 MM"),
      ["110mm"],
    ),
  )
  check("100mm is not an active Standard size", () =>
    assert.equal(master.STANDARD_DIAMETER_OPTIONS.includes("100mm"), false),
  )
  check("CTS fractions remain searchable", () =>
    assert.deepEqual(
      searchValues(master.sizesForProduct("CTS HDPE Pipe"), "3/4"),
      ['3/4"'],
    ),
  )
  check("Spiral inch sizes remain searchable", () =>
    assert.deepEqual(
      searchValues(master.sizesForProduct("Spiral Pipe"), "16"),
      ['16"'],
    ),
  )
  check("Polytube requires legitimate configured sizes", () =>
    assert.deepEqual(master.sizesForProduct("Polytube"), []),
  )
  check("all nine SDR / Thickness options", () =>
    assert.deepEqual(master.SDR_RATINGS, [
      "SDR9",
      "SDR11",
      "SDR13.5",
      "SDR13.6",
      "SDR17",
      "SDR21",
      "SDR24",
      "SDR26",
      "SDR33",
    ]),
  )
  check("SDR 13 search finds both thickness specifications", () =>
    assert.deepEqual(searchValues(master.SDR_RATINGS, "13"), [
      "SDR13.5",
      "SDR13.6",
    ]),
  )
  check("straight and coil lengths use separate lists", () => {
    assert.deepEqual(
      searchValues(master.lengthsForForm("Straight Length"), "5.86"),
      ["5.86m"],
    )
    assert.deepEqual(searchValues(master.lengthsForForm("Coil"), "250"), [
      "250m",
    ])
    assert.deepEqual(master.lengthsForForm(""), [])
  })
  check("latest four material grades", () =>
    assert.deepEqual(master.MATERIAL_GRADES, [
      "HDPE Standard",
      "PE100",
      "Commercial Grade (CGPE)",
      "CTS Grade",
    ]),
  )
  check("commercial and CTS grades are searchable", () => {
    assert.deepEqual(searchValues(master.MATERIAL_GRADES, "commercial"), [
      "Commercial Grade (CGPE)",
    ])
    assert.deepEqual(searchValues(master.MATERIAL_GRADES, "cts"), ["CTS Grade"])
  })
  check("master product, color, stripe and construction search", () => {
    assert.deepEqual(searchValues(master.PRODUCT_TYPES, "spiral"), [
      "Spiral Pipe",
    ])
    assert.deepEqual(searchValues(master.PRODUCT_COLORS, "(RO)"), [
      "Red Orange (RO)",
    ])
    assert.deepEqual(searchValues(master.STRIPE_OPTIONS, "green"), [
      "Green Stripe",
    ])
    assert.deepEqual(searchValues(master.PIPE_CONSTRUCTIONS, "spiral"), [
      "Spiral Tube",
    ])
  })
  check("record search covers specification and joined name fields", () => {
    const record = {
      firstName: "Maria",
      lastName: "Santos",
      sdr: "SDR11",
      length: "6m",
      diameter: "110mm",
      shipmentReference: "SHIP-9",
    }
    for (const query of ["Maria Santos", "sdr11", "6m", "110 mm", "SHIP-9"])
      assert.ok(matchesRecord(record, query))
  })
  check("private credentials are excluded from search text", () =>
    assert.equal(
      searchableText({
        name: "Visible",
        password: "secret-marker",
        token: "token-marker",
      }),
      "Visible",
    ),
  )
  check("23 matching records paginate 10 / 10 / 3", () => {
    const records = Array.from({ length: 100 }, (_, id) => ({
      id,
      status: id < 23 ? "MATCH" : "other",
    })).filter((record) => matchesRecord(record, "MATCH"))
    assert.equal(records.length, 23)
    assert.deepEqual(
      [1, 2, 3].map((page) => pageRecords(records, page).length),
      [10, 10, 3],
    )
  })

  let base
  function Capture() {
    base = useApp()
    return null
  }
  renderToStaticMarkup(
    React.createElement(AppProvider, null, React.createElement(Capture)),
  )
  assert.ok(base)
  for (const role of [
    "OWNER_SUPER_ADMIN",
    "accounting",
    "marketing",
    "management",
    "plantmanager",
    "production",
  ]) {
    const user = USERS.find((user) => user.role === role)
    assert.ok(user, role)
    const app = { ...base, currentUser: user }
    const configuration = {
      specifications: [
        {
          id: "spec-private",
          productType: "HDPE Pipe",
          materialGrade: "PE100",
          size: "315mm",
          sdr: "SDR11",
          productForm: "Straight Length",
          straightLength: "6m",
          color: "Black (BK)",
          stripe: "No Stripe",
          active: true,
        },
      ],
    }
    const index = buildUniversalIndex(app, configuration)
    check(`${role} has authorized universal search results`, () =>
      assert.ok(index.length > 0),
    )
    check(`${role} index excludes credentials`, () =>
      assert.ok(
        index.every((result) => !Object.hasOwn(result.record, "password")),
      ),
    )
    check(
      `${role} specification settings visibility matches authorization`,
      () =>
        assert.equal(
          index.some((result) => result.group === "PRODUCT SPECIFICATIONS"),
          role === "OWNER_SUPER_ADMIN",
        ),
    )
    if (role === "production")
      check(
        "Production excludes administration and other employee history",
        () => {
          assert.ok(
            index.every(
              (result) =>
                ![
                  "SYSTEM ACCOUNTS",
                  "AUDIT LOGS",
                  "EMPLOYEES",
                  "MATERIAL REQUESTS",
                  "RECEIVING REPORTS",
                  "CUSTOMERS",
                ].includes(result.group),
            ),
          )
          assert.ok(
            index
              .filter(
                (result) =>
                  result.group === "ATTENDANCE" ||
                  result.group === "INVENTORY MOVEMENTS",
              )
              .every((result) => result.record.employeeId === user.employeeId),
          )
        },
      )
    if (role === "marketing")
      check("Marketing excludes raw materials and administration", () =>
        assert.ok(
          index.every(
            (result) =>
              ![
                "PELLET BAGS",
                "COLORANTS",
                "MATERIAL REQUESTS",
                "RECEIVING REPORTS",
                "AUDIT LOGS",
                "SYSTEM ACCOUNTS",
              ].includes(result.group),
          ),
        ),
      )
    if (role === "management")
      check("Management audit search honors protected-log exclusions", () =>
        assert.ok(
          index
            .filter((result) => result.group === "AUDIT LOGS")
            .every(
              (result) =>
                result.record.role !== "Owner / Super Admin" &&
                !/access change|account created/i.test(result.record.action),
            ),
        ),
      )
  }

  function files(dir) {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((item) =>
        item.isDirectory()
          ? files(path.join(dir, item.name))
          : item.name.endsWith(".tsx")
            ? [path.join(dir, item.name)]
            : [],
      )
  }
  const formPages = new Set([
    "Login.tsx",
    "Profile.tsx",
    "GenericPage.tsx",
    "ClockOut.tsx",
    "ShiftAttendance.tsx",
    "BarcodeScanner.tsx",
  ])
  for (const file of files("src/pages")) {
    const source = fs.readFileSync(file, "utf8")
    if (!formPages.has(path.basename(file)) && source.includes("<table"))
      check(`${file} exposes page search`, () =>
        assert.ok(
          /withRecordSearch|\[search,|qualitySearch|PeriodSelector[^>]*search=/.test(
            source,
          ),
        ),
      )
    check(`${file} contains no native non-searchable select`, () =>
      assert.ok(!/<select\b|<datalist\b/.test(source)),
    )
    if (
      formPages.has(path.basename(file)) ||
      file.includes("production\\ShiftTurnover")
    )
      continue
    const page = await server.ssrLoadModule("/" + file.replace(/\\/g, "/"))
    const role = file.includes("owner")
      ? "OWNER_SUPER_ADMIN"
      : file.includes("accounting")
        ? "accounting"
        : file.includes("marketing")
          ? "marketing"
          : file.includes("management")
            ? "management"
            : file.includes("plantmanager")
              ? "plantmanager"
              : "production"
    const user = USERS.find((user) => user.role === role)
    check(`${file} renders with its role context`, () =>
      renderToStaticMarkup(
        React.createElement(
          globalThis.__HPAI_APP_CONTEXT__.Provider,
          { value: { ...base, currentUser: user } },
          React.createElement(page.default),
        ),
      ),
    )
  }
  console.log(
    `Completed ${checks} search, role, pagination and page-render checks.`,
  )
} finally {
  await server.close()
}
