(() => {
  function extractVisibleTimesheet(documentValue = document, href = location.href, expectedAccountBinding = null) {
    const MAX_ROWS = 100;
    const text = (node, limit = 120) => String(node?.textContent || "").replace(/\s+/g, " ").trim().slice(0, limit);
    const headerKey = (value) => String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const isoDate = (value) => {
      const match = String(value || "").trim().match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/i);
      if (!match) return null;
      const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
      const month = months.indexOf(match[1].toLowerCase()) + 1;
      const day = Number(match[2]);
      const year = Number(match[3]);
      if (!month || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    };
    const clock = (value) => {
      const match = String(value || "").trim().match(/^(\d{1,2})(?::(\d{2}))\s*(am|pm)$/i);
      if (!match) return null;
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (hour < 1 || hour > 12 || minute > 59) return null;
      return `${hour}:${String(minute).padStart(2, "0")} ${match[3].toLowerCase()}`;
    };
    const decimalHours = (value) => {
      const match = String(value || "").trim().match(/^\d{1,2}(?:\.\d{1,2})?$/);
      if (!match) return null;
      const parsed = Number(match[0]);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 36 ? parsed : null;
    };
    const target = new URL(href);
    if (target.origin !== "https://app.7shifts.com" || !/^\/my[_-]?timesheets?\/?$/i.test(target.pathname)) {
      throw new Error("Open My Timesheets in 7shifts first.");
    }
    if (!expectedAccountBinding || !/^employee:[A-Za-z0-9_-]{1,80}$/.test(String(expectedAccountBinding.subjectKey || ""))) {
      throw new Error("Capture the registered employee schedule first so Hearth can bind this timesheet to a stable 7shifts employee.");
    }
    const identityNodes = [documentValue.documentElement, documentValue.body,
      ...documentValue.querySelectorAll("[data-current-employee-id], [data-current-user-id], .profile-menu[data-employee-id], .user-menu[data-user-id]")].filter(Boolean);
    const visibleIds = new Set();
    for (const node of identityNodes) {
      for (const attribute of ["data-current-employee-id", "data-current-user-id", "data-employee-id", "data-user-id"]) {
        const value = String(node.getAttribute?.(attribute) || "").trim();
        if (/^[A-Za-z0-9_-]{1,80}$/.test(value)) visibleIds.add(value);
      }
    }
    const expectedEmployeeId = String(expectedAccountBinding.subjectKey).slice(9);
    if (visibleIds.size !== 1 || !visibleIds.has(expectedEmployeeId)) {
      throw new Error("The visible 7shifts employee identifier does not match the registered schedule account.");
    }

    const table = [...documentValue.querySelectorAll("table")].find((candidate) => {
      const headers = [...candidate.querySelectorAll("th")].map((cell) => headerKey(text(cell)));
      return headers.includes("date") && headers.includes("punchin") && headers.includes("punchout") && headers.includes("hours");
    });
    if (!table) throw new Error("No visible 7shifts timesheet table was found.");
    const headers = [...table.querySelectorAll("thead th")].map((cell) => headerKey(text(cell)));
    const index = (name) => headers.indexOf(headerKey(name));
    const rows = [];
    for (const row of [...table.querySelectorAll("tbody tr")].slice(0, MAX_ROWS)) {
      const cells = [...row.querySelectorAll(":scope > th, :scope > td")];
      const cell = (name, limit = 120) => {
        const position = index(name);
        return position < 0 ? "" : text(cells[position], limit);
      };
      const date = isoDate(cell("Date", 40));
      const clockedIn = clock(cell("Punch In", 30));
      const clockedOut = clock(cell("Punch Out", 30));
      if (!date || !clockedIn) continue;
      const managerApproval = cell("Manager Approval", 40);
      const employeeApproval = cell("Employee Approval", 40);
      const approvalStatus = /approved/i.test(`${managerApproval} ${employeeApproval}`)
        ? "Approved"
        : [managerApproval, employeeApproval].filter(Boolean).join(" / ").slice(0, 80) || null;
      rows.push({
        provider_employee_id: expectedEmployeeId,
        provider_location_id: String(expectedAccountBinding.locationKey || "").slice(9),
        date,
        location_name: cell("Location", 80) || null,
        role_name: cell("Role", 80) || null,
        start_time: clockedIn,
        end_time: clockedOut,
        breaks_label: cell("Breaks", 120) || null,
        hours: decimalHours(cell("Hours", 20)),
        approval_status: approvalStatus,
        closed: Boolean(clockedOut),
      });
    }
    if (!rows.length) throw new Error("No visible closed or open punch rows were found in this pay period.");
    return {
      version: 1,
      selectionKind: "visible-timesheet-v1",
      captureClass: "punch",
      transport: "fetch",
      path: target.pathname,
      capturedAt: new Date().toISOString(),
      contentType: "application/json",
      accountBinding: expectedAccountBinding,
      body: JSON.stringify({ timesheets: rows }),
    };
  }

  globalThis.HearthVisibleTimesheet = Object.freeze({ extractVisibleTimesheet });
})();
