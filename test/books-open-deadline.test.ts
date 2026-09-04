import { describe, expect, it, vi } from "vitest";
import {
  BrowserBooksOpenTimeoutError,
  withBrowserBooksOpenDeadline,
} from "../src/ledger/booksOpenDeadline.ts";

describe("browser books open deadline", () => {
  it("returns an opening that settles before the deadline", async () => {
    await expect(withBrowserBooksOpenDeadline(Promise.resolve("ready"), { timeoutMs: 50 })).resolves.toBe("ready");
  });

  it("retires a stalled opening once without clearing storage", async () => {
    vi.useFakeTimers();
    const retire = vi.fn();
    const stalled = new Promise<never>(() => undefined);
    const result = withBrowserBooksOpenDeadline(stalled, { timeoutMs: 12_000, onTimeout: retire });
    const rejection = expect(result).rejects.toEqual(expect.objectContaining({
      name: "BrowserBooksOpenTimeoutError",
      code: "BROWSER_BOOKS_OPEN_TIMEOUT",
    } satisfies Partial<BrowserBooksOpenTimeoutError>));

    await vi.advanceTimersByTimeAsync(12_000);

    await rejection;
    expect(retire).toHaveBeenCalledTimes(1);
    expect(retire.mock.calls[0]).toEqual([]);
    vi.useRealTimers();
  });

  it("does not fire retirement after a successful opening", async () => {
    vi.useFakeTimers();
    const retire = vi.fn();
    await expect(withBrowserBooksOpenDeadline(Promise.resolve("ready"), {
      timeoutMs: 12_000,
      onTimeout: retire,
    })).resolves.toBe("ready");

    await vi.advanceTimersByTimeAsync(12_000);
    expect(retire).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("still rejects when worker retirement itself throws", async () => {
    vi.useFakeTimers();
    const result = withBrowserBooksOpenDeadline(new Promise<never>(() => undefined), {
      timeoutMs: 1,
      onTimeout: () => { throw new Error("worker already gone"); },
    });
    const rejection = expect(result).rejects.toBeInstanceOf(BrowserBooksOpenTimeoutError);
    await vi.advanceTimersByTimeAsync(1);
    await rejection;
    vi.useRealTimers();
  });
});
