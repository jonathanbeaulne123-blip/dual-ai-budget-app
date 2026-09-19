import {NestProp} from '../kitty/NestProp.tsx';
import { useEffect, useId, useRef, useState } from 'react';
import { KittyFlat } from '../kitty/studio/flat.tsx';
import { DesignExportJob, type ExportJobDependencies, type ExportJobState, type ExportOptions } from './DesignExportJob.ts';
import { DESIGN_SURFACE_MATERIALS, designDownloadName, designSurfaceKey, type DesignSurfaceSelection, type DesignSurfaceTheme } from './designSurfaceContracts.ts';
import type { GeometryReport } from './exportTypes.ts';
import './designSurfaces.css';

export type DesignExportSurfaceProps = { enabled: boolean; selection: DesignSurfaceSelection; theme: DesignSurfaceTheme; onClose: () => void; dependencies?: Partial<ExportJobDependencies> };
export function GeometrySummary({ report }: { report: GeometryReport }) {
  return <div className="design-report"><dl>
    <div><dt>Measured width × height × depth</dt><dd>{report.dimensionsMm.map(n => n.toFixed(1)).join(' × ')} mm</dd></div>
    <div><dt>Closed geometry</dt><dd>{report.watertight ? 'Closed edges verified' : 'Open or non-manifold edges remain'}</dd></div>
    <div><dt>Separate parts</dt><dd>{report.connectedComponents}</dd></div>
    <div><dt>Self-intersections</dt><dd>{report.selfIntersections.status === 'clear' ? 'None found in the tested pairs' : report.selfIntersections.status === 'found' ? 'Intersections found' : 'Not fully checked'}</dd></div>
    <div><dt>Wall thickness</dt><dd>{report.wallThickness.status === 'sampled' ? `Sampled minimum ${report.wallThickness.minimumSampleMm?.toFixed(2) ?? 'unavailable'} mm; not a global minimum` : report.wallThickness.status === 'not-applicable' ? 'Solid construction' : 'Unverified'}</dd></div>
    <div><dt>Maker tolerances, fit and strength</dt><dd>Unverified</dd></div>
  </dl>{report.warnings.length > 0 && <ul>{report.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}</div>;
}
export function DesignExportSurface(props: DesignExportSurfaceProps) {
  return <ExportSurface key={designSurfaceKey(props.selection)} {...props}/>;
}
function ExportSurface({ enabled, selection, theme, onClose, dependencies }: DesignExportSurfaceProps) {
  const [state, setState] = useState<ExportJobState>({ phase: 'idle' }), [height, setHeight] = useState('160'), [construction, setConstruction] = useState<'solid' | 'hollow'>('solid');
  const [wall, setWall] = useState('3'), [slotWidth, setSlotWidth] = useState('28'), [slotDepth, setSlotDepth] = useState('4'), [baseOpening, setBaseOpening] = useState('32');
  const [manufacturingProfile, setManufacturingProfile] = useState('');
  const [repair, setRepair] = useState(false), [repairApproval, setRepairApproval] = useState<string | null>(null), [limitations, setLimitations] = useState(false), [localError, setLocalError] = useState('');
  const job = useRef<DesignExportJob | null>(null), title = useRef<HTMLHeadingElement>(null), heading = useId(), materials = DESIGN_SURFACE_MATERIALS[theme];
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const current = new DesignExportJob(selection, setState, dependencies); job.current = current; title.current?.focus();
    return () => { current.dispose(); if (job.current === current) job.current = null; if (opener?.isConnected) opener.focus(); };
  }, []);
  useEffect(() => { if (!enabled) job.current?.cancel(); }, [enabled]);
  const reset = () => { job.current?.cancel(); setRepairApproval(null); setLimitations(false); setLocalError(''); };
  const changed = (set: (value: string) => void, value: string) => { reset(); set(value); };
  const busy = ['capturing', 'preparing', 'finishing', 'packing'].includes(state.phase);
  const prepare = () => {
    reset(); const options: ExportOptions = { heightMm: Number(height), construction, ...(manufacturingProfile ? { manufacturingProfile } : {}), ...(construction === 'hollow' ? { hollow: { wallMm: Number(wall), coinSlotWidthMm: Number(slotWidth), coinSlotDepthMm: Number(slotDepth), baseOpeningDiameterMm: Number(baseOpening) } } : {}) };
    setRepair(construction === 'hollow'); void job.current?.prepare(options);
  };
  const review = state.phase === 'review' ? state.review : null;
  const close = () => { job.current?.cancel(); onClose(); };
  return <section className="design-surface design-export" data-design-theme={theme} aria-labelledby={heading} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    <header className="design-surface-heading"><div><p className="design-eyebrow">{materials.eyebrow}</p><h2 id={heading} ref={title} tabIndex={-1}>{materials.exportTitle}</h2><p>A production package of the design you chose, at a size you choose.</p></div><button type="button" onClick={close}>Back to Studio</button></header>
    <div className="design-surface-spread"><figure className="design-source-preview"><div className="design-preview-paper"><KittyFlat piece={selection.piece} step={0} title="The selected authored design"/>{selection.appearance&&<NestProp ornament={selection.appearance}/>}<span className="design-measure" aria-hidden="true">{height || '—'} mm</span></div><figcaption>Selected design · revision {selection.identity.revision}<br/>Your original shape and paint stay kept.</figcaption><p className="design-surface-note">{materials.footer}</p></figure>
      <div className="design-surface-work">
        {!enabled ? <p role="status">Production files are not enabled for this household yet.</p> : <>
          <fieldset className="design-dimensions" disabled={busy}><legend>Choose the physical piece</legend>
            <label>Height, in millimetres<input type="number" min="30" max="1000" step="1" inputMode="decimal" value={height} onChange={event => changed(setHeight, event.target.value)}/></label>
            <label>Construction<select aria-label="Construction" value={construction} onChange={event => { reset(); setConstruction(event.target.value as 'solid' | 'hollow'); }}><option value="solid">Solid sculpture</option><option value="hollow">Hollow bank with openings</option></select></label>
            <label>Manufacturing profile, optional<input maxLength={300} value={manufacturingProfile} onChange={event => changed(setManufacturingProfile, event.target.value)} aria-describedby={`${heading}-profile-help`}/></label><p id={`${heading}-profile-help`} className="design-help">Reference notes travel with this exact review and package. The portable PDF supports 1–300 printable ASCII characters so it can preserve the supplied text exactly. They do not change the geometry or verify printer settings.</p>
            {construction === 'hollow' && <div className="design-small-fields">
              <label>Wall, mm<input type="number" min="0.5" max="20" step="0.5" value={wall} onChange={event => changed(setWall, event.target.value)}/></label>
              <label>Coin slot width, mm<input type="number" min="1" step="1" value={slotWidth} onChange={event => changed(setSlotWidth, event.target.value)}/></label>
              <label>Coin slot depth, mm<input type="number" min="1" step="0.5" value={slotDepth} onChange={event => changed(setSlotDepth, event.target.value)}/></label>
              <label>Base opening diameter, mm<input type="number" min="1" step="1" value={baseOpening} onChange={event => changed(setBaseOpening, event.target.value)}/></label>
            </div>}
            <p className="design-help">Dimensions come from this sculpture. Contributions and room animations do not change these files.</p>
            <button type="button" onClick={prepare}>Check this piece</button>
          </fieldset>
          {busy && <div className="design-progress" role="status"><p>{state.phase === 'capturing' ? 'Preparing the selected shape and paint…' : state.phase === 'preparing' ? 'Checking geometry and preparing a review…' : state.phase === 'finishing' ? 'Creating the reviewed production files…' : 'Packing and verifying your download…'}</p><button type="button" onClick={reset}>Cancel preparation</button></div>}
          {state.phase === 'error' && <p className="design-error" role="alert">{state.message}</p>}
          {review && <section className="design-review" aria-label="Review production files"><h3>Before it leaves the Studio</h3><GeometrySummary report={review.report}/>
            {review.selection.manufacturingProfile !== undefined && <p><strong>Manufacturing profile:</strong> {review.selection.manufacturingProfile}<br/><small>Reference only; maker tolerances, fit, strength, shrinkage and printer settings remain unverified.</small></p>}
            {construction === 'solid' && <fieldset><legend>Choose the copy to download</legend><label className="design-choice"><input type="radio" name={`${heading}-repair`} checked={!repair} onChange={() => { setRepair(false); setRepairApproval(null); }}/>Original authored geometry, for reference</label><label className="design-choice"><input type="radio" name={`${heading}-repair`} checked={repair} onChange={() => { setRepair(true); setRepairApproval(null); }}/>Prepare a manufacturing derivative</label></fieldset>}
            {repair && <div className="design-repair"><h4>Proposed changes to the production copy</h4><ol>{review.proposal.actions.map(action => <li key={action}>{action}</li>)}</ol>
              <p><strong>Decorations omitted:</strong> {review.proposal.omittedMeshes.length ? review.proposal.omittedMeshes.join(', ') : 'None'}</p><p><strong>Open ends capped:</strong> {review.proposal.cappedMeshes.length ? review.proposal.cappedMeshes.join(', ') : 'None'}</p>
              {review.proposal.blockers.length > 0 ? <div role="alert"><p>This repair cannot be verified:</p><ul>{review.proposal.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul><p>{construction === 'solid' ? 'You can still choose the original reference geometry.' : 'Try different dimensions or a solid source copy.'}</p></div> : <label className="design-choice"><input type="checkbox" checked={repairApproval === review.proposal.digest} onChange={event => setRepairApproval(event.target.checked ? review.proposal.digest : null)}/>I approve these exact changes to the production copy.</label>}
            </div>}
            <p>Files include STL, textured 3MF and GLB, paint references, the source design, a geometry report and a PDF sheet. STL carries no colour; import its dimensions as millimetres.</p>
            <label className="design-choice"><input type="checkbox" checked={limitations} onChange={event => setLimitations(event.target.checked)}/>I have reviewed the checks and understand that maker tolerances, fit, strength and material shrinkage remain unverified.</label>
            <button type="button" disabled={!limitations || repair && (repairApproval !== review.proposal.digest || review.proposal.blockers.length > 0)} onClick={() => { try { job.current?.finish({ limitationsReviewed: limitations, ...(repair && repairApproval ? { approvedRepairDigest: repairApproval } : {}) }); } catch { setLocalError('This review changed. Check the current piece again.'); } }}>Create production package</button>
          </section>}
          {localError && <p role="alert">{localError}</p>}
          {state.phase === 'ready' && <section className="design-download" aria-label="Production package ready"><h3>Your files are ready</h3><p>{state.manifest.repair ? 'The package includes the reviewed production copy and the original authored GLB.' : 'This package preserves the original authored geometry.'}</p><GeometrySummary report={state.manifest.report}/><a className="design-primary" href={state.url} download={designDownloadName(selection, 'zip')}>Download production package · {(state.bytes / 1024 / 1024).toFixed(1)} MB</a><details><summary>Included files and checksums</summary><ul>{state.manifest.files.map(file => <li key={file.name}><strong>{file.name}</strong><code>{file.sha256}</code></li>)}</ul></details><p>No order or purchase is part of this download.</p></section>}
        </>}
      </div>
    </div>
  </section>;
}
