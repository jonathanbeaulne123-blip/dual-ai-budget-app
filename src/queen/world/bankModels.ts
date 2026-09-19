import type * as THREE from "three";
import type { UmbrellaId } from "../../core/fundRules.ts";
import { parseQueenModel, readQueenModel } from "./queenModel.ts";

/**
 * The Queen's household (2026-09-16): Jonathan's Mandevilla models for the
 * twelve fixed umbrellas, and the Work duo that stands as each partner's pay.
 *
 * - **Umbrella banks.** One porcelain cat per spending umbrella (Hearth for
 *   Home, Wick for Utilities, …). A bill in the cellar stands as its
 *   umbrella's bank. The umbrellas are fixed and can't be renamed, which is
 *   what lets one model per umbrella serve every category a household makes.
 * - **Pay banks.** Clink (the bartender) and Poise (the office) are the
 *   higher-resolution pair Jonathan supplied for the cellar's pay jars. Which
 *   one a partner gets follows how they're paid (`payBankFor`), never a name.
 *
 * Like the Queen, every file is shipped byte for byte (the SHA-256 is asserted
 * by test), with a `.gz` transfer copy next to it. Nothing here reads money,
 * and nothing re-shapes a model: the room clones the template and only chooses
 * which of the model's own surfaces stand glazed.
 */
export type BankModel = { name: string; role: string; url: string; sha256: string; bytes: number };

export type UmbrellaBankId = Exclude<UmbrellaId, "coming-in" | "moving-money">;
export const UMBRELLA_BANK_MODELS: Readonly<Record<UmbrellaBankId, BankModel>> = {
  home: { name: "Hearth", role: "Home", url: "/models/banks/home.v1.glb", sha256: "50b3e2a68aa5cdf010c4388eb551d16f4f0c1c0780c4a1d6068c03df8f56d968", bytes: 355596 },
  utilities: { name: "Wick", role: "Utilities", url: "/models/banks/utilities.v1.glb", sha256: "7c7e0378c3b692c21a3dea1a751f7dd8c3a0b95a465b73722707c6d6cedf5b2c", bytes: 391472 },
  food: { name: "Morsel", role: "Food", url: "/models/banks/food.v1.glb", sha256: "6dc69ab3922b6410701862ac657568c5ee8c740fd08baef877bef23086b8b1ed", bytes: 371036 },
  transport: { name: "Dash", role: "Transport", url: "/models/banks/transport.v1.glb", sha256: "13ca35264d71049583742d898a44cc82c1892b008bfd40eacf3ebcf3cde5a94e", bytes: 374592 },
  health: { name: "Balm", role: "Health", url: "/models/banks/health.v1.glb", sha256: "e02d83b3f9a6ac396a359f651ac9f869db4d6d98249c8d1fe6e101e651e83cc7", bytes: 389868 },
  personal: { name: "Lustre", role: "Personal", url: "/models/banks/personal.v1.glb", sha256: "ebb68064fd7c7622e14d70b7e2375109d48d181e1ae75d93e5401b68b9de7847", bytes: 391968 },
  fun: { name: "Frolic", role: "Fun", url: "/models/banks/fun.v1.glb", sha256: "3f9c6f29d082d3eda0056b8f397746c426ec7972308676b2a050c994f61c0f32", bytes: 392860 },
  travel: { name: "Roam", role: "Travel", url: "/models/banks/travel.v1.glb", sha256: "9c3756dc58de728c7c076e3e980063b8d2f6304881b07e9bab8e64d93a63385c", bytes: 398480 },
  "pets-family": { name: "Nuzzle", role: "Pets & family", url: "/models/banks/pets-family.v1.glb", sha256: "5d5b92e6baa22f4a2e32a58bc6ed6cfa3bca38d65f4a292cd794ba4d1f29fede", bytes: 369544 },
  "gifts-giving": { name: "Bounty", role: "Gifts & giving", url: "/models/banks/gifts-giving.v1.glb", sha256: "24d65b3e4bb4cdd368cc2ad9a006e88bf6def640627920774749d0ce1ef44dd0", bytes: 394396 },
  "work-learning": { name: "Quill", role: "Work & learning", url: "/models/banks/work-learning.v1.glb", sha256: "f23fe2dd967a7b4e2746219616906270196eaa5c5b1e7f7e1fa36d585a8efdaa", bytes: 391824 },
  money: { name: "Mint", role: "Money", url: "/models/banks/money.v1.glb", sha256: "dd162b25161457de1142d2f0f13c8228a752ac535b42e7f221b27f69821907d5", bytes: 398268 },
};

export type PayBankId = "clink" | "poise";
export const PAY_BANK_MODELS: Readonly<Record<PayBankId, BankModel>> = {
  clink: { name: "Clink", role: "Pay from shifts and tips", url: "/models/banks/pay-clink.v2.glb", sha256: "b63be802cc1fedc82e3aa7bb40b30d6f7ad458e1270119fc169d6a4a56eb4890", bytes: 1406916 },
  poise: { name: "Poise", role: "Pay from a salary", url: "/models/banks/pay-poise.v2.glb", sha256: "e685ba8cf266a8057603e08271a1e5c17272af3f9c224377b3fde5e8fba20300", bytes: 1489456 },
};

/** Every model the room can stand, by one key: `umbrella:<id>` or `pay:<id>`. */
export type BankModelKey = `umbrella:${UmbrellaBankId}` | `pay:${PayBankId}`;
export function bankModelFor(key: BankModelKey): BankModel | null {
  const [kind, id] = key.split(":") as ["umbrella" | "pay", string];
  if (kind === "umbrella") return UMBRELLA_BANK_MODELS[id as UmbrellaBankId] ?? null;
  if (kind === "pay") return PAY_BANK_MODELS[id as PayBankId] ?? null;
  return null;
}
export const umbrellaBankKey = (id: UmbrellaId | null | undefined): BankModelKey | null =>
  id && id in UMBRELLA_BANK_MODELS ? `umbrella:${id as UmbrellaBankId}` : null;

/**
 * Which Work model stands for a partner's pay: Clink when they're paid by
 * shifts and tips, Poise when it's a salary. The signal is household-visible
 * on purpose, so both phones show the same model: a Work pay schedule
 * (`earningCadence`, timing only) or any shift the partner shared.
 */
export const payBankFor = (style: "shifts" | "salary"): PayBankId => (style === "shifts" ? "clink" : "poise");

export async function loadBankModel(key: BankModelKey, signal?: AbortSignal): Promise<THREE.Group> {
  const model = bankModelFor(key);
  if (!model) throw new Error(`No bank model for ${key}`);
  return parseQueenModel(await readQueenModel(signal, model.url));
}
