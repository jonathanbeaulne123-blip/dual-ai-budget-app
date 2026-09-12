import type { KittyPieceV1 } from '../core/types.ts';
import type { NativeIdentity } from './native.ts';

/** The caller resolves this exact revision through authenticated design authority. */
export type DesignSurfaceSelection = { identity: NativeIdentity; piece: KittyPieceV1 };
export type DesignSurfaceTheme = 'classic' | 'taylor' | 'newfoundland';
export const designSurfaceKey = (selection: DesignSurfaceSelection) => JSON.stringify(selection.identity);
export const designDownloadName = (selection: DesignSurfaceSelection, extension: string) => `Hearthside-${selection.identity.pieceId.replace(/[^A-Za-z0-9_-]/g, '-')}-r${selection.identity.revision}.${extension}`;

export const DESIGN_SURFACE_MATERIALS = {
  classic: { eyebrow: 'From the pottery shelf', exportTitle: 'Something to hold', nativeTitle: 'A little closer', footer: 'A place on the table for something you made together.' },
  taylor: { eyebrow: 'A page in our scrapbook', exportTitle: 'Keep this little piece of us', nativeTitle: 'Bring our little world along', footer: 'Your colours, your crooked lines, your shared little story.' },
  newfoundland: { eyebrow: 'From our coastal workshop', exportTitle: 'A keepsake for home', nativeTitle: 'Make room for your little cat', footer: 'Made together, with a little of home in every mark.' },
} as const;
