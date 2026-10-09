import React, { useMemo, useRef, useState } from 'react';

const CODE_128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212',
  '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321',
  '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212',
  '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

interface BarcodeLabelProps {
  value: string;
  recordId?: string;
  recordLabel?: string;
  onPrint?: () => void;
}

type BatchBarcodeLabel = {
  value: string;
  recordId: string;
  recordLabel: string;
};

function getCode128Bars(value: string) {
  const values = Array.from(value).map(char => {
    const code = char.charCodeAt(0);
    if (code < 32 || code > 126) throw new Error('Code 128 prototype supports printable ASCII values only.');
    return code - 32;
  });
  const checksum = (104 + values.reduce((sum, code, index) => sum + code * (index + 1), 0)) % 103;
  const encoded = [104, ...values, checksum, 106];
  const quietZone = 10;
  const bars: Array<{ x: number; width: number }> = [];
  let x = quietZone;

  encoded.forEach(code => {
    Array.from(CODE_128_PATTERNS[code]).forEach((moduleWidth, index) => {
      const width = Number(moduleWidth);
      if (index % 2 === 0) bars.push({ x, width });
      x += width;
    });
  });

  return { bars, width: x + quietZone };
}

function barcodeSvgMarkup(value: string) {
  const barcode = getCode128Bars(value);
  const bars = barcode.bars.map(bar =>
    `<rect x="${bar.x}" y="4" width="${bar.width}" height="64" fill="#000000"/>`
  ).join('');
  return `<svg viewBox="0 0 ${barcode.width} 72" role="img" aria-label="Code 128 barcode for ${escapeHtml(value)}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges"><rect width="${barcode.width}" height="72" fill="#ffffff"/>${bars}</svg>`;
}

function barcodeValidationError(value: string) {
  if (!value || !value.trim()) return 'barcode value is empty';
  if (value !== value.trim()) return 'barcode value has leading or trailing whitespace';
  try {
    getCode128Bars(value);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : 'Code 128 could not be generated';
  }
}

export function printBarcodeBatch(labels: BatchBarcodeLabel[]) {
  if (!labels.length) return [];
  const seen = new Set<string>();
  const errors: string[] = [];
  const printable = labels.flatMap(record => {
    const validationError = barcodeValidationError(record.value);
    if (validationError) {
      errors.push(`${record.recordLabel} (${record.recordId}): ${validationError}`);
      return [];
    }
    if (seen.has(record.value)) {
      errors.push(`${record.recordLabel} (${record.recordId}): duplicate barcode value ${record.value}`);
      return [];
    }
    seen.add(record.value);
    return [{ record, barcodeMarkup: barcodeSvgMarkup(record.value) }];
  }).sort((a, b) => a.record.value.localeCompare(b.record.value, undefined, { numeric: true }));
  if (errors.length) {
    window.alert(`BARCODE LABEL ERROR\n\n${errors.join('\n')}`);
  }
  if (!printable.length) return [];
  const printWindow = window.open('', '_blank', 'width=860,height=720');
  if (!printWindow) return [];
  const labelMarkup = printable.map(({ record, barcodeMarkup }) => {
    const barcodeValue = record.value;
    return `<section class="label" aria-label="Barcode label ${escapeHtml(barcodeValue)}"><div class="barcode">${barcodeMarkup}</div><div class="value">${escapeHtml(barcodeValue)}</div></section>`;
  }).join('');
  printWindow.document.write(`<!doctype html><html><head><title>HPAI Barcode Labels</title><style>
    *{box-sizing:border-box}@page{margin:10mm}body{font-family:Arial,sans-serif;margin:0;padding:10mm;color:#000;background:#fff}
    .sheet{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6mm}
    .label{background:#fff;break-inside:avoid;display:flex;flex-direction:column;justify-content:center;min-height:38mm;padding:4mm}
    .barcode{background:#fff;width:100%}.barcode svg{display:block;height:20mm;width:100%}
    .value{color:#000;font-family:"Courier New",monospace;font-size:11pt;font-weight:700;line-height:1.2;margin-top:2.5mm;text-align:center;white-space:nowrap}
    @media screen{.label{outline:1px solid #ddd}}@media print{body{padding:0}}
  </style></head><body><main class="sheet">${labelMarkup}</main><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script></body></html>`);
  printWindow.document.close();
  return printable.map(({ record }) => record.recordId);
}

function BarcodeSvg({ value }: { value: string }) {
  const barcode = useMemo(() => getCode128Bars(value), [value]);
  return (
    <svg
      className="barcode-svg"
      viewBox={`0 0 ${barcode.width} 72`}
      role="img"
      aria-label={`Code 128 barcode for ${value}`}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
    >
      <rect width={barcode.width} height="72" fill="#ffffff" />
      {barcode.bars.map((bar, index) => (
        <rect key={`${bar.x}-${index}`} x={bar.x} y="4" width={bar.width} height="64" fill="#000000" />
      ))}
    </svg>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character] as string));
}

export default function BarcodeLabel({ value, recordId, recordLabel, onPrint }: BarcodeLabelProps) {
  const [copied, setCopied] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);
  const validationError = barcodeValidationError(value);

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement('textarea');
      input.value = value;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const printBarcode = () => {
    if (validationError) {
      window.alert(`BARCODE LABEL ERROR\n\n${recordLabel || 'Unknown system record'} (${recordId || 'unknown ID'}): ${validationError}`);
      return;
    }
    const barcodeSvg = labelRef.current?.querySelector<SVGElement>('.barcode-svg');
    if (!barcodeSvg) return;
    const printWindow = window.open('', '_blank', 'width=720,height=560');
    if (!printWindow) return;
    onPrint?.();
    printWindow.document.write(`<!doctype html><html><head><title>Barcode ${escapeHtml(value)}</title><style>
      *{box-sizing:border-box}@page{margin:10mm}body{font-family:Arial,sans-serif;margin:0;padding:10mm;color:#000;background:#fff}
      .label{background:#fff;display:flex;flex-direction:column;justify-content:center;margin:auto;max-width:90mm;min-height:38mm;padding:4mm}
      .barcode{background:#fff;width:100%}.barcode svg{display:block;height:20mm;width:100%}
      .value{color:#000;font-family:"Courier New",monospace;font-size:11pt;font-weight:700;line-height:1.2;margin-top:2.5mm;text-align:center;white-space:nowrap}
      @media screen{.label{outline:1px solid #ddd}}@media print{body{padding:0}}
    </style></head><body><div class="label"><div class="barcode">${barcodeSvg.outerHTML}</div>
      <div class="value">${escapeHtml(value)}</div></div>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script></body></html>`);
    printWindow.document.close();
  };

  if (validationError) {
    return <div className="alert-error"><strong>BARCODE LABEL ERROR</strong><div>{recordLabel || 'Unknown system record'} ({recordId || 'unknown ID'}): {validationError}</div></div>;
  }

  return (
    <section className="barcode-label app-card" data-barcode={value}>
      <div className="section-title">Physical Sticker Preview · Code 128</div>
      <div ref={labelRef} className="barcode-sticker-preview">
        <div className="barcode-visual"><BarcodeSvg value={value} /></div>
        <div className="barcode-value font-mono">{value}</div>
      </div>
      <div className="helper-text barcode-print-note">The physical sticker prints only the Code 128 barcode and this exact manual-entry value.</div>
      <div className="barcode-actions button-group">
        <button className="btn-secondary" onClick={printBarcode}>Print Barcode</button>
        <button className="btn-warning" onClick={printBarcode}>Reprint Barcode</button>
        <button className="btn-secondary" onClick={copyValue}>{copied ? 'Copied' : 'Copy Barcode Value'}</button>
      </div>
    </section>
  );
}
