import {writeFile} from 'node:fs/promises';
import {FITTING_ITEMS,fittingColour} from '../../src/wardrobe/catalogue.ts';
import {pieceDrawing} from '../../src/wardrobe/glyphs.ts';
for(const item of FITTING_ITEMS)await writeFile(new URL(`../../public/hercules-wardrobe/${item.id}.svg`,import.meta.url),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="--piece:${fittingColour(item.variants[0],item.id)}"><g fill="var(--piece)" stroke="#514537" stroke-width="1.8" stroke-linejoin="round">${pieceDrawing(item.shape)}</g></svg>\n`);
