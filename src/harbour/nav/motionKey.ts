/**
 * The motion edition's storage key and type ONLY — no reader, no writer. Presentation modules that just listen for
 * the edition changing (`window` event named `MOTION_KEY`), such as the Journey map, import this module rather than
 * `motionEdition.ts`, whose `chooseMotionEdition` writes browser storage (Journey trust minor 8).
 */
export const MOTION_KEY = 'hearth:motion';
export type MotionEdition = 'illustrated' | 'flat';
