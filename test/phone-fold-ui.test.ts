// @vitest-environment jsdom
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect } from "vitest";
import { PhoneFold } from "../src/PhoneFold.tsx";
import { phoneFoldOrder } from "../src/core/officePhone.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
it("keeps focused seals reachable when urgency moves them below without changing head count", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host); let clicks = 0;
  const render = (ownShift: boolean) => createElement(PhoneFold, {
    items: phoneFoldOrder({ stories: ["blotter", "jars"], ownShift, overdue: false, health: false, needs: false }),
    render: (id) => createElement("button", { onClick: () => clicks++ }, id),
  });
  try {
    await act(async () => root.render(render(false)));
    host.querySelector<HTMLButtonElement>('[data-fold-id="seals"] button')!.focus();
    await act(async () => root.render(render(true)));
    expect(host.querySelector('.ph-fold-head')!.children.length).toBe(2);
    expect(document.activeElement?.textContent).toBe("seals");
    expect(document.activeElement?.closest('.ph-fold-below')).not.toBeNull();
    expect(host.querySelectorAll('[data-fold-id="seals"]')).toHaveLength(1);
    expect(clicks).toBe(0);
    await act(async () => (document.activeElement as HTMLButtonElement).click());
    expect(clicks).toBe(1);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
