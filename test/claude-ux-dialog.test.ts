// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useDialog, useModalActive } from "../src/useDialog.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Add is the money form. A keyboard or screen-reader household member must land
 * inside it, be unable to wander into the office behind it, and be put back
 * where they started when it closes. OFFICE A5 / docs/AI_HANDOFF.md.
 */
function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useDialog(open, onClose);
  return createElement(
    "div",
    { id: "app" },
    createElement("button", { id: "behind" }, "Home"),
    open
      ? createElement(
          "div",
          { ref, role: "dialog", "aria-modal": "true", id: "sheet" },
          createElement("button", { id: "close", "data-autofocus": true }, "Close"),
          createElement("button", { id: "post" }, "Post"),
        )
      : null,
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => { act(() => root.unmount()); container.remove(); });

function render(open: boolean, onClose = () => {}) {
  act(() => {
    root.render(createElement(Harness, { open, onClose }));
  });
}

describe("Add sheet modal behaviour", () => {
  it("moves focus into the sheet when it opens", () => {
    render(false);
    document.getElementById("behind")!.focus();
    render(true);
    expect(document.activeElement?.id).toBe("close");
  });

  it("takes the office behind it out of the accessibility tree", () => {
    render(true);
    expect(document.getElementById("behind")!.hasAttribute("inert")).toBe(true);
  });

  it("gives the background back when the sheet closes", () => {
    render(true);
    render(false);
    expect(document.getElementById("behind")!.hasAttribute("inert")).toBe(false);
  });

  it("returns focus to whatever opened it", () => {
    render(false);
    const opener = document.getElementById("behind")!;
    opener.focus();
    render(true);
    expect(document.activeElement?.id).toBe("close");
    render(false);
    expect(document.activeElement?.id).toBe("behind");
  });

  it("closes on Escape", () => {
    let closed = 0;
    render(true, () => { closed += 1; });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(closed).toBe(1);
  });

  it("keeps Tab inside the sheet", () => {
    render(true);
    document.getElementById("post")!.focus();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });
    expect(document.activeElement?.id).toBe("close");
  });
});


it("excludes the owned dialog while still detecting another modal", () => {
  function Observer({ own, other }: { own: boolean; other: boolean }) {
    const ownRef = useDialog(own);
    const otherRef = useDialog(other);
    const external = useModalActive(ownRef);
    const any = useModalActive();
    return createElement("div", null,
      own && createElement("div", { ref: ownRef, role: "dialog" }, "Owned"),
      other && createElement("div", { ref: otherRef, role: "dialog" }, "Other"),
      createElement("output", null, `${any}:${external}`));
  }
  const show = (own: boolean, other: boolean) => act(() => root.render(createElement(Observer, { own, other })));
  show(false, false); expect(container.querySelector("output")!.textContent).toBe("false:false");
  show(true, false); expect(container.querySelector("output")!.textContent).toBe("true:false");
  show(true, true); expect(container.querySelector("output")!.textContent).toBe("true:true");
  show(true, false); expect(container.querySelector("output")!.textContent).toBe("true:false");
  show(false, true); expect(container.querySelector("output")!.textContent).toBe("true:true");
  show(false, false); expect(container.querySelector("output")!.textContent).toBe("false:false");
});
