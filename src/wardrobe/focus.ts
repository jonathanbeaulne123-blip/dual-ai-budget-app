/** A breakpoint can replace the opener while the modal stays mounted. */
export function wardrobeReturnFocus():HTMLElement|null {
 return [...document.querySelectorAll<HTMLElement>('.wardrobe-fitting-entrance button, .ph-desk-drawer, .office-wide-drawer summary, nav.nav button')].find(node=>!node.closest('[hidden], [inert]')&&(typeof node.checkVisibility!=='function'||node.checkVisibility()))??null;
}
