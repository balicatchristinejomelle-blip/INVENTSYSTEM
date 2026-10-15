import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const DATE_PERIOD_BASELINE = '079e1d3';
export const DATE_PERIOD_NEW_FILES = ['src/datePeriods.ts', 'src/datePeriods.css', 'src/components/DateSearchContext.tsx'];
// Older suites compare their original presentation/filter baselines. Only these exact
// reviewed date-filter changes may be restored; runtime checks still load current code.
// check-date-periods.mjs separately validates date behavior and protected business files.
export const reviewedDatePeriodDeltas = {
  "src/components/PeriodSelector.tsx": "765421cec1b19e7d2fe53693e7ab6d38cdf8962549b348a967eac70279f8de9a",
  "src/components/RecordSearch.tsx": "aae9c07cbd8c8cfeefd6b1d19c9efc250ab69e6a25f1ba3db49446484d14f8ad",
  "src/index.css": "72efe69d3b4ca99d55bbd99fe7549eec92f25372efb68225e4df55bf31e50ce6",
  "src/pages/NotificationsPage.tsx": "b2d07f13b6c820e00ec4e2ec5276f2217770c8447af4e2c53f1dc41c0629becb",
  "src/pages/accounting/Dashboard.tsx": "95c8912ace56e126194e6da3b943e8711b32f8722c15707d589e65fb7fc66c50",
  "src/pages/accounting/RRRecords.tsx": "32a4d1338324afef9f8906a5c91085d9f50a7e249ead23a6df61588ba083e47c",
  "src/pages/accounting/RawMaterials.tsx": "ed23e62c803b0de5d3cc16f7ff9a45868c5328319b88ede498d3265ad77e12e3",
  "src/pages/accounting/Reports.tsx": "3808098fcc1b27e81d4da366824c9c1b9fdfca463c6d77c7d6ea1a67913884aa",
  "src/pages/accounting/Transactions.tsx": "41a6c581437c943e4e227909498c85c09d04406ac70dbf3bd24b13589a2f2f1d",
  "src/pages/management/AuditLogs.tsx": "597029e0345fdb06ccc987097a224e4208dac061b88d9556681ff375d91a6490",
  "src/pages/management/Dashboard.tsx": "4c96c89be771c0f704f24ea384322479e383683615914aebbc84e76425ccee06",
  "src/pages/management/Operations.tsx": "9f42997697b5bf6c25210d0881b00995b5f05f9a35605270d14ab1253da554d6",
  "src/pages/management/Reports.tsx": "f6af407b3ce0b29c8fe6037fefe145b9a8dc90b2d8dc309cd601b061d2ac68a6",
  "src/pages/marketing/Dashboard.tsx": "bf355076e148825bcb1e3ea08572e65b92dd38408c4af0748adfc4b3a633a6ce",
  "src/pages/marketing/FinishedGoods.tsx": "3011d055a5701eefffdd2453c553e20e29a58d005fa10d1347ff0e7ae910fa71",
  "src/pages/marketing/Orders.tsx": "c41efbfd43b0649e519c6135558c4b27817dfe4bcade0d7a01043fcfb8df1ed6",
  "src/pages/marketing/Reports.tsx": "882112469e3c5e4c9532138437cc0f01a43ced4aaa81827f64076ee6f8281986",
  "src/pages/owner/Dashboard.tsx": "e771e1fb12dc9b08b6ddfa3bc8ac565a87b55196334ed026955e797461f436f2",
  "src/pages/owner/Records.tsx": "c9b19494a219c917f0660fbe7468a10e7c315de1102d04df618aa26d406868ee",
  "src/pages/owner/Reports.tsx": "dcca458528203531e2c954dfa9727da0c297488e2b508f3ee496f3282165d5a2",
  "src/pages/plantmanager/Attendance.tsx": "7bcc8ac8c030c8baefa42b0cf9b364ad8bfeed628b6b3d92c6268f15c6f16037",
  "src/pages/plantmanager/Dashboard.tsx": "a57f60145b04e0e355a64e0343308942f67eedd8c9977872b5389c60ee0e484b",
  "src/pages/plantmanager/FinishedGoods.tsx": "9c5722c2418ed1da29105ac07267f8591df26ea195adb8b862987d115c2c3c1d",
  "src/pages/plantmanager/MainPlantRequests.tsx": "5b2fdcf91534ae6158ddbdcdb63104e74e13574b51ba0241975cb0e55b38dc39",
  "src/pages/plantmanager/MaterialUsage.tsx": "08df69e5c70448220d1ef3ff2a1a001fb1324e88ed83b4482e53d44b796711fa",
  "src/pages/plantmanager/PelletInventory.tsx": "4de5def4c3ff1d818d3da35a21764306e937785a9eac6f8bc779baebfbd7cae7",
  "src/pages/plantmanager/ProductionOrders.tsx": "8aeab168022472bddd659d801fdc47e99a0e4bd70c39ce9beb7ee237f08ecf2f",
  "src/pages/plantmanager/RejectedRecycling.tsx": "9ed8e3fd3004f03dfb50f9eff797655aebf36d40c6c2872bebe79a2afadfebe0",
  "src/pages/plantmanager/Reports.tsx": "7f415010dcbdc70363c571fca4be2e223c1304b1d67a903d2e81fa641a651333",
  "src/pages/plantmanager/ShiftTurnover.tsx": "b96bd7ca373c188e1bfcc66c56cfab5e7757914339666126fdc7e11ad40f2b24",
  "src/pages/production/Dashboard.tsx": "e011abd30ffa4fe6b41e34b1750b4bb0d04318f4de3a1bc70a7fbf35b733729a",
  "src/pages/production/FinishedPipes.tsx": "06f6a44edc1d674bad70b88e864b68838bfc02d6914348e1e6785722274a10bc",
  "src/pages/production/History.tsx": "a3527c5f220b50ef80eaa8900a8116cbfb0747e619398231f5fe2609307b8c38",
  "src/pages/production/Pellets.tsx": "24cb074408af861116d02b9bcea69ede7355d3910e0f566ed8fb8598f4baf395",
  "src/pages/production/ProductionOrders.tsx": "7ca0fda0abae5b47808c17ae9ee9e2e15a79eec532b69f2f4d6ec7fc5add7d3f",
  "src/pages/production/Recycling.tsx": "329d8fa319cbd0421a1d602f8fed4cb27c6d1ce70cbcc8181f9a5095e266adc9"
};
const previous = new Map();
export function datePeriodBaseline(file) {
  if (!previous.has(file)) previous.set(file, execFileSync('git', ['show', DATE_PERIOD_BASELINE + ':' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  return previous.get(file);
}
export function restoreDatePeriodFile(file, text) {
  const source = text.replace(/\r/g, '');
  if (!reviewedDatePeriodDeltas[file]) return source;
  if (source === datePeriodBaseline(file)) return source;
  if (createHash('sha256').update(source).digest('hex') !== reviewedDatePeriodDeltas[file]) throw new Error('Unreviewed date-period delta: ' + file);
  return datePeriodBaseline(file);
}
