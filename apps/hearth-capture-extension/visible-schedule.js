(() => {
  function extractVisibleSchedule(documentValue = document, href = location.href, selfDisplayName = "") {
    const MAX_ROWS = 500;
    const text = (node, limit = 120) => String(node?.textContent || "").replace(/\s+/g, " ").trim().slice(0, limit);
    const normalizedName = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-CA").replace(/[^a-z0-9' -]/g, "").replace(/\s+/g, " ").trim();
    const providerEmployeeId = (row) => {
      const nodes = [row, row.querySelector(".employee-cell__title-name"), row.querySelector("[data-employee-id], [data-user-id], [data-staff-id]")].filter(Boolean);
      const values = new Set();
      for (const node of nodes) {
        for (const attribute of ["data-employee-id", "data-user-id", "data-staff-id"]) {
          const value = String(node.getAttribute?.(attribute) || "").trim();
          if (/^[A-Za-z0-9_-]{1,80}$/.test(value)) values.add(value);
        }
      }
      return values.size === 1 ? [...values][0] : null;
    };
    const expectedSelf = normalizedName(selfDisplayName);
    const dateAt = (weekStart, offset) => {
      const match = String(weekStart || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + offset));
      return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
    };
    const normalizedClock = (value) => {
      const match = String(value || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
      if (!match) return null;
      const hour = Number(match[1]);
      const minute = Number(match[2] || 0);
      if (hour < 1 || hour > 12 || minute > 59) return null;
      return `${hour}:${String(minute).padStart(2, "0")} ${match[3].toLowerCase()}`;
    };
    const shiftClocks = (value) => {
      const parts = String(value || "").replace(/[–—]/g, "-").split("-").map((part) => part.trim());
      return {
        start: normalizedClock(parts[0]),
        end: /^(?:cl|close|closing)$/i.test(parts[1] || "") ? null : normalizedClock(parts[1]),
      };
    };
    const target = new URL(href);
    if (target.origin !== "https://app.7shifts.com") throw new Error("Open an employee-visible 7shifts schedule first.");
    const pathMatch = target.pathname.match(/^\/location\/(\d{1,20})\/schedule\/(\d{4}-\d{2}-\d{2})(?:\/|$)/);
    if (!pathMatch) throw new Error("Open the published week schedule first.");

    const shifts = [];
    const rows = [...documentValue.querySelectorAll(".schedule-row")]
      .filter((row) => !row.classList.contains("schedule-row--header") && !row.classList.contains("schedule-row--events"));
    for (const row of rows) {
      const displayName = text(row.querySelector(".employee-cell__title-name"), 80);
      if (!displayName) continue;
      const employeeId = providerEmployeeId(row);
      const cells = [...row.querySelectorAll(":scope > .schedule-cell--with-padding")].slice(0, 7);
      cells.forEach((cell, dayIndex) => {
        const date = dateAt(pathMatch[2], dayIndex);
        if (!date) return;
        [...cell.querySelectorAll(".employee-shift")].slice(0, 20).forEach((shift) => {
          if (shifts.length >= MAX_ROWS) return;
          const clocks = shiftClocks(text(shift.querySelector(".employee-shift__time"), 40));
          shifts.push({
            employee: { display_name: displayName, provider_employee_id: employeeId },
            hearth_self: Boolean(expectedSelf && normalizedName(displayName) === expectedSelf),
            date,
            role: text(shift.querySelector(".employee-shift__role-name"), 80) || null,
            station: text(shift.querySelector(".employee-shift__station"), 80) || null,
            start_time: clocks.start,
            end_time: clocks.end,
            provider_location_id: pathMatch[1],
          });
        });
      });
    }
    if (!expectedSelf) throw new Error("Enter your exact 7shifts display name before registering autonomous capture.");
    const selfRows = rows.filter((row) => normalizedName(text(row.querySelector(".employee-cell__title-name"), 80)) === expectedSelf);
    const selfRowVisible = selfRows.length === 1;
    if (!selfRowVisible) {
      throw new Error("This schedule does not show the registered 7shifts employee. Sign into the paired account or register again.");
    }
    const selfEmployeeId = providerEmployeeId(selfRows[0]);
    if (!selfEmployeeId) throw new Error("This 7shifts page does not expose one stable employee identifier. Hearth stopped instead of binding timesheets by name.");
    if (!shifts.length) throw new Error("No visible published shifts were found in this week.");
    return {
      version: 1,
      captureClass: "published-schedule",
      transport: "fetch",
      path: target.pathname,
      capturedAt: new Date().toISOString(),
      contentType: "application/json",
      accountBinding: { normalizedSelf: expectedSelf, subjectKey: `employee:${selfEmployeeId}`, locationKey: `location:${pathMatch[1]}` },
      body: JSON.stringify({
        shifts,
        self_row_visible: true,
        complete_range: { from_date: pathMatch[2], to_date: dateAt(pathMatch[2], 6) },
      }),
    };
  }

  globalThis.HearthVisibleSchedule = Object.freeze({ extractVisibleSchedule });
})();
