import type { Visibility } from "../core/types.ts";

export type DeskMode = "expense" | "income" | "shift" | "transfer";

export type DeskForm = {
  date: string;
  amount: string;
  accountId: string;
  subcategoryId: string;
  note: string;
  place: string;
  who: string;
  fromAccountId: string;
  toAccountId: string;
  memberId: string;
  sales: string;
  cashTips: string;
  ccTips: string;
  hours: string;
  visibility: Visibility;
  occurredAt: string;
};
