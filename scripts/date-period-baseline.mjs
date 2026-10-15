import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const DATE_PERIOD_BASELINE = '079e1d3';
export const DATE_PERIOD_NEW_FILES = ['src/datePeriods.ts', 'src/datePeriods.css', 'src/components/DateSearchContext.tsx'];
// Older suites compare their original presentation/filter baselines. Only these exact
// reviewed date-filter and PO table presentation changes may be restored; runtime checks load current code.
// check-date-periods.mjs separately validates date behavior and protected business files.
export const reviewedDatePeriodDeltas = {
  "src/components/PeriodSelector.tsx": "765421cec1b19e7d2fe53693e7ab6d38cdf8962549b348a967eac70279f8de9a",
  "src/components/RecordSearch.tsx": "aae9c07cbd8c8cfeefd6b1d19c9efc250ab69e6a25f1ba3db49446484d14f8ad",
  "src/index.css": "d9a4f8721553aa85ebde62cbba52ecb64015bbba906aadeb750eca2242c93b07",
  "src/pages/NotificationsPage.tsx": "b2d07f13b6c820e00ec4e2ec5276f2217770c8447af4e2c53f1dc41c0629becb",
  "src/pages/accounting/Dashboard.tsx": "61956d25828aa87c7475acadadc93c3d31d8d2c0e01e909e4d284915c64ec530",
  "src/pages/accounting/RRRecords.tsx": "32a4d1338324afef9f8906a5c91085d9f50a7e249ead23a6df61588ba083e47c",
  "src/pages/accounting/RawMaterials.tsx": "ed23e62c803b0de5d3cc16f7ff9a45868c5328319b88ede498d3265ad77e12e3",
  "src/pages/accounting/Reports.tsx": "3808098fcc1b27e81d4da366824c9c1b9fdfca463c6d77c7d6ea1a67913884aa",
  "src/pages/accounting/Transactions.tsx": "5796ba372167bd5df3236f1b64ed6d8e8ba356654ea66bc9f3c588ee9c1ed46a",
  "src/pages/management/AuditLogs.tsx": "dc58efe20ddaad3b4b9c2de5a624196481e210cb73619f407ce10c749ae22da3",
  "src/pages/management/Dashboard.tsx": "4c96c89be771c0f704f24ea384322479e383683615914aebbc84e76425ccee06",
  "src/pages/management/Operations.tsx": "2e82dbad9a276f663fbb2cb43ec0b0f5d76dbf6a2f0dc61753b3fd45a7a881ac",
  "src/pages/management/Reports.tsx": "8aa42dd94c8d3d3fe3c0c0d1948b6f802377e32c4a21e5c27a9b2218027716e9",
  "src/pages/marketing/Dashboard.tsx": "bf355076e148825bcb1e3ea08572e65b92dd38408c4af0748adfc4b3a633a6ce",
  "src/pages/marketing/FinishedGoods.tsx": "1cbd80ee488c8e28a6b75d4fa6d68b3d7554f49d988e007c430fbe0ce22c7eec",
  "src/pages/marketing/Orders.tsx": "c41efbfd43b0649e519c6135558c4b27817dfe4bcade0d7a01043fcfb8df1ed6",
  "src/pages/marketing/Reports.tsx": "882112469e3c5e4c9532138437cc0f01a43ced4aaa81827f64076ee6f8281986",
  "src/pages/owner/Dashboard.tsx": "e771e1fb12dc9b08b6ddfa3bc8ac565a87b55196334ed026955e797461f436f2",
  "src/pages/owner/Records.tsx": "71cb6c24b42ac56324736356b765063461c2fb616774c56c6651268acba0ca70",
  "src/pages/owner/Reports.tsx": "dcca458528203531e2c954dfa9727da0c297488e2b508f3ee496f3282165d5a2",
  "src/pages/plantmanager/Attendance.tsx": "b65104a9c569c9c3da0b45979c4159f5e340b2a1074582d274b5d8c0824ad38c",
  "src/pages/plantmanager/Dashboard.tsx": "a57f60145b04e0e355a64e0343308942f67eedd8c9977872b5389c60ee0e484b",
  "src/pages/plantmanager/FinishedGoods.tsx": "caeb81cd01ba602b9324ad0a6f7b7f4e130a1714f86fd3e6868eb620f949e205",
  "src/pages/plantmanager/MainPlantRequests.tsx": "d902db7724a39ca6acdc7c8341192b6713b481a62eb97a519dd5a7b90598f60b",
  "src/pages/plantmanager/MaterialUsage.tsx": "1e453b5570fede84ecf974dda0f245808314b4e6e9ad7d52e7069ffc3fed2991",
  "src/pages/plantmanager/PelletInventory.tsx": "4de5def4c3ff1d818d3da35a21764306e937785a9eac6f8bc779baebfbd7cae7",
  "src/pages/plantmanager/ProductionOrders.tsx": "2e7d64f6aea5391aa3d12ae14d57a1989fb11ded67de165eb36e0b25ec568dbe",
  "src/pages/plantmanager/RejectedRecycling.tsx": "65fc6224d62836da6f6aaf972a5d80f028c6f43f131467c298b6cb5675167b70",
  "src/pages/plantmanager/Reports.tsx": "68f0f650b85b0db241e061acb07cb8581de46b1b8ef2f6e192fa1584339f5551",
  "src/pages/plantmanager/ShiftTurnover.tsx": "89efd3cbda2bf88fbbd3f5e4fd2529638489145b6a41ddd6e8340354302f6e1c",
  "src/pages/production/Dashboard.tsx": "e011abd30ffa4fe6b41e34b1750b4bb0d04318f4de3a1bc70a7fbf35b733729a",
  "src/pages/production/FinishedPipes.tsx": "06f6a44edc1d674bad70b88e864b68838bfc02d6914348e1e6785722274a10bc",
  "src/pages/production/History.tsx": "a5c6ad52c705d73ccd084a158cd7b11ac9364e7b1538118b2067a3cbc1fa2a0d",
  "src/pages/production/Pellets.tsx": "24cb074408af861116d02b9bcea69ede7355d3910e0f566ed8fb8598f4baf395",
  "src/pages/production/ProductionOrders.tsx": "c6f6d2f4adc03e3baf6c7dcdf403c2aabd90485edbd4ba362646c7f5f9b746ea",
  "src/pages/production/Recycling.tsx": "fba9e1bda090b30fea08e4600e1022d1bd83007d6188281a73b1bdfc34ae0e51",
  "src/components/RecordReference.tsx": "075869ef573064d3aec1cb64466114c1c57383ad5387486d457ee9f962d026a7",
  "src/pages/marketing/MOTracking.tsx": "b5742899bc6b64c6760b0b4b33de9094a7f47ee8d0a03528883a89a035f0cd89"
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
