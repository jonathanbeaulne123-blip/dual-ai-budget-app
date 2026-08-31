(function roadmapApp() {
  "use strict";

  const data = window.HEARTH_ROADMAP_DATA;

  function byId(id) {
    return document.getElementById(id);
  }

  function make(tag, options = {}) {
    const node = document.createElement(tag);
    if (options.className) node.className = options.className;
    if (options.text !== undefined) node.textContent = String(options.text);
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([key, value]) => {
        node.setAttribute(key, String(value));
      });
    }
    return node;
  }

  function replaceChildren(target, children) {
    target.replaceChildren(...children);
  }

  function renderFailure() {
    const main = byId("main");
    const notice = make("section", { className: "disclosure" });
    const title = make("h2", { text: "Roadmap unavailable" });
    const detail = make("p", {
      text: "The roadmap data could not be loaded. The underlying project documents are unchanged.",
    });
    notice.append(title, detail);
    main.replaceChildren(notice);
  }

  function renderMeta() {
    byId("page-title").textContent = data.meta.title;
    byId("hero-summary").textContent = data.meta.summary;
    byId("roadmap-disclosure").textContent = data.meta.disclosure;
    byId("footer-version").textContent = `Updated ${data.meta.auditAsOf} · schema ${data.schemaVersion}`;

    const entries = [
      ["Updated", data.meta.auditAsOf],
      ["Classification", data.meta.classification],
      ["Posture", data.meta.posture],
      ["Access", data.meta.access],
      ["Evidence baseline", data.meta.auditBaseline],
    ];

    const rows = entries.map(([term, description]) => {
      const row = make("div");
      row.append(make("dt", { text: term }), make("dd", { text: description }));
      return row;
    });
    replaceChildren(byId("roadmap-meta"), rows);
  }

  function renderScorecards() {
    const cards = data.scorecards.map((scorecard) => {
      const card = make("article", {
        className: `score-card tone-${scorecard.tone}`,
        attrs: { "aria-label": `${scorecard.area}: ${scorecard.score} out of 10` },
      });
      const head = make("div", { className: "score-head" });
      head.append(
        make("h3", { text: scorecard.area }),
        make("span", { className: "score-value", text: `${scorecard.score.toFixed(1)}/10` }),
      );

      const track = make("div", {
        className: "score-track",
        attrs: {
          role: "meter",
          "aria-label": scorecard.area,
          "aria-valuemin": "0",
          "aria-valuemax": "10",
          "aria-valuenow": scorecard.score,
        },
      });
      const fill = make("span");
      fill.style.setProperty("--score", `${scorecard.score * 10}%`);
      track.append(fill);

      card.append(
        head,
        track,
        make("p", { text: `Confidence: ${scorecard.confidence}` }),
        make("p", { className: "score-risk", text: scorecard.risk }),
      );
      return card;
    });
    replaceChildren(byId("scorecards"), cards);
  }

  function makeList(items) {
    const list = make("ul");
    items.forEach((item) => list.append(make("li", { text: item })));
    return list;
  }

  function renderVision() {
    byId("vision-eyebrow").textContent = data.vision.eyebrow;
    byId("vision-title").textContent = data.vision.title;

    const story = [make("p", { className: "vision-lead", text: data.vision.lead })];
    data.vision.paragraphs.forEach((paragraph) => story.push(make("p", { text: paragraph })));
    replaceChildren(byId("vision-story"), story);

    const principles = data.vision.principles.map((principle) => {
      const card = make("article", { className: "vision-principle" });
      card.append(
        make("p", { className: "principle-label", text: principle.label }),
        make("h3", { text: principle.title }),
        make("p", { text: principle.detail }),
      );
      return card;
    });
    replaceChildren(byId("vision-principles"), principles);
  }

  function renderMilestones() {
    const milestones = data.milestones.map((milestone) => {
      const item = make("li", { className: "milestone" });
      const date = make("div", { className: "milestone-date" });
      date.append(
        make("time", { text: milestone.display, attrs: { datetime: milestone.datetime } }),
        make("span", { text: milestone.precision }),
      );
      const copy = make("div", { className: "milestone-copy" });
      copy.append(
        make("span", { className: "era-pill", text: milestone.era }),
        make("h3", { text: milestone.title }),
        make("p", { text: milestone.detail }),
      );
      item.append(date, copy);
      return item;
    });
    replaceChildren(byId("milestone-list"), milestones);
  }

  function renderLens(lens, activeButton) {
    const panel = byId("lens-panel");
    panel.className = `lens-panel tone-${lens.tone}`;
    panel.setAttribute("aria-labelledby", activeButton.id);

    const columns = make("div", { className: "two-column" });
    const strengths = make("section");
    strengths.append(make("h4", { text: "Evidence in favor" }), makeList(lens.strengths));
    const risks = make("section");
    risks.append(make("h4", { text: "Claim limits and risks" }), makeList(lens.risks));
    columns.append(strengths, risks);

    replaceChildren(panel, [
      make("h3", { text: lens.title }),
      make("p", { className: "lens-summary", text: lens.summary }),
      columns,
    ]);
  }

  function activateTab(buttons, index, render) {
    buttons.forEach((button, buttonIndex) => {
      const active = buttonIndex === index;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    render(index, buttons[index]);
  }

  function bindArrowKeys(container, buttons, activate) {
    container.addEventListener("keydown", (event) => {
      const current = buttons.indexOf(document.activeElement);
      if (current < 0) return;

      let next = current;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % buttons.length;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + buttons.length) % buttons.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = buttons.length - 1;
      if (next === current) return;

      event.preventDefault();
      activate(next);
      buttons[next].focus();
    });
  }

  function bindActivationKeys(container, buttons, activate) {
    container.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const current = buttons.indexOf(document.activeElement);
      if (current < 0) return;

      event.preventDefault();
      activate(current);
    });
  }

  function renderLensTabs() {
    const container = byId("lens-tabs");
    const buttons = data.lenses.map((lens, index) => make("button", {
      className: "tab",
      text: lens.label,
      attrs: {
        id: `lens-${lens.id}`,
        type: "button",
        role: "tab",
        "aria-controls": "lens-panel",
        "aria-selected": index === 0,
      },
    }));
    replaceChildren(container, buttons);

    const activate = (index) => activateTab(buttons, index, (activeIndex, button) => {
      renderLens(data.lenses[activeIndex], button);
    });
    buttons.forEach((button, index) => button.addEventListener("click", () => activate(index)));
    bindArrowKeys(container, buttons, activate);
    bindActivationKeys(container, buttons, activate);
    activate(0);
  }

  function renderEvidence() {
    const facts = data.evidenceSnapshot.facts.map((fact) => {
      const node = make("div", { className: "fact" });
      node.append(make("strong", { text: fact.value }), make("span", { text: fact.label }));
      return node;
    });
    replaceChildren(byId("evidence-facts"), facts);
    byId("evidence-caption").textContent = data.evidenceSnapshot.caption;
  }

  function renderGate(gate, activeButton) {
    const panel = byId("gate-panel");
    panel.setAttribute("aria-labelledby", activeButton.id);

    const head = make("div", { className: "gate-head" });
    head.append(
      make("h3", { text: `${gate.id} · ${gate.title}` }),
      make("span", { className: "state-pill", text: gate.state }),
    );

    const grid = make("div", { className: "gate-grid" });
    const outcome = make("section");
    outcome.append(make("h4", { text: "Outcome" }), make("p", { text: gate.outcome }));
    const proof = make("section");
    proof.append(make("h4", { text: "Proof required" }), makeList(gate.proof));
    grid.append(outcome, proof);

    const stop = make("p", { className: "stop-rule" });
    stop.append(make("strong", { text: "Stop or reshape: " }), document.createTextNode(gate.stop));
    replaceChildren(panel, [head, grid, stop]);
  }

  function renderGateTabs() {
    const container = byId("gate-tabs");
    const buttons = data.gates.map((gate, index) => make("button", {
      className: "tab",
      text: gate.id,
      attrs: {
        id: `gate-${gate.id}`,
        type: "button",
        role: "tab",
        "aria-controls": "gate-panel",
        "aria-selected": index === 0,
        "aria-label": `${gate.id}: ${gate.title}`,
      },
    }));
    replaceChildren(container, buttons);

    const activate = (index) => activateTab(buttons, index, (activeIndex, button) => {
      renderGate(data.gates[activeIndex], button);
    });
    buttons.forEach((button, index) => button.addEventListener("click", () => activate(index)));
    bindArrowKeys(container, buttons, activate);
    bindActivationKeys(container, buttons, activate);
    activate(0);
  }

  function renderMetrics() {
    const rows = data.metrics.map((metric) => {
      const row = make("tr");
      const context = make("td", { text: metric.context });
      const source = data.sources[metric.source];
      if (source) {
        context.append(
          make("br"),
          make("a", {
            className: "source-link",
            text: "View benchmark source",
            attrs: { href: source.url, target: "_blank", rel: "noopener noreferrer" },
          }),
        );
      }
      row.append(
        make("td", { text: metric.metric }),
        make("td", { text: metric.hearth }),
        context,
        make("td", { text: metric.gate }),
      );
      return row;
    });
    replaceChildren(byId("metric-rows"), rows);
  }

  function renderPhases(lane) {
    const phases = lane === "all" ? data.phases : data.phases.filter((phase) => phase.lane === lane);
    const cards = phases.map((phase) => {
      const card = make("article", { className: "phase-card" });
      const head = make("div", { className: "phase-head" });
      head.append(
        make("h3", { text: `${phase.id} · ${phase.title}` }),
        make("span", { className: "state-pill", text: phase.state }),
      );
      card.append(head, make("p", { text: phase.summary }));
      return card;
    });
    replaceChildren(byId("phase-list"), cards);
    byId("phase-status").textContent = `${phases.length} of ${data.phases.length} roadmap phases shown.`;
  }

  function renderPhaseFilters() {
    const filters = [
      { id: "all", label: "All phases" },
      { id: "current", label: "Current horizon" },
      { id: "later", label: "Later horizon" },
    ];
    const container = byId("phase-filters");
    const buttons = filters.map((filter, index) => make("button", {
      className: `tab${index === 0 ? " is-active" : ""}`,
      text: filter.label,
      attrs: { type: "button", "aria-pressed": index === 0 },
    }));
    replaceChildren(container, buttons);
    buttons.forEach((button, index) => {
      button.addEventListener("click", () => {
        buttons.forEach((item, itemIndex) => {
          const active = itemIndex === index;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        renderPhases(filters[index].id);
      });
    });
    renderPhases("all");
  }

  function renderPriorities() {
    const cards = data.priorities.map((priority) => {
      const card = make("article", { className: "priority-card" });
      card.append(make("h3", { text: priority.title }), makeList(priority.items));
      return card;
    });
    replaceChildren(byId("priority-grid"), cards);
  }

  function renderUpdates() {
    const updates = data.updates.map((update) => {
      const item = make("li", { className: "update-item" });
      const time = make("time", { text: update.date, attrs: { datetime: update.date } });
      const copy = make("div");
      copy.append(make("h3", { text: update.title }), make("p", { text: update.detail }));
      item.append(time, copy);
      return item;
    });
    replaceChildren(byId("update-list"), updates);
  }

  function renderMuseum() {
    const exhibits = data.museum.map((exhibit) => {
      const article = make("article", { className: "museum-exhibit", attrs: { "data-exhibit": exhibit.id } });
      const head = make("div", { className: "museum-head" });
      const identity = make("div");
      identity.append(
        make("p", { className: "exhibit-number", text: exhibit.exhibit }),
        make("h3", { text: exhibit.title }),
        make("p", { className: "museum-era", text: exhibit.era }),
      );
      const date = make("time", {
        className: "museum-date",
        text: exhibit.dateLabel,
        attrs: { datetime: exhibit.date },
      });
      head.append(identity, date);

      const status = make("p", { className: "museum-status", text: exhibit.status });
      const provenance = make("p", { className: "museum-provenance" });
      provenance.append(make("strong", { text: "Provenance: " }), document.createTextNode(exhibit.provenance));

      const details = make("div", { className: "museum-details" });
      const outline = make("details");
      outline.append(make("summary", { text: "What this roadmap contained" }), makeList(exhibit.outline));
      const changed = make("details");
      changed.append(make("summary", { text: "What changed since" }), makeList(exhibit.changed));
      details.append(outline, changed);

      const source = make("a", {
        className: "button museum-link",
        text: exhibit.source.label,
        attrs: { href: exhibit.source.url, target: "_blank", rel: "noopener noreferrer" },
      });

      article.append(head, status, make("p", { className: "museum-summary", text: exhibit.summary }), provenance, details, source);
      return article;
    });
    replaceChildren(byId("museum-list"), exhibits);
  }

  function renderSources() {
    const items = Object.values(data.sources).map((source) => {
      const item = make("li");
      item.append(make("a", {
        text: source.label,
        attrs: { href: source.url, target: "_blank", rel: "noopener noreferrer" },
      }));
      return item;
    });
    replaceChildren(byId("source-list"), items);
  }

  if (!data || data.schemaVersion !== 2) {
    renderFailure();
    return;
  }

  renderMeta();
  renderVision();
  renderMilestones();
  renderScorecards();
  renderLensTabs();
  renderEvidence();
  renderGateTabs();
  renderMetrics();
  renderPhaseFilters();
  renderPriorities();
  renderUpdates();
  renderMuseum();
  renderSources();
})();
