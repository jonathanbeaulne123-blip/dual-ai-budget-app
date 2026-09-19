/** Portable one-page geometry sheet. ASCII text and a labeled schematic, not a scale drawing. */
export function writeExportPdf(lines: string[], dimensions: [number, number, number]): Uint8Array {
  const bytes = (s: string) => new TextEncoder().encode(s);
  const safe = (s: string) => s.replace(/[^\x20-\x7e]/g, '?').replace(/[()\\]/g, '\\$&');
  const text = lines.slice(0, 35).map((line, i) => `BT /F1 10 Tf 42 ${790 - i * 16} Td (${safe(line.slice(0, 90))}) Tj ET`).join('\n');
  const diagram = `0.5 w 70 75 105 125 re S 190 75 m 190 200 l S BT /F1 9 Tf 70 55 Td (Schematic, not to scale. X/Y/Z: ${dimensions.map(n => n.toFixed(2)).join(' x ')} mm) Tj ET`;
  const stream = text + '\n' + diagram;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${bytes(stream).length} >>\nstream\n${stream}\nendstream`];
  let file = '%PDF-1.4\n'; const offsets = [0];
  for (const [i, obj] of objects.entries()) { offsets.push(bytes(file).length); file += `${i + 1} 0 obj\n${obj}\nendobj\n`; }
  const xref = bytes(file).length; file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return bytes(file);
}
