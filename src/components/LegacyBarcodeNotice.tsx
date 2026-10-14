import React from 'react';
import type { FinishedGood } from '../types';
import { findFinishedPipeBarcode } from '../finishedPipeBarcodes';
export default function LegacyBarcodeNotice({ query, pipes }: { query: string; pipes: readonly FinishedGood[] }) { const result = findFinishedPipeBarcode(query, pipes); return result?.legacy && result.pipe ? <div className="alert-warning" role="status">{result.message} · Pipe Record ID: {result.pipe.fgId}. The old label is obsolete and cannot perform an inventory action.</div> : null; }
