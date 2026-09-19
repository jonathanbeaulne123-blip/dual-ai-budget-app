import { Color } from 'three';
import { zipSync } from 'fflate';
import type { ExportMaterial, ExportMesh } from './exportTypes.ts';
const bytes = (s: string) => new TextEncoder().encode(s);
const xml = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '\ufffd').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
// ZIP stores local civil time; construct that civil date rather than a UTC instant.
export const zipExportFiles = (files: Map<string, Uint8Array>) => zipSync(Object.fromEntries(files), { level: 6, mtime: new Date(1980, 0, 1, 0, 0, 0) });

/** OPC package, 3MF Core + Materials texture resources. Units are explicit millimeters. */
export function writeThreeMf(meshes: ExportMesh[], materials: ExportMaterial[], name: string, manufacturingModel: boolean): Uint8Array {
  const files = new Map<string, Uint8Array>();
  let resources = `<basematerials id="1">${materials.map(m => `<base name="${xml(m.name)}" displaycolor="#${new Color(...m.color.slice(0, 3) as [number, number, number]).getHexString()}${Math.round(m.color[3] * 255).toString(16).padStart(2, '0')}"/>`).join('')}</basematerials>`;
  const vertices: string[] = [], triangles: string[] = [], relationships: string[] = [], vertexIds = new Map<string, number>();
  let resourceId = 2;
  for (const mesh of meshes) {
    const material = materials[mesh.material]!;
    let textureGroup = 0;
    if (material.png) {
      const textureId = resourceId++, groupId = resourceId++; textureGroup = groupId;
      const path = `/3D/Textures/material-${mesh.material}.png`; files.set(path.slice(1), material.png);
      resources += `<m:texture2d id="${textureId}" path="${path}" contenttype="image/png" tilestyleu="wrap" tilestylev="wrap"/><m:texture2dgroup id="${groupId}" texid="${textureId}">${Array.from({ length: mesh.positions.length / 3 }, (_, i) => `<m:tex2coord u="${mesh.uv[i * 2] ?? 0}" v="${mesh.uv[i * 2 + 1] ?? 0}"/>`).join('')}</m:texture2dgroup>`;
      relationships.push(`<Relationship Target="${path}" Id="tex${textureId}" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dtexture"/>`);
    }
    const mapping: number[] = [];
    for (let i = 0; i < mesh.positions.length / 3; i++) {
      const x = mesh.positions[i * 3]!, y = -mesh.positions[i * 3 + 2]!, z = mesh.positions[i * 3 + 1]!;
      const key = [x, y, z].map(v => Math.round(v / 1e-5)).join(',');
      let id = manufacturingModel ? vertexIds.get(key) : undefined;
      if (id === undefined) { id = vertices.length; vertexIds.set(key, id); vertices.push(`<vertex x="${x}" y="${y}" z="${z}"/>`); }
      mapping.push(id);
    }
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = mesh.indices.slice(i, i + 3) as [number, number, number];
      triangles.push(`<triangle v1="${mapping[a]}" v2="${mapping[b]}" v3="${mapping[c]}" pid="${textureGroup || 1}" p1="${textureGroup ? a : mesh.material}" p2="${textureGroup ? b : mesh.material}" p3="${textureGroup ? c : mesh.material}"/>`);
    }
  }
  const objectId = resourceId++;
  resources += `<object id="${objectId}" type="${manufacturingModel ? 'model' : 'other'}" name="${xml(name)}"><mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh></object>`;
  const textures = materials.some(m => m.png);
  files.set('3D/3dmodel.model', bytes(`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"${textures ? ' requiredextensions="m"' : ''}><metadata name="Title">${xml(name)}</metadata><metadata name="Description">${manufacturingModel ? 'Reviewed geometry derivative. Maker tolerances unverified.' : 'Source-exact reference geometry, not a manifold manufacturing assertion.'}</metadata><resources>${resources}</resources><build><item objectid="${objectId}"/></build></model>`));
  files.set('[Content_Types].xml', bytes('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="png" ContentType="image/png"/></Types>'));
  files.set('_rels/.rels', bytes('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'));
  if (relationships.length) files.set('3D/_rels/3dmodel.model.rels', bytes(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join('')}</Relationships>`));
  return zipExportFiles(files);
}
