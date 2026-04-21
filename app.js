(function () {
  const data = window.ERDOS_AI_DATA;

  if (!data) {
    document.body.innerHTML =
      '<main class="page-shell"><section class="panel empty-state">Missing <code>app-data.js</code>. Run <code>node build-data.mjs</code> first.</section></main>';
    return;
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const MONTHS = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  const OUTCOME_LABELS = {
    full: "Full / closed-form progress",
    partial: "Partial / directional progress",
    incorrect: "Incorrect / unstable claims",
    neutral: "Review / tooling / uncategorized",
  };

  const OUTCOME_COLORS = {
    full: "var(--tone-full)",
    partial: "var(--tone-partial)",
    incorrect: "var(--tone-incorrect)",
    neutral: "var(--tone-neutral)",
  };

  const PROOF_BREAKDOWN_LABELS = {
    autonomous: "Fully autonomous complete proofs",
    improvement: "Improvements on existing proofs",
    other: "Other",
  };

  const PROOF_BREAKDOWN_COLORS = {
    autonomous: "var(--accent-openai)",
    improvement: "var(--accent-google)",
    other: "var(--accent-xai)",
  };

  const METRIC_LABELS = {
    progress: "Credited progress",
    rows: "Contribution rows",
    problems: "Unique problems",
  };

  const SERIES_LABELS = {
    overall: "overall",
    outcome: "outcome tone",
    proof: "novel / improved proof breakdown",
    scope: "scope",
    section: "wiki section",
    vendor: "vendor",
    model: "matched model release",
  };

  const LINE_PALETTE = [
    "#0d7a65",
    "#1f5ca8",
    "#934c2f",
    "#3b4ea2",
    "#b15d18",
    "#7a3ab6",
    "#287f44",
    "#b03f63",
    "#4d6784",
    "#a68016",
  ];

  const VENDOR_CLASSES = {
    OpenAI: "vendor-openai",
    Anthropic: "vendor-anthropic",
    Google: "vendor-google",
    "Google DeepMind": "vendor-google-deepmind",
    "ByteDance Seed": "vendor-bytedance-seed",
    DeepSeek: "vendor-deepseek",
    xAI: "vendor-xai",
    Inferred: "vendor-inferred",
  };

  const dom = {
    heroMeta: document.getElementById("hero-meta"),
    sourceLine: document.getElementById("source-line"),
    searchInput: document.getElementById("search-input"),
    lensSelect: document.getElementById("lens-select"),
    scopeSelect: document.getElementById("scope-select"),
    activeFilterSummary: document.getElementById("active-filter-summary"),
    modelSearchInput: document.getElementById("model-search-input"),
    modelVendorFilters: document.getElementById("model-vendor-filters"),
    modelPickerSummary: document.getElementById("model-picker-summary"),
    modelQuickGrid: document.getElementById("model-quick-grid"),
    modelChipGrid: document.getElementById("model-chip-grid"),
    modelSelect: document.getElementById("model-select"),
    clearModelFocus: document.getElementById("clear-model-focus"),
    metricSelect: document.getElementById("metric-select"),
    seriesSelect: document.getElementById("series-select"),
    unknownToggle: document.getElementById("show-unknown-toggle"),
    overlayToggle: document.getElementById("show-release-overlay-toggle"),
    sectionFilters: document.getElementById("section-filters"),
    outcomeFilters: document.getElementById("outcome-filters"),
    resetFilters: document.getElementById("reset-filters"),
    statsGrid: document.getElementById("stats-grid"),
    insightList: document.getElementById("insight-list"),
    timeline: document.getElementById("timeline-chart"),
    timelineSubhead: document.getElementById("timeline-subhead"),
    timelineLegend: document.getElementById("timeline-legend"),
    lagChart: document.getElementById("lag-chart"),
    lagSubhead: document.getElementById("lag-subhead"),
    lagLegend: document.getElementById("lag-legend"),
    proofChart: document.getElementById("proof-chart"),
    proofSubhead: document.getElementById("proof-subhead"),
    proofLegend: document.getElementById("proof-legend"),
    statusChart: document.getElementById("status-chart"),
    statusSubhead: document.getElementById("status-subhead"),
    statusLegend: document.getElementById("status-legend"),
    modelFamilyChart: document.getElementById("model-family-chart"),
    modelFamilySubhead: document.getElementById("model-family-subhead"),
    modelFamilyLegend: document.getElementById("model-family-legend"),
    generationChart: document.getElementById("generation-chart"),
    generationSubhead: document.getElementById("generation-subhead"),
    generationLegend: document.getElementById("generation-legend"),
    breakdownTabs: document.getElementById("breakdown-tabs"),
    drilldownTabs: document.getElementById("drilldown-tabs"),
    detailPanel: document.getElementById("detail-panel"),
    releaseList: document.getElementById("release-list"),
    tableSummary: document.getElementById("table-summary"),
    dataTable: document.getElementById("data-table"),
    tableBody: document.getElementById("table-body"),
  };

  const releases = data.releases
    .map((release) => ({
      ...release,
      regexes: (release.patterns || []).map((pattern) => new RegExp(pattern, "i")),
      releaseDateObj: new Date(`${release.releaseDate}T00:00:00Z`),
      publicDateObj: release.publicDate
        ? new Date(`${release.publicDate}T00:00:00Z`)
        : null,
      pickerText: [
        release.label,
        release.vendor,
        release.family,
        release.releaseDate,
        release.releaseType,
        release.sourceKind,
        release.notes,
        release.inferredFrom?.problem,
        release.inferredFrom?.dateRaw,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    }))
    .sort((left, right) => left.releaseDate.localeCompare(right.releaseDate));

  const releaseById = new Map(releases.map((release) => [release.id, release]));
  const vendorOrder = [...new Set([...Object.keys(VENDOR_CLASSES), ...releases.map((release) => release.vendor)])]
    .filter((vendor) => releases.some((release) => release.vendor === vendor));
  const releasesByFamily = releases.reduce((bucket, release) => {
    if (!bucket.has(release.family)) {
      bucket.set(release.family, []);
    }
    bucket.get(release.family).push(release);
    return bucket;
  }, new Map());

  const sections = data.sections.map((section) => ({
    ...section,
    shortLabel: getSectionShortLabel(section.title),
  }));

  const sectionByAnchor = new Map(sections.map((section) => [section.anchor, section]));

  const records = data.records
    .map((record) => enhanceRecord(record))
    .sort((left, right) => left.startMs - right.startMs || left.subsectionOrder - right.subsectionOrder);

  const state = {
    query: "",
    lens: "all",
    scope: "all",
    modelQuery: "",
    modelVendor: "all",
    modelId: "all",
    metric: "progress",
    seriesMode: "overall",
    showUnknown: true,
    showOverlay: true,
    activeSections: new Set(sections.map((section) => section.anchor)),
    activeOutcomes: new Set(Object.keys(OUTCOME_LABELS)),
    breakdownView: "proof",
    drilldownView: "milestone",
    selectedPoint: null,
    tableSort: {
      column: "date",
      direction: "desc",
    },
  };

  init();

  function init() {
    renderHero();
    renderSources();
    initModelSelect();
    initSectionFilters();
    initOutcomeFilters();
    bindEvents();
    render();

    const observer = new ResizeObserver(() => {
      render();
    });

    observer.observe(dom.timeline.parentElement);
    observer.observe(dom.lagChart.parentElement);
    observer.observe(dom.proofChart.parentElement);
    observer.observe(dom.statusChart.parentElement);
    observer.observe(dom.modelFamilyChart.parentElement);
    observer.observe(dom.generationChart.parentElement);
  }

  function bindEvents() {
    dom.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      render();
    });

    dom.lensSelect.addEventListener("change", (event) => {
      state.lens = event.target.value;
      render();
    });

    dom.modelSearchInput.addEventListener("input", (event) => {
      state.modelQuery = event.target.value.trim().toLowerCase();
      render();
    });

    dom.scopeSelect.addEventListener("change", (event) => {
      state.scope = event.target.value;
      render();
    });

    dom.modelSelect.addEventListener("change", (event) => {
      setModelFocus(event.target.value);
    });

    dom.clearModelFocus.addEventListener("click", () => {
      setModelFocus("all");
    });

    dom.metricSelect.addEventListener("change", (event) => {
      state.metric = event.target.value;
      render();
    });

    dom.seriesSelect.addEventListener("change", (event) => {
      state.seriesMode = event.target.value;
      render();
    });

    dom.unknownToggle.addEventListener("change", (event) => {
      state.showUnknown = event.target.checked;
      render();
    });

    dom.overlayToggle.addEventListener("change", (event) => {
      state.showOverlay = event.target.checked;
      renderTimeline(getFilteredRecords());
    });

    dom.breakdownTabs.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.breakdownView = button.dataset.view;
        render();
      });
    });

    dom.drilldownTabs.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.drilldownView = button.dataset.view;
        render();
      });
    });

    dom.resetFilters.addEventListener("click", () => {
      state.query = "";
      state.lens = "all";
      state.scope = "all";
      state.modelQuery = "";
      state.modelVendor = "all";
      state.modelId = "all";
      state.metric = "progress";
      state.seriesMode = "overall";
      state.showUnknown = true;
      state.showOverlay = true;
      state.activeSections = new Set(sections.map((section) => section.anchor));
      state.activeOutcomes = new Set(Object.keys(OUTCOME_LABELS));
      state.breakdownView = "proof";
      state.drilldownView = "milestone";
      state.tableSort = {
        column: "date",
        direction: "desc",
      };

      dom.searchInput.value = "";
      dom.lensSelect.value = "all";
      dom.modelSearchInput.value = "";
      dom.scopeSelect.value = "all";
      dom.modelSelect.value = "all";
      dom.metricSelect.value = "progress";
      dom.seriesSelect.value = "overall";
      dom.unknownToggle.checked = true;
      dom.overlayToggle.checked = true;

      render();
    });

    dom.dataTable.querySelectorAll("th[data-col]").forEach((header) => {
      header.addEventListener("click", () => {
        const column = header.dataset.col;
        if (state.tableSort.column === column) {
          state.tableSort.direction = state.tableSort.direction === "asc" ? "desc" : "asc";
        } else {
          state.tableSort.column = column;
          state.tableSort.direction = column === "date" ? "desc" : "asc";
        }
        renderContributionTable(getFilteredRecords());
      });
    });
  }

  function setModelFocus(modelId, options = {}) {
    const { toggle = false } = options;
    state.modelId = toggle && state.modelId === modelId ? "all" : modelId;
    dom.modelSelect.value = state.modelId;
    render();
  }

  function initModelSelect() {
    const groups = vendorOrder
      .map((vendor) => ({
        vendor,
        releases: releases.filter((release) => release.vendor === vendor),
      }))
      .filter((group) => group.releases.length > 0);

    dom.modelSelect.innerHTML = [
      '<option value="all">All curated model releases</option>',
      ...groups.map(
        (group) => `
          <optgroup label="${escapeHtml(group.vendor)}">
            ${group.releases
              .map(
                (release) =>
                  `<option value="${escapeHtml(release.id)}">${escapeHtml(release.label)} (${escapeHtml(release.releaseDate)})</option>`
              )
              .join("")}
          </optgroup>
        `
      ),
    ].join("");
  }

  function initSectionFilters() {
    dom.sectionFilters.replaceChildren(
      ...sections.map((section) => {
        const button = document.createElement("button");
        button.className = "chip-button is-active";
        button.type = "button";
        button.textContent = section.shortLabel;
        button.title = section.title;
        button.dataset.anchor = section.anchor;
        button.addEventListener("click", () => {
          if (state.activeSections.has(section.anchor)) {
            state.activeSections.delete(section.anchor);
          } else {
            state.activeSections.add(section.anchor);
          }
          render();
        });
        return button;
      })
    );
  }

  function initOutcomeFilters() {
    dom.outcomeFilters.replaceChildren(
      ...Object.entries(OUTCOME_LABELS).map(([key, label]) => {
        const button = document.createElement("button");
        button.className = "chip-button is-active";
        button.type = "button";
        button.textContent = label;
        button.dataset.outcome = key;
        button.addEventListener("click", () => {
          if (state.activeOutcomes.has(key)) {
            state.activeOutcomes.delete(key);
          } else {
            state.activeOutcomes.add(key);
          }
          render();
        });
        return button;
      })
    );
  }

  function renderModelPicker(filtered) {
    const counts = buildReleaseCounts(filtered);
    const releasesToShow = getModelPickerReleases(filtered, counts);
    const searchMatched = releases.filter((release) => matchesModelPickerRelease(release, false));
    const visibleReleaseCount = releasesToShow.filter((release) => (counts.get(release.id) || 0) > 0).length;
    const matchedRowCount = filtered.filter((record) => record.matchedReleases.length > 0).length;
    const quickReleaseLimit = state.modelQuery || state.modelVendor !== "all" ? 12 : 8;
    const vendorStats = vendorOrder.map((vendor) => ({
      vendor,
      visible: searchMatched.filter(
        (release) => release.vendor === vendor && (counts.get(release.id) || 0) > 0
      ).length,
      total: searchMatched.filter((release) => release.vendor === vendor).length,
    }));

    dom.modelVendorFilters.replaceChildren(
      createVendorChip({
        label: "All vendors",
        title:
          searchMatched.length > 0
            ? `${searchMatched.length} release(s) match the current picker search.`
            : "No releases match the current picker search.",
        isActive: state.modelVendor === "all",
        onClick() {
          state.modelVendor = "all";
          render();
        },
      }),
      ...vendorStats
        .filter((entry) => entry.total > 0)
        .map((entry) =>
          createVendorChip({
            label: `${entry.vendor} | ${entry.visible}`,
            title: `${entry.visible} visible release(s), ${entry.total} search-matched release(s).`,
            isActive: state.modelVendor === entry.vendor,
            className: VENDOR_CLASSES[entry.vendor] || "",
            onClick() {
              state.modelVendor = state.modelVendor === entry.vendor ? "all" : entry.vendor;
              render();
            },
          })
        )
    );

    const selectedRelease =
      state.modelId !== "all"
        ? releaseById.get(state.modelId)
        : null;
    const quickReleases = getQuickModelReleases(releasesToShow, counts, quickReleaseLimit, selectedRelease);

    dom.modelPickerSummary.textContent = selectedRelease
      ? `Focused on ${selectedRelease.label}. Showing ${quickReleases.length} quick pick(s); ${visibleReleaseCount} matching release(s) remain available in the full browser.`
      : `${quickReleases.length} quick pick(s) surface the busiest releases in the current slice. ${visibleReleaseCount} matching release(s) are available in the full browser.`;

    dom.modelQuickGrid.replaceChildren(
      createModelChip({
        label: "All curated releases",
        meta: `${matchedRowCount} release-matched row(s)`,
        count: "",
        isActive: state.modelId === "all",
        compact: true,
        onClick() {
          setModelFocus("all");
        },
      }),
      ...quickReleases.map((release) =>
        createModelChip({
          label: release.label,
          meta: `${release.vendor} | ${release.releaseDate}`,
          count: `${counts.get(release.id) || 0}`,
          isActive: state.modelId === release.id,
          compact: true,
          className: VENDOR_CLASSES[release.vendor] || "",
          onClick() {
            setModelFocus(release.id, { toggle: true });
          },
        })
      )
    );

    dom.modelChipGrid.replaceChildren(
      createModelChip({
        label: "All curated releases",
        meta: `${matchedRowCount} release-matched row(s)`,
        count: "",
        isActive: state.modelId === "all",
        onClick() {
          setModelFocus("all");
        },
      }),
      ...releasesToShow.map((release) =>
        createModelChip({
          label: release.label,
          meta: `${release.vendor} | ${release.releaseDate} | ${release.sourceKind === "inferred" ? "inferred" : "official"}`,
          count: `${counts.get(release.id) || 0} row${counts.get(release.id) === 1 ? "" : "s"}`,
          isActive: state.modelId === release.id,
          className: `${VENDOR_CLASSES[release.vendor] || ""} ${
            (counts.get(release.id) || 0) === 0 ? "is-dim" : ""
          }`.trim(),
          onClick() {
            setModelFocus(release.id, { toggle: true });
          },
        })
      )
    );
  }

  function createVendorChip({ label, title, isActive, className = "", onClick }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip-button ${className}`.trim();
    button.textContent = label;
    button.title = title;
    button.classList.toggle("is-active", isActive);
    button.addEventListener("click", onClick);
    return button;
  }

  function createModelChip({ label, meta, count, isActive, className = "", compact = false, onClick }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `model-chip ${className}`.trim();
    if (isActive) {
      button.classList.add("is-active");
    }
    if (compact) {
      button.classList.add("is-quick");
    }
    button.innerHTML = `
      <span class="model-chip-copy">
        <strong>${escapeHtml(label)}</strong>
        <span class="model-chip-meta">${escapeHtml(meta)}</span>
      </span>
      <span class="model-chip-count">${escapeHtml(count)}</span>
    `;
    button.addEventListener("click", onClick);
    return button;
  }

  function getQuickModelReleases(releasesToShow, counts, limit, selectedRelease) {
    const quickReleases = releasesToShow.filter((release) => (counts.get(release.id) || 0) > 0).slice(0, limit);

    if (!quickReleases.length) {
      quickReleases.push(...releasesToShow.slice(0, limit));
    }

    if (selectedRelease && !quickReleases.some((release) => release.id === selectedRelease.id)) {
      quickReleases.unshift(selectedRelease);
    }

    return quickReleases.filter(
      (release, index, list) => list.findIndex((entry) => entry.id === release.id) === index
    );
  }

  function getModelPickerReleases(filtered, counts) {
    const pickerMatches = releases.filter((release) => matchesModelPickerRelease(release, true));
    const selectedRelease = state.modelId !== "all" ? releaseById.get(state.modelId) : null;

    if (selectedRelease && !pickerMatches.some((release) => release.id === selectedRelease.id)) {
      pickerMatches.unshift(selectedRelease);
    }

    return pickerMatches.sort((left, right) => {
      const selectedDiff =
        Number(right.id === state.modelId) - Number(left.id === state.modelId);
      if (selectedDiff) {
        return selectedDiff;
      }

      const countDiff = (counts.get(right.id) || 0) - (counts.get(left.id) || 0);
      if (countDiff) {
        return countDiff;
      }

      const visibilityDiff =
        Number((counts.get(right.id) || 0) > 0) - Number((counts.get(left.id) || 0) > 0);
      if (visibilityDiff) {
        return visibilityDiff;
      }

      const dateDiff = right.releaseDate.localeCompare(left.releaseDate);
      if (dateDiff) {
        return dateDiff;
      }

      return left.label.localeCompare(right.label);
    });
  }

  function matchesModelPickerRelease(release, applyVendorFilter) {
    if (state.modelQuery && !release.pickerText.includes(state.modelQuery)) {
      return false;
    }

    if (applyVendorFilter && state.modelVendor !== "all" && release.vendor !== state.modelVendor) {
      return false;
    }

    return true;
  }

  function buildReleaseCounts(filtered) {
    const counts = new Map();

    filtered.forEach((record) => {
      record.matchedReleases.forEach((match) => {
        counts.set(match.id, (counts.get(match.id) || 0) + 1);
      });
    });

    return counts;
  }

  function render() {
    syncChipStates();
    syncViewStates();

    const pickerFiltered = getFilteredRecords({ ignoreModel: true });
    renderModelPicker(pickerFiltered);

    const filtered = getFilteredRecords();
    renderActiveFilterSummary(filtered);
    const previousSelection = serializeSelectedPoint(state.selectedPoint);
    const calendarData = renderTimeline(filtered);
    const releaseData = renderLagChart(filtered);
    const selected = resolveSelectedPoint(calendarData, releaseData);

    if (serializeSelectedPoint(state.selectedPoint) !== previousSelection) {
      renderTimeline(filtered);
      renderLagChart(filtered);
    }

    renderStats(filtered);
    renderInsights(filtered);
    renderActiveBreakdown(filtered);
    renderActiveDrilldown(selected, pickerFiltered);
    renderContributionTable(filtered);
  }

  function syncChipStates() {
    dom.sectionFilters.querySelectorAll(".chip-button").forEach((button) => {
      button.classList.toggle("is-active", state.activeSections.has(button.dataset.anchor));
    });

    dom.outcomeFilters.querySelectorAll(".chip-button").forEach((button) => {
      button.classList.toggle("is-active", state.activeOutcomes.has(button.dataset.outcome));
    });
  }

  function syncViewStates() {
    syncTabGroup(dom.breakdownTabs, state.breakdownView);
    syncPanels(dom.breakdownTabs.parentElement, state.breakdownView);
    syncTabGroup(dom.drilldownTabs, state.drilldownView);
    syncPanels(dom.drilldownTabs.parentElement, state.drilldownView);
  }

  function syncTabGroup(container, activeView) {
    container.querySelectorAll("[data-view]").forEach((button) => {
      const isActive = button.dataset.view === activeView;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      button.tabIndex = isActive ? 0 : -1;
    });
  }

  function syncPanels(container, activePanel) {
    container.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== activePanel;
    });
  }

  function renderActiveFilterSummary(filtered) {
    const summaryItems = [
      { label: "Rows", value: filtered.length },
      { label: "Lens", value: state.lens === "proofs" ? "Novel / improved proofs" : "All contributions" },
      { label: "Scope", value: state.scope === "all" ? "All roles" : state.scope },
      { label: "Metric", value: METRIC_LABELS[state.metric] },
      { label: "Series", value: SERIES_LABELS[state.seriesMode] },
      { label: "Sections", value: `${state.activeSections.size}/${sections.length}` },
      { label: "Outcomes", value: `${state.activeOutcomes.size}/${Object.keys(OUTCOME_LABELS).length}` },
    ];

    if (state.modelId !== "all") {
      const selectedRelease = releaseById.get(state.modelId);
      if (selectedRelease) {
        summaryItems.push({
          label: "Model",
          value: selectedRelease.label,
        });
      }
    }

    dom.activeFilterSummary.replaceChildren(
      ...summaryItems.map((item) => {
        const chip = document.createElement("span");
        chip.className = "filter-pill";
        chip.innerHTML = `<strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(String(item.value))}</span>`;
        return chip;
      })
    );
  }

  function renderActiveBreakdown(filtered) {
    switch (state.breakdownView) {
      case "status":
        renderStatusChart(filtered);
        break;
      case "family":
        renderModelFamilyChart(filtered);
        break;
      case "generation":
        renderGenerationChart(filtered);
        break;
      case "proof":
      default:
        renderProofBreakdownChart(filtered);
        break;
    }
  }

  function renderActiveDrilldown(selected, pickerFiltered) {
    if (state.drilldownView === "releases") {
      renderReleaseList(pickerFiltered);
      return;
    }
    renderMilestoneTable(selected);
  }

  function renderHero() {
    const matchedRows = records.filter((record) => record.matchedReleases.length > 0).length;
    const earliestRecord = records[0]?.dateInfo?.start;
    const latestRecord = records.at(-1)?.dateInfo?.end;

    const chips = [
      {
        label: "Wiki rows",
        value: String(records.length),
      },
      {
        label: "Curated releases",
        value: String(releases.length),
      },
      {
        label: "Matched rows",
        value: `${matchedRows} / ${records.length}`,
      },
      {
        label: "Observed window",
        value:
          earliestRecord && latestRecord
            ? `${formatDate(earliestRecord)} to ${formatDate(latestRecord)}`
            : "Unavailable",
      },
    ];

    dom.heroMeta.replaceChildren(
      ...chips.map((chip) => {
        const card = document.createElement("div");
        card.className = "hero-chip";
        card.innerHTML = `<strong>${escapeHtml(chip.value)}</strong><span>${escapeHtml(chip.label)}</span>`;
        return card;
      })
    );
  }

  function renderSources() {
    const fetched = new Date(data.metadata.generatedAt);
    const sourceItems = [
      `<a class="pill-link" href="${escapeHtml(data.metadata.wikiPageUrl)}" target="_blank" rel="noreferrer">Wiki page</a>`,
      `<a class="pill-link" href="${escapeHtml(data.metadata.wikiRawUrl)}" target="_blank" rel="noreferrer">Raw markdown</a>`,
      `<span>Generated ${escapeHtml(formatDateTime(fetched))}</span>`,
    ];
    dom.sourceLine.innerHTML = sourceItems.join("");
  }

  function getFilteredRecords(options = {}) {
    const { ignoreModel = false } = options;
    const query = state.query;

    return records.filter((record) => {
      if (query && !record.searchText.includes(query)) {
        return false;
      }

      if (state.scope === "primary" && record.kind !== "primary") {
        return false;
      }

      if (state.scope === "secondary" && record.kind !== "secondary") {
        return false;
      }

      if (!state.activeSections.has(record.subsectionAnchor)) {
        return false;
      }

      if (!state.activeOutcomes.has(record.outcomeKind)) {
        return false;
      }

      if (state.lens === "proofs" && !record.isNovelProofContribution) {
        return false;
      }

      if (!ignoreModel && state.modelId !== "all") {
        return record.matchedReleases.some((match) => match.id === state.modelId);
      }

      if (!state.showUnknown && record.matchedReleases.length === 0) {
        return false;
      }

      return true;
    });
  }

  function resolveSelectedPoint(calendarData, releaseData) {
    const candidates = [calendarData, releaseData]
      .flatMap((chartData) =>
        (chartData?.series || []).flatMap((series) =>
          series.points.map((point) => ({
            chart: chartData.chart,
            series,
            point,
          }))
        )
      );

    if (!candidates.length) {
      state.selectedPoint = null;
      return null;
    }

    if (state.selectedPoint) {
      const match = candidates.find(
        (candidate) =>
          candidate.chart === state.selectedPoint.chart &&
          candidate.series.key === state.selectedPoint.seriesKey &&
          candidate.point.x === state.selectedPoint.x
      );
      if (match) {
        return match;
      }
    }

    const fallback = candidates
      .sort((left, right) => right.point.x - left.point.x || right.point.y - left.point.y)[0];

    state.selectedPoint = {
      chart: fallback.chart,
      seriesKey: fallback.series.key,
      x: fallback.point.x,
    };

    return fallback;
  }

  function serializeSelectedPoint(selectedPoint) {
    if (!selectedPoint) {
      return "";
    }
    return `${selectedPoint.chart}:${selectedPoint.seriesKey}:${selectedPoint.x}`;
  }

  function renderStats(filtered) {
    const uniqueProblems = new Set();
    const matched = filtered.filter((record) => record.matchedReleases.length > 0);
    const lagPoints = getLagPoints(filtered);
    const proofRows = filtered.filter((record) => record.isNovelProofContribution);

    filtered.forEach((record) => {
      record.problemIds.forEach((id) => uniqueProblems.add(id));
    });

    const stats = [
      {
        label: "Visible rows",
        value: filtered.length,
        note: "Current filter result",
      },
      {
        label: "Unique problems",
        value: uniqueProblems.size,
        note: "Problem IDs touched by those rows",
      },
      {
        label: "Novel / improved proofs",
        value: proofRows.length,
        note: "Rows in the proof-production category",
      },
      {
        label: "Release matched",
        value: matched.length,
        note: "Rows mentioning a curated release",
      },
      {
        label: "Median lag",
        value: lagPoints.length ? `${formatDays(median(lagPoints.map((point) => point.lagDays)))}` : "n/a",
        note: state.modelId === "all" ? "Shortest non-negative matched lag" : "Lag for the selected model",
      },
    ];

    dom.statsGrid.replaceChildren(
      ...stats.map((stat) => {
        const card = document.createElement("article");
        card.className = "stat-card";
        card.innerHTML = `
          <span class="stat-label">${escapeHtml(stat.label)}</span>
          <span class="stat-value">${escapeHtml(String(stat.value))}</span>
          <div class="stat-note">${escapeHtml(stat.note)}</div>
        `;
        return card;
      })
    );
  }

  function renderInsights(filtered) {
    if (!filtered.length) {
      dom.insightList.innerHTML = '<div class="insight-item">No rows match the current filters.</div>';
      return;
    }

    const dated = filtered.filter((record) => record.hasValidDate);
    const lagPoints = getLagPoints(filtered);
    const matched = filtered.filter((record) => record.matchedReleases.length > 0);
    const fullRows = filtered.filter((record) => record.outcomeKind === "full");
    const earliest = dated[0];
    const latest = dated.at(-1);
    const withinThirty = lagPoints.filter((point) => point.lagDays <= 30).length;
    const fastestFull = fullRows
      .flatMap((record) =>
        record.matchedReleases
          .filter((match) => match.lagDays !== null && match.lagDays >= 0)
          .map((match) => ({ record, match }))
      )
      .sort((left, right) => left.match.lagDays - right.match.lagDays)[0];

    const messages = [
      earliest && latest
        ? `Visible rows span ${formatDate(earliest.dateInfo.start)} through ${formatDate(latest.dateInfo.end)} across ${matched.length} release-matched entries.`
        : `No dated rows are available in the current filter slice, though ${filtered.length} row(s) remain visible.`,
      lagPoints.length
        ? `${withinThirty} matched rows land within 30 days of the reference release date.`
        : "No release lag can be computed from the current filter slice.",
      fastestFull
        ? `Fastest matched full-result row: ${fastestFull.record.problemText} via ${fastestFull.match.label}, ${formatDays(fastestFull.match.lagDays)} after release.`
        : "No matched full-result row is available in the current slice.",
    ];

    dom.insightList.replaceChildren(
      ...messages.map((message) => {
        const item = document.createElement("div");
        item.className = "insight-item";
        item.textContent = message;
        return item;
      })
    );
  }

  function renderStatusChart(filtered) {
    const items = Object.entries(OUTCOME_LABELS)
      .map(([key, label]) => ({
        key,
        label,
        value: filtered.filter((record) => record.outcomeKind === key).length,
        color: OUTCOME_COLORS[key],
      }))
      .filter((item) => item.value > 0);

    dom.statusSubhead.textContent = filtered.length
      ? `${filtered.length} visible row(s), grouped by outcome tone.`
      : "No rows match the current filters.";

    renderDonutChart({
      svg: dom.statusChart,
      items,
      emptyMessage: "No rows match the current filters.",
      centerValue: String(filtered.length),
      centerLabel: "rows",
    });

    renderLegend(
      dom.statusLegend,
      items.map((item) => ({
        color: item.color,
        label: item.label,
        finalValue: item.value,
      }))
    );
  }

  function renderProofBreakdownChart(filtered) {
    const proofRows = filtered.filter((record) => record.isNovelProofContribution);
    const items = Object.entries(PROOF_BREAKDOWN_LABELS)
      .map(([key, label]) => ({
        key,
        label,
        value: proofRows.filter((record) => record.novelProofKind === key).length,
        color: PROOF_BREAKDOWN_COLORS[key],
      }))
      .filter((item) => item.value > 0);

    dom.proofSubhead.textContent = proofRows.length
      ? `${proofRows.length} row(s) in the novel/improved proof category.`
      : "No rows in the novel/improved proof category match the current filters.";

    renderDonutChart({
      svg: dom.proofChart,
      items,
      emptyMessage: "No novel or improved proof rows match the current filters.",
      centerValue: String(proofRows.length),
      centerLabel: "proof rows",
    });

    renderLegend(
      dom.proofLegend,
      items.map((item) => ({
        color: item.color,
        label: item.label,
        finalValue: item.value,
      }))
    );
  }

  function renderModelFamilyChart(filtered) {
    const items = getModelFamilyItems(filtered).slice(0, 8);
    const matchedRows = filtered.filter((record) => record.matchedReleases.length > 0).length;

    dom.modelFamilySubhead.textContent = matchedRows
      ? `${matchedRows} release-matched row(s), counted once per family per row.`
      : "No curated release matches are available in the current slice.";

    renderHorizontalBarChart({
      svg: dom.modelFamilyChart,
      items,
      emptyMessage: "No curated release matches are available for the current filters.",
    });

    renderLegend(
      dom.modelFamilyLegend,
      items.slice(0, 5).map((item) => ({
        color: item.color,
        label: item.label,
        finalValue: item.value,
      }))
    );
  }

  function renderGenerationChart(filtered) {
    const items = getGenerationItems(filtered).slice(0, 8);
    const totals = items.reduce(
      (bucket, item) => ({
        full: bucket.full + item.fullValue,
        partial: bucket.partial + item.partialValue,
      }),
      { full: 0, partial: 0 }
    );

    dom.generationSubhead.textContent = items.length
      ? "Unique problem IDs with non-negative release lag, anchored to the closest matched release."
      : "No release-aligned problem solves are available in the current slice.";

    renderStackedBarChart({
      svg: dom.generationChart,
      items,
      segments: [
        { key: "fullValue", color: OUTCOME_COLORS.full, label: "Full-solution problems" },
        { key: "partialValue", color: OUTCOME_COLORS.partial, label: "Partial-progress problems" },
      ],
      emptyMessage: "No release-aligned problem solves are available for the current filters.",
    });

    renderLegend(dom.generationLegend, [
      {
        color: OUTCOME_COLORS.full,
        label: "Full-solution problems",
        finalValue: totals.full,
      },
      {
        color: OUTCOME_COLORS.partial,
        label: "Partial-progress problems",
        finalValue: totals.partial,
      },
    ]);
  }

  function getModelFamilyItems(filtered) {
    const familyMap = new Map();

    filtered.forEach((record) => {
      const uniqueFamilies = new Map(record.matchedReleases.map((match) => [match.family, match]));
      uniqueFamilies.forEach((match, family) => {
        if (!familyMap.has(family)) {
          familyMap.set(family, {
            family,
            label: formatFamilyName(family),
            color: vendorColor(match.vendor),
            value: 0,
            problems: new Set(),
          });
        }

        const bucket = familyMap.get(family);
        bucket.value += 1;
        getProblemKeys(record).forEach((key) => bucket.problems.add(key));
      });
    });

    return [...familyMap.values()]
      .map((item) => ({
        ...item,
        subtitle: `${item.problems.size} unique problem${item.problems.size === 1 ? "" : "s"}`,
      }))
      .sort((left, right) => right.value - left.value || right.problems.size - left.problems.size);
  }

  function getGenerationItems(filtered) {
    const familyMap = new Map();

    filtered.forEach((record) => {
      const anchor = getAnchorReleaseMatch(record);
      if (!anchor) {
        return;
      }

      const family = anchor.family || anchor.id;
      if (!familyMap.has(family)) {
        familyMap.set(family, {
          family,
          label: formatFamilyName(family),
          color: vendorColor(anchor.vendor),
          fullProblems: new Set(),
          partialProblems: new Set(),
        });
      }

      const bucket = familyMap.get(family);
      const problemKeys = getProblemKeys(record);

      if (record.outcomeKind === "full") {
        problemKeys.forEach((key) => bucket.fullProblems.add(key));
      } else if (record.outcomeKind === "partial") {
        problemKeys.forEach((key) => bucket.partialProblems.add(key));
      }
    });

    return [...familyMap.values()]
      .map((item) => ({
        ...item,
        fullValue: item.fullProblems.size,
        partialValue: item.partialProblems.size,
        totalValue: item.fullProblems.size + item.partialProblems.size,
      }))
      .filter((item) => item.totalValue > 0)
      .sort((left, right) => right.totalValue - left.totalValue || right.fullValue - left.fullValue);
  }

  function renderTimeline(filtered) {
    const chartData = buildCalendarChartData(filtered);
    chartData.chart = "calendar";
    dom.timelineSubhead.textContent = buildCalendarSubhead(filtered, chartData);
    renderCumulativeLineChart({
      svg: dom.timeline,
      legendEl: dom.timelineLegend,
      chartData,
      emptyMessage: "No rows match the current filters.",
      xType: "date",
      overlayReleases: state.showOverlay ? getCalendarReleaseMarkers(filtered) : [],
    });
    return chartData;
  }

  function renderLagChart(filtered) {
    const chartData = buildReleaseChartData(filtered);
    chartData.chart = "release";
    dom.lagSubhead.textContent = buildReleaseSubhead(filtered, chartData);
    renderCumulativeLineChart({
      svg: dom.lagChart,
      legendEl: dom.lagLegend,
      chartData,
      emptyMessage: "No release-aligned rows are available for the current filters.",
      xType: "lag",
      overlayReleases: [],
    });
    return chartData;
  }

  function buildCalendarChartData(filtered) {
    const seriesMap = new Map();

    filtered.forEach((record) => {
      if (!record.hasValidDate) {
        return;
      }
      getCalendarSeriesDescriptors(record).forEach((descriptor) => {
        const series = ensureSeries(seriesMap, descriptor);
        series.events.push({
          x: startOfDayUtc(record.dateInfo.start).getTime(),
          record,
        });
      });
    });

    return finalizeSeriesCollection(seriesMap, "date");
  }

  function buildReleaseChartData(filtered) {
    const seriesMap = new Map();

    filtered.forEach((record) => {
      getReleaseSeriesDescriptors(record).forEach((descriptor) => {
        const series = ensureSeries(seriesMap, descriptor);
        series.events.push({
          x: descriptor.x,
          record,
          release: descriptor.release || null,
        });
      });
    });

    return finalizeSeriesCollection(seriesMap, "lag");
  }

  function ensureSeries(seriesMap, descriptor) {
    if (!seriesMap.has(descriptor.key)) {
      seriesMap.set(descriptor.key, {
        key: descriptor.key,
        label: descriptor.label,
        color: descriptor.color,
        events: [],
      });
    }
    return seriesMap.get(descriptor.key);
  }

  function finalizeSeriesCollection(seriesMap, xType) {
    const rawSeries = [...seriesMap.values()].map((series) => finalizeSeries(series, xType));
    const activeSeries = trimSeries(rawSeries.filter((series) => series.points.length > 0));
    const allPoints = activeSeries.flatMap((series) => series.points);
    const computedMinX = allPoints.length ? Math.min(...allPoints.map((point) => point.x)) : 0;
    const computedMaxX = allPoints.length ? Math.max(...allPoints.map((point) => point.x)) : 0;

    return {
      xType,
      series: activeSeries,
      minX: xType === "lag" ? 0 : computedMinX,
      maxX: computedMaxX,
      maxY: activeSeries.length ? Math.max(...activeSeries.map((series) => series.finalValue)) : 0,
      trimmed: rawSeries.length > activeSeries.length,
    };
  }

  function finalizeSeries(series, xType) {
    const buckets = new Map();

    series.events
      .sort((left, right) => left.x - right.x)
      .forEach((event) => {
        if (!buckets.has(event.x)) {
          buckets.set(event.x, {
            x: event.x,
            records: [],
            value: 0,
            problemIds: [],
            release: event.release || null,
          });
        }

        const bucket = buckets.get(event.x);
        bucket.records.push(event.record);
        if (!bucket.release && event.release) {
          bucket.release = event.release;
        }

        if (state.metric === "problems") {
          bucket.problemIds.push(...getProblemKeys(event.record));
        } else {
          bucket.value += getRecordMetricValue(event.record);
        }
      });

    const points = [];
    let cumulative = 0;
    const seenProblems = new Set();

    [...buckets.values()].forEach((bucket) => {
      let delta = bucket.value;

      if (state.metric === "problems") {
        delta = 0;
        [...new Set(bucket.problemIds)].forEach((problemKey) => {
          if (!seenProblems.has(problemKey)) {
            seenProblems.add(problemKey);
            delta += 1;
          }
        });
      }

      cumulative += delta;
      points.push({
        x: bucket.x,
        y: cumulative,
        delta,
        records: bucket.records,
        release: bucket.release,
        primaryRecord: bucket.records.at(-1) || null,
      });
    });

    return {
      ...series,
      xType,
      points,
      finalValue: cumulative,
    };
  }

  function trimSeries(seriesList) {
    const maxSeries = state.seriesMode === "vendor" || state.seriesMode === "model" ? 8 : Number.POSITIVE_INFINITY;

    if (seriesList.length <= maxSeries) {
      return seriesList.sort((left, right) => right.finalValue - left.finalValue);
    }

    return [...seriesList]
      .sort((left, right) => right.finalValue - left.finalValue)
      .slice(0, maxSeries);
  }

  function getCalendarSeriesDescriptors(record) {
    if (state.seriesMode === "vendor") {
      const vendors = [...new Set(record.matchedReleases.map((match) => match.vendor))];
      if (!vendors.length) {
        return [buildSeriesDescriptor("vendor", "unmatched", "No curated release match")];
      }
      return vendors.map((vendor) => buildSeriesDescriptor("vendor", vendor, vendor));
    }

    if (state.seriesMode === "model") {
      if (!record.matchedReleases.length) {
        return [buildSeriesDescriptor("model", "unmatched", "No curated release match")];
      }
      return [...new Map(record.matchedReleases.map((match) => [match.id, match])).values()].map((match) =>
        buildSeriesDescriptor("model", match.id, match.label)
      );
    }

    return getBaseSeriesDescriptors(record);
  }

  function getReleaseSeriesDescriptors(record) {
    if (state.seriesMode === "vendor") {
      return getReleaseMatchesForSeries(record).map((match) => ({
        ...buildSeriesDescriptor("vendor", match.vendor, match.vendor),
        x: match.lagDays,
        release: match,
      }));
    }

    if (state.seriesMode === "model") {
      return getReleaseMatchesForSeries(record).map((match) => ({
        ...buildSeriesDescriptor("model", match.id, match.label),
        x: match.lagDays,
        release: match,
      }));
    }

    const anchor = getAnchorReleaseMatch(record);
    if (!anchor) {
      return [];
    }

    return getBaseSeriesDescriptors(record).map((descriptor) => ({
      ...descriptor,
      x: anchor.lagDays,
      release: anchor,
    }));
  }

  function getBaseSeriesDescriptors(record) {
    switch (state.seriesMode) {
      case "outcome":
        return [
          buildSeriesDescriptor(
            "outcome",
            record.outcomeKind,
            OUTCOME_LABELS[record.outcomeKind]
          ),
        ];
      case "proof":
        return [
          buildSeriesDescriptor(
            "proof",
            record.novelProofKind || "outside",
            record.novelProofKind
              ? PROOF_BREAKDOWN_LABELS[record.novelProofKind]
              : "Outside proof category"
          ),
        ];
      case "scope":
        return [
          buildSeriesDescriptor(
            "scope",
            record.kind,
            record.kind === "primary" ? "Primary role" : "Secondary contribution"
          ),
        ];
      case "section":
        return [
          buildSeriesDescriptor("section", record.subsectionAnchor, record.sectionShort),
        ];
      case "overall":
      default:
        return [buildSeriesDescriptor("overall", "all", "All filtered rows")];
    }
  }

  function buildSeriesDescriptor(mode, key, label) {
    return {
      key: `${mode}:${key}`,
      label,
      color: getSeriesColor(mode, key),
    };
  }

  function getSeriesColor(mode, key) {
    if (mode === "outcome") {
      return OUTCOME_COLORS[key] || "var(--ink)";
    }

    if (mode === "proof") {
      return PROOF_BREAKDOWN_COLORS[key] || "var(--tone-neutral)";
    }

    if (mode === "vendor") {
      return vendorColor(key);
    }

    if (mode === "scope") {
      return key === "primary" ? "#0d7a65" : "#934c2f";
    }

    if (key === "unmatched") {
      return "var(--tone-neutral)";
    }

    const index = Math.abs(hashString(String(key))) % LINE_PALETTE.length;
    return LINE_PALETTE[index];
  }

  function getReleaseMatchesForSeries(record) {
    if (state.modelId !== "all") {
      return record.matchedReleases.filter(
        (match) => match.id === state.modelId && match.lagDays !== null && match.lagDays >= 0
      );
    }

    return record.matchedReleases.filter((match) => match.lagDays !== null && match.lagDays >= 0);
  }

  function getAnchorReleaseMatch(record) {
    const viable = getReleaseMatchesForSeries(record).sort((left, right) => left.lagDays - right.lagDays);
    return viable[0] || null;
  }

  function getRecordMetricValue(record) {
    if (state.metric === "rows") {
      return 1;
    }

    if (state.metric === "progress") {
      return record.progressCredit;
    }

    return 0;
  }

  function getProblemKeys(record) {
    if (record.problemIds.length) {
      return record.problemIds.map((problemId) => `problem:${problemId}`);
    }
    return [`row:${record.id}`];
  }

  function buildCalendarSubhead(filtered, chartData) {
    const base = `${METRIC_LABELS[state.metric]} accumulated by ${SERIES_LABELS[state.seriesMode]} across contribution dates.`;
    const extra = [];

    if (state.lens === "proofs") {
      extra.push("Lens limited to novel or improved proof-producing rows.");
    }

    if (state.metric === "progress") {
      extra.push("Credit rule: full = 1, partial = 0.5, incorrect/neutral = 0.");
    }

    if (state.seriesMode === "vendor" || state.seriesMode === "model") {
      extra.push("Rows mentioning multiple models can contribute to multiple lines.");
    }

    if (chartData.trimmed) {
      extra.push("Showing the 8 largest visible series.");
    }

    if (state.showOverlay && getCalendarReleaseMarkers(filtered).length) {
      extra.push("Curated release markers are overlaid.");
    }

    return [base, ...extra].join(" ");
  }

  function buildReleaseSubhead(filtered, chartData) {
    const matchedRows = filtered.filter((record) => getAnchorReleaseMatch(record)).length;
    const base = `${METRIC_LABELS[state.metric]} accumulated by ${SERIES_LABELS[state.seriesMode]} with the x-axis aligned to days after release.`;
    const extra = [`Matched rows used: ${matchedRows}.`];

    if (state.lens === "proofs") {
      extra.push("Lens limited to novel or improved proof-producing rows.");
    }

    if (state.metric === "progress") {
      extra.push("Credit rule: full = 1, partial = 0.5, incorrect/neutral = 0.");
    }

    if (state.seriesMode === "vendor" || state.seriesMode === "model") {
      extra.push("Rows mentioning multiple matched models can contribute to multiple lines.");
    }

    if (chartData.trimmed) {
      extra.push("Showing the 8 largest visible series.");
    }

    return [base, ...extra].join(" ");
  }

  function getCalendarReleaseMarkers(filtered) {
    const visible = getVisibleReleases(filtered);
    if (state.modelId !== "all") {
      return visible;
    }
    return visible.slice(0, 8);
  }

  function renderCumulativeLineChart({ svg, legendEl, chartData, emptyMessage, xType, overlayReleases }) {
    svg.replaceChildren();
    legendEl.replaceChildren();

    if (!chartData.series.length) {
      renderEmptySvg(svg, emptyMessage);
      return;
    }

    const width = Math.max(svg.parentElement.clientWidth, xType === "date" ? 540 : 360);
    const height = 340;
    const margin = { top: 26, right: 20, bottom: 46, left: 58 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const minX = chartData.minX;
    const maxX = chartData.maxX === chartData.minX ? chartData.minX + (xType === "date" ? DAY_MS : 1) : chartData.maxX;
    const maxY = Math.max(1, chartData.maxY);

    const xScale = (value) => margin.left + ((value - minX) / (maxX - minX)) * plotWidth;
    const yScale = (value) => margin.top + plotHeight - (value / maxY) * plotHeight;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", String(height));

    drawLineChartGrid(svg, xType, minX, maxX, maxY, xScale, yScale, width, height, margin);

    if (xType === "date" && overlayReleases.length) {
      drawLineChartReleaseMarkers(svg, overlayReleases, xScale, margin, height);
    }

    const seriesLayer = svgNode("g", {});
    let selectedCandidate = null;

    chartData.series.forEach((series) => {
      const path = buildStepPath(series.points, xScale, yScale, minX, maxX);

      seriesLayer.appendChild(
        svgNode("path", {
          d: path,
          fill: "none",
          stroke: series.color,
          "stroke-width": 3,
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
        }, null, `${series.label}: ${formatMetricValue(series.finalValue)}`)
      );

      series.points.forEach((point) => {
        const isSelected =
          state.selectedPoint &&
          state.selectedPoint.chart === chartData.chart &&
          state.selectedPoint.seriesKey === series.key &&
          state.selectedPoint.x === point.x;

        if (isSelected) {
          selectedCandidate = { series, point };
        }

        const node = svgNode(
          "circle",
          {
            cx: xScale(point.x),
            cy: yScale(point.y),
            r: isSelected ? 5.5 : 4,
            fill: series.color,
            stroke: isSelected ? "var(--ink)" : "var(--surface-strong)",
            "stroke-width": isSelected ? 2 : 1.5,
            cursor: "pointer",
          },
          null,
          buildSeriesPointTitle(series, point, xType)
        );

        node.addEventListener("click", () => {
          state.selectedPoint = {
            chart: chartData.chart,
            seriesKey: series.key,
            x: point.x,
          };
          render();
        });

        seriesLayer.appendChild(node);
      });
    });

    svg.appendChild(seriesLayer);

    if (selectedCandidate) {
      drawSelectedPointOverlay(
        svg,
        chartData.chart,
        selectedCandidate.series,
        selectedCandidate.point,
        xScale,
        yScale,
        minX,
        maxX,
        maxY,
        xType,
        margin,
        width,
        height
      );
    }

    renderLegend(legendEl, chartData.series);
  }

  function drawLineChartGrid(svg, xType, minX, maxX, maxY, xScale, yScale, width, height, margin) {
    const layer = svgNode("g", {});
    const yStep = Math.max(1, Math.ceil(maxY / 4));

    for (let value = 0; value <= maxY; value += yStep) {
      const y = yScale(value);
      layer.appendChild(
        svgNode("line", {
          x1: margin.left,
          y1: y,
          x2: width - margin.right,
          y2: y,
          stroke: "var(--border)",
          "stroke-width": 1,
        })
      );

      layer.appendChild(
        svgNode(
          "text",
          {
            x: margin.left - 8,
            y: y + 4,
            "text-anchor": "end",
            fill: "var(--muted)",
            "font-size": 11,
            "font-family": "Trebuchet MS, sans-serif",
          },
          formatMetricValue(value)
        )
      );
    }

    const xTicks = buildXTicks(xType, minX, maxX);
    xTicks.forEach((tick) => {
      const x = xScale(tick.value);
      layer.appendChild(
        svgNode("line", {
          x1: x,
          y1: margin.top,
          x2: x,
          y2: height - margin.bottom,
          stroke: "var(--border-soft)",
          "stroke-width": 1,
        })
      );

      layer.appendChild(
        svgNode(
          "text",
          {
            x,
            y: height - 16,
            "text-anchor": "middle",
            fill: "var(--muted)",
            "font-size": 11,
            "font-family": "Trebuchet MS, sans-serif",
          },
          tick.label
        )
      );
    });

    svg.appendChild(layer);
  }

  function buildXTicks(xType, minX, maxX) {
    if (xType === "date") {
      const ticks = [];
      let cursor = startOfMonth(new Date(minX));
      const end = endOfMonth(new Date(maxX));

      while (cursor.getTime() <= end.getTime()) {
        ticks.push({
          value: cursor.getTime(),
          label:
            cursor.getUTCMonth() === 0
              ? `${monthShort(cursor)} ${cursor.getUTCFullYear()}`
              : monthShort(cursor),
        });
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      }

      return ticks;
    }

    const step = Math.max(7, Math.ceil((maxX - minX) / 6 / 7) * 7);
    const ticks = [];
    for (let value = minX; value <= maxX; value += step) {
      ticks.push({ value, label: `${Math.round(value)}d` });
    }
    if (!ticks.length || ticks.at(-1).value !== maxX) {
      ticks.push({ value: maxX, label: `${Math.round(maxX)}d` });
    }
    return ticks;
  }

  function drawLineChartReleaseMarkers(svg, releasesToDraw, xScale, margin, height) {
    const layer = svgNode("g", {});

    releasesToDraw.forEach((release, index) => {
      const x = xScale(release.releaseDateObj.getTime());
      const y = margin.top + 14 + (index % 3) * 18;
      const color = vendorColor(release.vendor);

      layer.appendChild(
        svgNode("line", {
          x1: x,
          y1: margin.top,
          x2: x,
          y2: height - margin.bottom,
          stroke: color,
          "stroke-width": 1.2,
          "stroke-dasharray": "5 4",
          opacity: 0.55,
        })
      );

      layer.appendChild(
        svgNode(
          "text",
          {
            x: x + 5,
            y,
            fill: color,
            "font-size": 10.5,
            "font-family": "Trebuchet MS, sans-serif",
          },
          release.label
        )
      );
    });

    svg.appendChild(layer);
  }

  function buildStepPath(points, xScale, yScale, minX, maxX) {
    if (!points.length) {
      return "";
    }

    let path = `M ${xScale(minX)} ${yScale(0)}`;
    let current = 0;

    points.forEach((point) => {
      const x = xScale(point.x);
      path += ` L ${x} ${yScale(current)} L ${x} ${yScale(point.y)}`;
      current = point.y;
    });

    path += ` L ${xScale(maxX)} ${yScale(current)}`;
    return path;
  }

  function buildSeriesPointTitle(series, point, xType) {
    const xLabel =
      xType === "date"
        ? formatDate(new Date(point.x))
        : `${Math.round(point.x)} days after release`;
    return `${series.label}\n${xLabel}\nCumulative: ${formatMetricValue(point.y)}\nDelta: ${formatMetricValue(point.delta)}\n${point.primaryRecord ? buildTitle(point.primaryRecord) : ""}`;
  }

  function renderLegend(legendEl, seriesList) {
    legendEl.replaceChildren(
      ...seriesList.map((series) => {
        const item = document.createElement("div");
        item.className = "legend-item";
        item.innerHTML = `
          <span class="legend-swatch" style="color:${escapeHtml(series.color)}; border-top-color:${escapeHtml(series.color)}"></span>
          <span>${escapeHtml(series.label)}: ${escapeHtml(formatMetricValue(series.finalValue))}</span>
        `;
        return item;
      })
    );
  }

  function drawSelectedPointOverlay(
    svg,
    chartKey,
    series,
    point,
    xScale,
    yScale,
    minX,
    maxX,
    maxY,
    xType,
    margin,
    width,
    height
  ) {
    const layer = svgNode("g", {});
    const x = xScale(point.x);
    const y = yScale(point.y);

    layer.appendChild(
      svgNode("line", {
        x1: x,
        y1: margin.top,
        x2: x,
        y2: height - margin.bottom,
        stroke: "var(--muted)",
        "stroke-width": 1.25,
        "stroke-dasharray": "4 4",
      })
    );

    layer.appendChild(
      svgNode("line", {
        x1: margin.left,
        y1: y,
        x2: width - margin.right,
        y2: y,
        stroke: "var(--border)",
        "stroke-width": 1,
        "stroke-dasharray": "3 5",
      })
    );

    layer.appendChild(
      svgNode("circle", {
        cx: x,
        cy: y,
        r: 7,
        fill: series.color,
        stroke: "var(--ink)",
        "stroke-width": 2,
      })
    );

    const tooltipWidth = 228;
    const tooltipHeight = 76;
    const tooltipX = Math.min(Math.max(x + 12, margin.left + 4), width - margin.right - tooltipWidth);
    const tooltipY = Math.min(Math.max(y - tooltipHeight - 10, margin.top + 4), height - margin.bottom - tooltipHeight);

    layer.appendChild(
      svgNode("rect", {
        x: tooltipX,
        y: tooltipY,
        width: tooltipWidth,
        height: tooltipHeight,
        rx: 14,
        fill: "var(--surface)",
        stroke: series.color,
        "stroke-width": 1.5,
      })
    );

    const title = chartKey === "calendar" ? "Selected milestone" : "Selected release milestone";
    const xLabel =
      xType === "date" ? formatDate(new Date(point.x)) : `${Math.round(point.x)} days after release`;

    [
      { y: tooltipY + 18, text: title, fill: "var(--muted)", size: 10.5 },
      { y: tooltipY + 36, text: series.label, fill: "var(--ink)", size: 12.5 },
      { y: tooltipY + 54, text: `${xLabel} | cumulative ${formatMetricValue(point.y)}`, fill: "var(--ink)", size: 11 },
      { y: tooltipY + 68, text: `delta ${formatMetricValue(point.delta)} across ${point.records.length} row(s)`, fill: "var(--muted)", size: 10.5 },
    ].forEach((line) => {
      layer.appendChild(
        svgNode(
          "text",
          {
            x: tooltipX + 12,
            y: line.y,
            fill: line.fill,
            "font-size": line.size,
            "font-family": "Trebuchet MS, sans-serif",
          },
          line.text
        )
      );
    });

    svg.appendChild(layer);
  }

  function formatMetricValue(value) {
    if (state.metric === "progress") {
      return Number(value).toFixed(value % 1 === 0 ? 0 : 1);
    }
    return String(Math.round(value));
  }

  function renderMilestoneTable(selected) {
    if (!selected) {
      dom.detailPanel.innerHTML = '<div class="empty-state">No milestone is selected.</div>';
      return;
    }

    const { chart, series, point } = selected;
    const milestoneLabel =
      chart === "calendar"
        ? formatDate(new Date(point.x))
        : `${Math.round(point.x)} days after release`;

    const summaryBits = [
      `${series.label}`,
      `${milestoneLabel}`,
      `cumulative ${formatMetricValue(point.y)}`,
      `delta ${formatMetricValue(point.delta)}`,
    ];

    const rows = [...point.records].sort((left, right) => left.startMs - right.startMs || left.problemText.localeCompare(right.problemText));
    const tableRows = rows
      .map((record) => {
        const problemLinks = record.problemLinks.length
          ? record.problemLinks
              .map(
                (link) =>
                  `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">#${escapeHtml(link.label)}</a>`
              )
              .join(", ")
          : escapeHtml(record.problemText);

        const matched = record.matchedReleases.length
          ? record.matchedReleases
              .map((match) =>
                escapeHtml(
                  `${match.label}${match.inferenceType ? ` (${match.inferenceType})` : ""}`
                )
              )
              .join(", ")
          : "None";

        return `
          <tr>
            <td>${escapeHtml(record.dateRaw)}</td>
            <td>${problemLinks}</td>
            <td>${escapeHtml(record.aiSystemsLabel || "")}</td>
            <td>${escapeHtml(record.descriptionLabel || record.subsection)}</td>
            <td>${matched}</td>
          </tr>
        `;
      })
      .join("");

    dom.detailPanel.innerHTML = `
      <div class="detail-block">
        <p class="detail-key">Selected point</p>
        <p class="detail-value">${escapeHtml(summaryBits.join(" | "))}</p>
      </div>

      <div class="detail-block">
        <p class="detail-key">Contribution set</p>
        <p class="detail-value">
          ${escapeHtml(point.records.length.toString())} contributing row(s)
          ${
            point.release
              ? `<br />Anchor release: ${escapeHtml(point.release.label)} on ${escapeHtml(point.release.releaseDate)}`
              : ""
          }
        </p>
      </div>

      <div class="milestone-table-wrap">
        <table class="milestone-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Problem</th>
              <th>AI systems</th>
              <th>Outcome / note</th>
              <th>Matched releases</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderReleaseList(filtered) {
    const counts = buildReleaseCounts(filtered);
    const releasesToShow = getModelPickerReleases(filtered, counts);

    if (!releasesToShow.length) {
      dom.releaseList.innerHTML =
        '<div class="empty-state">No release entries match the current model picker search.</div>';
      return;
    }

    dom.releaseList.replaceChildren(
      ...releasesToShow.map((release) => {
        const card = document.createElement("article");
        card.className = `release-card ${VENDOR_CLASSES[release.vendor] || ""}`;
        if (state.modelId === release.id) {
          card.classList.add("is-selected");
        }

        card.innerHTML = `
          <div class="release-topline">
            <strong>${escapeHtml(release.label)}</strong>
            <span class="release-badge">${escapeHtml(release.vendor)}</span>
          </div>
          <p class="release-meta">${escapeHtml(release.releaseDate)} | ${escapeHtml(release.releaseType)}</p>
          <p class="release-meta">${
            release.sourceKind === "inferred"
              ? "Inferred from wiki evidence"
              : "Official source"
          }</p>
          ${
            release.publicDate
              ? `<p class="release-meta">Broader public date: ${escapeHtml(release.publicDate)}</p>`
              : ""
          }
          <p class="release-note">${escapeHtml(release.notes || "")}</p>
          ${
            release.inferredFrom
              ? `<p class="release-meta">Inferred from ${escapeHtml(release.inferredFrom.problem)} on ${escapeHtml(release.inferredFrom.dateRaw)}</p>`
              : ""
          }
          <p class="release-meta">Visible rows: ${counts.get(release.id) || 0}</p>
          <div class="release-links">
            <a href="${escapeHtml(release.sourceUrl)}" target="_blank" rel="noreferrer">source</a>
            ${
              release.secondarySourceUrl
                ? `<a href="${escapeHtml(release.secondarySourceUrl)}" target="_blank" rel="noreferrer">secondary source</a>`
                : ""
            }
          </div>
        `;

        card.addEventListener("click", () => {
          setModelFocus(release.id, { toggle: true });
        });

        return card;
      })
    );
  }

  function renderContributionTable(filtered) {
    const sorted = sortContributionRows(filtered);
    syncTableSortHeaders();
    dom.tableSummary.textContent = `${sorted.length} row(s) shown | sorted by ${formatTableSortLabel()}`;

    if (!sorted.length) {
      dom.tableBody.innerHTML =
        '<tr><td colspan="7" class="empty-state">No rows match the current filters.</td></tr>';
      return;
    }

    dom.tableBody.innerHTML = sorted
      .map((record) => {
        const problemLinks = record.problemLinks.length
          ? record.problemLinks
              .map(
                (link) =>
                  `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">#${escapeHtml(link.label)}</a>`
              )
              .join(", ")
          : escapeHtml(record.problemText);
        const anchor = getAnchorReleaseMatch(record);
        const releaseText = anchor
          ? `${anchor.label} (${formatDays(anchor.lagDays)})`
          : "None";

        return `
          <tr>
            <td>${problemLinks}</td>
            <td>${escapeHtml(record.dateRaw || "")}</td>
            <td>${escapeHtml(record.aiSystemsLabel || "")}</td>
            <td>${buildOutcomeBadge(record.outcomeKind)}</td>
            <td>${escapeHtml(record.sectionShort || record.subsection)}</td>
            <td>${escapeHtml(releaseText)}</td>
            <td class="table-note">${escapeHtml(record.descriptionLabel || record.subsection || "")}</td>
          </tr>
        `;
      })
      .join("");
  }

  function syncTableSortHeaders() {
    dom.dataTable.querySelectorAll("th[data-col]").forEach((header) => {
      const isActive = header.dataset.col === state.tableSort.column;
      header.classList.toggle("is-active", isActive);
      if (isActive) {
        const arrow = state.tableSort.direction === "asc" ? "↑" : "↓";
        header.dataset.dir = arrow;
        header.setAttribute("data-dir", arrow);
      } else {
        delete header.dataset.dir;
        if (typeof header.removeAttribute === "function") {
          header.removeAttribute("data-dir");
        }
      }
    });
  }

  function sortContributionRows(filtered) {
    const direction = state.tableSort.direction === "asc" ? 1 : -1;
    const column = state.tableSort.column;

    return [...filtered].sort((left, right) => {
      const leftValue = getContributionSortValue(left, column);
      const rightValue = getContributionSortValue(right, column);

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        if (leftValue !== rightValue) {
          return (leftValue - rightValue) * direction;
        }
      } else {
        const compare = String(leftValue).localeCompare(String(rightValue), undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (compare) {
          return compare * direction;
        }
      }

      return right.startMs - left.startMs || left.problemText.localeCompare(right.problemText);
    });
  }

  function getContributionSortValue(record, column) {
    switch (column) {
      case "problem":
        return record.problemText;
      case "date":
        return record.startMs;
      case "model":
        return record.aiSystemsLabel || "";
      case "outcome":
        return outcomeSortRank(record.outcomeKind);
      case "section":
        return record.sectionShort || record.subsection;
      case "release": {
        const anchor = getAnchorReleaseMatch(record);
        return anchor ? `${anchor.label}:${anchor.lagDays}` : "zzzz";
      }
      case "note":
        return record.descriptionLabel || record.subsection || "";
      default:
        return record.startMs;
    }
  }

  function formatTableSortLabel() {
    const labels = {
      problem: "problem",
      date: "date",
      model: "AI model",
      outcome: "outcome",
      section: "section",
      release: "closest release",
      note: "note",
    };
    const direction = state.tableSort.direction === "asc" ? "ascending" : "descending";
    return `${labels[state.tableSort.column] || state.tableSort.column}, ${direction}`;
  }

  function buildOutcomeBadge(outcomeKind) {
    const label = {
      full: "Full",
      partial: "Partial",
      incorrect: "Incorrect",
      neutral: "Other",
    }[outcomeKind] || "Other";
    const className = outcomeKind === "neutral" ? "other" : outcomeKind;
    return `<span class="badge ${escapeHtml(className)}">${escapeHtml(label)}</span>`;
  }

  function outcomeSortRank(outcomeKind) {
    switch (outcomeKind) {
      case "full":
        return 0;
      case "partial":
        return 1;
      case "incorrect":
        return 2;
      case "neutral":
      default:
        return 3;
    }
  }

  function getVisibleReleases(filtered) {
    if (state.modelId !== "all") {
      const release = releaseById.get(state.modelId);
      return release ? [release] : [];
    }

    const ids = new Set();
    filtered.forEach((record) => {
      record.matchedReleases.forEach((match) => ids.add(match.id));
    });

    return releases.filter((release) => ids.has(release.id));
  }

  function getLagPoints(filtered) {
    if (state.modelId !== "all") {
      return filtered
        .flatMap((record) =>
          record.matchedReleases
            .filter((match) => match.id === state.modelId && match.lagDays !== null && match.lagDays >= 0)
            .map((match) => ({ record, lagDays: match.lagDays, release: match }))
        )
        .sort((left, right) => left.lagDays - right.lagDays);
    }

    return filtered
      .map((record) => {
        const viable = record.matchedReleases
          .filter((match) => match.lagDays !== null && match.lagDays >= 0)
          .sort((left, right) => left.lagDays - right.lagDays);
        return viable[0] ? { record, lagDays: viable[0].lagDays, release: viable[0] } : null;
      })
      .filter(Boolean)
      .sort((left, right) => left.lagDays - right.lagDays);
  }

  function enhanceRecord(record) {
    const dateInfo = parseDateInfo(record.dateRaw);
    const section = sectionByAnchor.get(record.subsectionAnchor);
    const kind = record.majorAnchor === "sect-1" ? "primary" : "secondary";
    const outcomeKind = classifyOutcome(record);
    const proofInfo = classifyNovelProofContribution(record, outcomeKind);
    const matchedReleases = matchReleases(
      record.aiSystemsLabel,
      dateInfo.valid ? dateInfo.start : null
    );
    const problemText =
      record.problemIds.length > 0
        ? record.problemIds.map((problemId) => `#${problemId}`).join(", ")
        : record.problemLabel || "Unknown problem";
    const searchText = [
      record.problemLabel,
      record.aiSystemsLabel,
      record.humansLabel,
      record.descriptionLabel,
      ...Object.values(record.fieldsPlain),
      problemText,
      section?.title || "",
    ]
      .join(" ")
      .toLowerCase();

    return {
      ...record,
      sectionShort: section?.shortLabel || record.subsection,
      kind,
      outcomeKind,
      isNovelProofContribution: proofInfo.included,
      novelProofKind: proofInfo.kind,
      novelProofLabel: proofInfo.kind ? PROOF_BREAKDOWN_LABELS[proofInfo.kind] : "",
      progressCredit: getProgressCredit(outcomeKind),
      hasValidDate: dateInfo.valid,
      dateInfo,
      startMs: dateInfo.start.getTime(),
      endMs: dateInfo.end.getTime(),
      problemText,
      matchedReleases,
      searchText,
    };
  }

  function matchReleases(aiText, eventDate) {
    const matches = [];
    const seen = new Set();
    const text = aiText || "";

    function addMatch(release) {
      if (!release || seen.has(release.id)) {
        return;
      }
      seen.add(release.id);
      matches.push({
        ...release,
        lagDays: eventDate ? diffDays(eventDate, release.releaseDateObj) : null,
      });
    }

    releases.forEach((release) => {
      if (release.regexes.some((regex) => regex.test(text))) {
        addMatch(release);
      }
    });

    if (/\bClaude Opus\b/i.test(text) && !/\bClaude Opus 4\.[56]\b/i.test(text)) {
      addMatch(selectFamilyRelease("claude-opus", eventDate));
    }

    if (/\bClaude Sonnet\b/i.test(text) && !/\bClaude Sonnet 4\.[56]\b/i.test(text)) {
      addMatch(selectFamilyRelease("claude-sonnet", eventDate));
    }

    if (
      /\bGemini Pro\b/i.test(text) &&
      !/\bGemini 3(?!\.1)\b/i.test(text) &&
      !/\bGemini 3\.1\b/i.test(text)
    ) {
      addMatch(selectFamilyRelease("gemini-pro", eventDate));
    }

    if (/\bGemini Flash\b/i.test(text) && !/\bGemini 3\b/i.test(text)) {
      addMatch(selectFamilyRelease("gemini-pro", eventDate));
    }

    return matches.sort((left, right) => left.releaseDate.localeCompare(right.releaseDate));
  }

  function classifyNovelProofContribution(record, outcomeKind) {
    const positive = outcomeKind === "full" || outcomeKind === "partial";

    if (!positive) {
      return { included: false, kind: null };
    }

    switch (record.subsectionAnchor) {
      case "sect-1a":
        return {
          included: true,
          kind: outcomeKind === "full" ? "autonomous" : "other",
        };
      case "sect-1b":
      case "sect-1c":
        return {
          included: true,
          kind: "improvement",
        };
      case "sect-1d":
        return {
          included: true,
          kind: "other",
        };
      default:
        return { included: false, kind: null };
    }
  }

  function selectFamilyRelease(family, eventDate) {
    const familyReleases = releasesByFamily.get(family) || [];
    if (!familyReleases.length) {
      return null;
    }

    const eventMs = eventDate ? eventDate.getTime() : Number.POSITIVE_INFINITY;
    const viable = familyReleases.filter((release) => release.releaseDateObj.getTime() <= eventMs);
    return viable.at(-1) || familyReleases[0];
  }

  function classifyOutcome(record) {
    const text = [
      record.descriptionLabel,
      record.fieldsPlain.Outcome,
      record.fieldsPlain.Result,
      record.fieldsPlain.Computation,
      record.fieldsPlain.Artifacts,
      record.fieldsPlain["Proof to be formalized"],
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (/🔴|incorrect|major gaps|wrong reference|wrong references/.test(text)) {
      return "incorrect";
    }

    if (
      /🟢|full solution|full solution found|new proof found|proof found|solution to stronger problem|counterexample to one part|optimal construction found numerically/.test(
        text
      )
    ) {
      return "full";
    }

    if (
      /🟡|partial|variant problem|related result|improved|cheap|reduction|initial exploration|code generation|computational|oeis|formalized/.test(
        text
      )
    ) {
      return "partial";
    }

    return "neutral";
  }

  function parseDateInfo(raw) {
    if (!raw) {
      return fallbackDateInfo();
    }

    const cleaned = raw
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u00a0/g, " ")
      .replace(/\(([^)]*)\)/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const ranges = [];
    let scrubbed = cleaned;

    const patterns = [
      {
        regex:
          /(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})\s*-\s*(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})/g,
        build(groups) {
          return {
            start: makeDate(groups[2], groups[1], groups[0]),
            end: makeDate(groups[5], groups[4], groups[3]),
          };
        },
      },
      {
        regex:
          /(\d{1,2})\s+([A-Za-z]+)\s*-\s*(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})/g,
        build(groups) {
          return {
            start: makeDate(groups[4], groups[1], groups[0]),
            end: makeDate(groups[4], groups[3], groups[2]),
          };
        },
      },
      {
        regex: /(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})/g,
        build(groups) {
          return {
            start: makeDate(groups[3], groups[2], groups[0]),
            end: makeDate(groups[3], groups[2], groups[1]),
          };
        },
      },
      {
        regex: /([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),\s*(\d{4})/g,
        build(groups) {
          return {
            start: makeDate(groups[3], groups[0], groups[1]),
            end: makeDate(groups[3], groups[0], groups[2]),
          };
        },
      },
    ];

    patterns.forEach((pattern) => {
      scrubbed = scrubbed.replace(pattern.regex, (...args) => {
        const groups = args.slice(1, -2);
        ranges.push(pattern.build(groups));
        return " ";
      });
    });

    const singles = [];
    const singlePatterns = [
      /(\d{1,2}\s+[A-Za-z]+,\s*\d{4})/g,
      /([A-Za-z]+\s+\d{1,2},\s*\d{4})/g,
      /([A-Za-z]+\s+\d{4})/g,
      /(\b\d{4}\b)/g,
    ];

    singlePatterns.forEach((pattern) => {
      for (const match of scrubbed.matchAll(pattern)) {
        const value = parseSingleDate(match[1]);
        if (value) {
          singles.push(value);
        }
      }
      scrubbed = scrubbed.replace(pattern, " ");
    });

    const allDates = [
      ...ranges.map((range) => range.start),
      ...ranges.map((range) => range.end),
      ...singles.map((entry) => entry.start),
      ...singles.map((entry) => entry.end),
    ].filter(Boolean);

    if (!allDates.length) {
      return fallbackDateInfo();
    }

    const start = new Date(Math.min(...allDates.map((date) => date.getTime())));
    const end = new Date(Math.max(...allDates.map((date) => date.getTime())));
    return { start, end, raw, valid: true };
  }

  function parseSingleDate(token) {
    let match = token.match(/^(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})$/);
    if (match) {
      const date = makeDate(match[3], match[2], match[1]);
      return { start: date, end: date };
    }

    match = token.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
    if (match) {
      const date = makeDate(match[3], match[1], match[2]);
      return { start: date, end: date };
    }

    match = token.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (match) {
      const date = makeDate(match[2], match[1], 1);
      const end = new Date(Date.UTC(Number(match[2]), monthIndex(match[1]) + 1, 0));
      return { start: date, end };
    }

    match = token.match(/^(\d{4})$/);
    if (match) {
      const start = new Date(Date.UTC(Number(match[1]), 0, 1));
      const end = new Date(Date.UTC(Number(match[1]), 11, 31));
      return { start, end };
    }

    return null;
  }

  function fallbackDateInfo() {
    const date = new Date(Date.UTC(1970, 0, 1));
    return { start: date, end: date, raw: "", valid: false };
  }

  function makeDate(year, month, day) {
    return new Date(Date.UTC(Number(year), monthIndex(month), Number(day)));
  }

  function monthIndex(month) {
    return MONTHS[String(month).slice(0, 3).toLowerCase()] ?? 0;
  }

  function diffDays(later, earlier) {
    return Math.round((later.getTime() - earlier.getTime()) / DAY_MS);
  }

  function getProgressCredit(outcomeKind) {
    if (outcomeKind === "full") {
      return 1;
    }
    if (outcomeKind === "partial") {
      return 0.5;
    }
    return 0;
  }

  function median(values) {
    if (!values.length) {
      return 0;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function startOfMonth(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  function endOfMonth(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  }

  function formatDate(date) {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  function formatDateTime(date) {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }

  function formatDays(value) {
    if (value === null || value === undefined) {
      return "n/a";
    }
    if (value < 0) {
      return `${Math.abs(value)}d before release`;
    }
    return `${Math.round(value)}d`;
  }

  function monthShort(date) {
    return date.toLocaleDateString(undefined, {
      month: "short",
      timeZone: "UTC",
    });
  }

  function startOfDayUtc(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  function getSectionShortLabel(title) {
    const match = title.match(/^(\d\([a-z]\))/i);
    return match ? match[1] : title;
  }

  function hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(index);
      hash |= 0;
    }
    return hash;
  }

  function buildTitle(record) {
    return `${record.problemText}\n${record.aiSystemsLabel || "Unknown system"}\n${record.dateRaw}\n${record.descriptionLabel || record.subsection}`;
  }

  function renderDonutChart({ svg, items, emptyMessage, centerValue, centerLabel }) {
    svg.replaceChildren();

    if (!items.length) {
      renderEmptySvg(svg, emptyMessage);
      return;
    }

    const width = Math.max(svg.parentElement.clientWidth, 280);
    const height = 280;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.24;
    const strokeWidth = Math.max(24, radius * 0.42);
    const circumference = 2 * Math.PI * radius;
    const total = items.reduce((sum, item) => sum + item.value, 0);
    let offset = 0;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", String(height));

    svg.appendChild(
      svgNode("circle", {
        cx,
        cy,
        r: radius,
        fill: "none",
        stroke: "var(--border)",
        "stroke-width": strokeWidth,
      })
    );

    items.forEach((item) => {
      const dash = total > 0 ? (item.value / total) * circumference : 0;
      svg.appendChild(
        svgNode(
          "circle",
          {
            cx,
            cy,
            r: radius,
            fill: "none",
            stroke: item.color,
            "stroke-width": strokeWidth,
            "stroke-dasharray": `${dash} ${Math.max(circumference - dash, 0.001)}`,
            "stroke-dashoffset": String(-offset),
            transform: `rotate(-90 ${cx} ${cy})`,
          },
          null,
          `${item.label}: ${item.value}`
        )
      );
      offset += dash;
    });

    svg.appendChild(
      svgNode(
        "text",
        {
          x: cx,
          y: cy - 4,
          "text-anchor": "middle",
          fill: "var(--ink)",
          "font-size": 28,
          "font-weight": 700,
          "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        centerValue
      )
    );

    svg.appendChild(
      svgNode(
        "text",
        {
          x: cx,
          y: cy + 18,
          "text-anchor": "middle",
          fill: "var(--muted)",
          "font-size": 12,
          "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        centerLabel
      )
    );
  }

  function renderHorizontalBarChart({ svg, items, emptyMessage }) {
    svg.replaceChildren();

    if (!items.length) {
      renderEmptySvg(svg, emptyMessage);
      return;
    }

    const width = Math.max(svg.parentElement.clientWidth, 340);
    const labelWidth = Math.min(160, Math.max(116, width * 0.28));
    const barLeft = labelWidth + 18;
    const barRight = width - 52;
    const barWidth = Math.max(120, barRight - barLeft);
    const rowHeight = 34;
    const height = items.length * rowHeight + 54;
    const maxValue = Math.max(...items.map((item) => item.value), 1);

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", String(height));

    [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => {
      const x = barLeft + barWidth * ratio;
      svg.appendChild(
        svgNode("line", {
          x1: x,
          y1: 16,
          x2: x,
          y2: height - 18,
          stroke: "var(--border-soft)",
          "stroke-width": 1,
        })
      );
    });

    items.forEach((item, index) => {
      const y = 24 + index * rowHeight;
      const widthValue = (item.value / maxValue) * barWidth;

      svg.appendChild(
        svgNode(
          "text",
          {
            x: 12,
            y: y + 14,
            fill: "var(--ink)",
            "font-size": 12,
            "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          },
          truncateLabel(item.label, 22),
          item.label
        )
      );

      svg.appendChild(
        svgNode("rect", {
          x: barLeft,
          y,
          width: barWidth,
          height: 14,
          rx: 7,
          fill: "var(--surface-strong)",
        })
      );

      svg.appendChild(
        svgNode(
          "rect",
          {
            x: barLeft,
            y,
            width: Math.max(widthValue, 2),
            height: 14,
            rx: 7,
            fill: item.color,
          },
          null,
          `${item.label}: ${item.value}`
        )
      );

      svg.appendChild(
        svgNode(
          "text",
          {
            x: width - 12,
            y: y + 12,
            "text-anchor": "end",
            fill: "var(--muted)",
            "font-size": 12,
            "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          },
          String(item.value)
        )
      );
    });
  }

  function renderStackedBarChart({ svg, items, segments, emptyMessage }) {
    svg.replaceChildren();

    if (!items.length) {
      renderEmptySvg(svg, emptyMessage);
      return;
    }

    const width = Math.max(svg.parentElement.clientWidth, 340);
    const labelWidth = Math.min(164, Math.max(118, width * 0.3));
    const barLeft = labelWidth + 18;
    const barRight = width - 52;
    const barWidth = Math.max(120, barRight - barLeft);
    const rowHeight = 34;
    const height = items.length * rowHeight + 54;
    const maxValue = Math.max(...items.map((item) => item.totalValue), 1);

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", String(height));

    [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => {
      const x = barLeft + barWidth * ratio;
      svg.appendChild(
        svgNode("line", {
          x1: x,
          y1: 16,
          x2: x,
          y2: height - 18,
          stroke: "var(--border-soft)",
          "stroke-width": 1,
        })
      );
    });

    items.forEach((item, index) => {
      const y = 24 + index * rowHeight;
      let cursor = barLeft;

      svg.appendChild(
        svgNode(
          "text",
          {
            x: 12,
            y: y + 14,
            fill: "var(--ink)",
            "font-size": 12,
            "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          },
          truncateLabel(item.label, 20),
          item.label
        )
      );

      svg.appendChild(
        svgNode("rect", {
          x: barLeft,
          y,
          width: barWidth,
          height: 14,
          rx: 7,
          fill: "var(--surface-strong)",
        })
      );

      segments.forEach((segment, segmentIndex) => {
        const value = item[segment.key] || 0;
        if (!value) {
          return;
        }

        const segmentWidth = (value / maxValue) * barWidth;
        svg.appendChild(
          svgNode(
            "rect",
            {
              x: cursor,
              y,
              width: Math.max(segmentWidth, 2),
              height: 14,
              rx: segmentIndex === 0 ? 7 : 0,
              fill: segment.color,
            },
            null,
            `${item.label}: ${segment.label} ${value}`
          )
        );
        cursor += segmentWidth;
      });

      svg.appendChild(
        svgNode(
          "text",
          {
            x: width - 12,
            y: y + 12,
            "text-anchor": "end",
            fill: "var(--muted)",
            "font-size": 12,
            "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          },
          String(item.totalValue)
        )
      );
    });
  }

  function formatFamilyName(family) {
    const explicit = {
      "openai-internal-model": "OpenAI internal model",
      "claude-opus": "Claude Opus",
      "claude-sonnet": "Claude Sonnet",
      "gemini-pro": "Gemini Pro",
    };

    if (explicit[family]) {
      return explicit[family];
    }

    return String(family)
      .split("-")
      .map((part) => {
        if (/^gpt$/i.test(part)) {
          return "GPT";
        }
        if (/^ai$/i.test(part)) {
          return "AI";
        }
        if (/^xai$/i.test(part)) {
          return "xAI";
        }
        if (/^o\d+$/i.test(part)) {
          return part.toUpperCase();
        }
        if (/^\d+(\.\d+)?$/.test(part)) {
          return part;
        }
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  function truncateLabel(value, maxLength) {
    if (String(value).length <= maxLength) {
      return value;
    }
    return `${String(value).slice(0, Math.max(1, maxLength - 3))}...`;
  }

  function renderEmptySvg(svg, message) {
    const width = Math.max(svg.parentElement.clientWidth, 280);
    const height = 180;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", String(height));
    svg.appendChild(
      svgNode("text", {
        x: width / 2,
        y: height / 2,
        "text-anchor": "middle",
        fill: "var(--muted)",
        "font-size": 14,
        "font-family": "Trebuchet MS, sans-serif",
      }, message)
    );
  }

  function svgNode(name, attributes, textContent, titleText) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes || {}).forEach(([key, value]) => {
      node.setAttribute(key, String(value));
    });

    if (textContent !== undefined && textContent !== null) {
      node.textContent = textContent;
    }

    if (titleText) {
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = titleText;
      node.appendChild(title);
    }

    return node;
  }

  function vendorColor(vendor) {
    switch (vendor) {
      case "OpenAI":
        return "var(--accent-openai)";
      case "Anthropic":
        return "var(--accent-anthropic)";
      case "Google":
        return "var(--accent-google)";
      case "Google DeepMind":
        return "var(--accent-deepmind)";
      case "ByteDance Seed":
        return "var(--accent-bytedance)";
      case "DeepSeek":
        return "var(--accent-deepseek)";
      case "xAI":
        return "var(--accent-xai)";
      case "Inferred":
        return "var(--accent-inferred)";
      default:
        return "var(--ink)";
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
})();
