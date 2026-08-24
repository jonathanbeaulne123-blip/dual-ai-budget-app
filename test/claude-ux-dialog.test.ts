// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useDialog } from "../src/useDialog.ts";

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
