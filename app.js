(function () {
  const data = window.ERDOS_AI_DATA;

  if (!data) {
    document.body.innerHTML =
      '<main class="app-shell"><section class="panel">Missing app-data.js. Run node build-data.mjs first.</section></main>';
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
    full: "Full",
    partial: "Partial",
    incorrect: "Incorrect",
    neutral: "Other",
  };

  const OUTCOME_COLORS = {
    full: "#35c66b",
    partial: "#f2b33d",
    incorrect: "#f05d55",
    neutral: "#96a4b8",
  };

  const SVG_THEME = {
    line: "#35c66b",
    lineFill: "rgba(53, 198, 107, 0.13)",
    selectedStroke: "#f6f9ff",
    pointStroke: "#111922",
    grid: "var(--chart-grid)",
    gridSoft: "var(--chart-grid-soft)",
    track: "var(--chart-track)",
    text: "var(--chart-text)",
    muted: "var(--chart-muted)",
  };

  const CATEGORY_LABELS = {
    "sect-1a": "Open problem, autonomous AI",
    "sect-1b": "Previously solved, literature-assisted",
    "sect-1c": "Improved existing proof",
    "sect-1d": "Human-AI collaboration",
    "sect-2a": "Literature search",
    "sect-2b": "Formalization",
    "sect-2c": "Artifact generation",
    "sect-2d": "Rewriting",
    "sect-2e": "Computation",
    "sect-3": "Pending assessment",
  };

  const CATEGORY_COLORS = {
    "sect-1a": "#35c66b",
    "sect-1b": "#f2b33d",
    "sect-1c": "#5aa2ff",
    "sect-1d": "#a986ff",
    "sect-2a": "#96a4b8",
    "sect-2b": "#6f7c8f",
    "sect-2c": "#2dd4bf",
    "sect-2d": "#fb923c",
    "sect-2e": "#f97316",
    "sect-3": "#64748b",
  };

  const TABLE_COLUMNS = [
    { key: "problem", label: "Problem", defaultVisible: true },
    { key: "date", label: "Solved date", defaultVisible: true },
    { key: "effectiveDate", label: "Effectively solvable date", defaultVisible: true },
    { key: "model", label: "Model", defaultVisible: true },
    { key: "outcome", label: "Outcome", defaultVisible: true },
    { key: "category", label: "Category", defaultVisible: true },
    { key: "section", label: "Section", defaultVisible: false },
    { key: "note", label: "Note", defaultVisible: true },
  ];

  const dom = {
    sourceLine: document.getElementById("source-line"),
    problemSetSelect: document.getElementById("problem-set-select"),
    dateModeToggle: document.getElementById("date-mode-toggle"),
    modelGroupSelect: document.getElementById("model-group-select"),
    searchInput: document.getElementById("search-input"),
    advancedGrid: document.getElementById("advanced-filter-grid"),
    resetFilters: document.getElementById("reset-filters"),
    statsGrid: document.getElementById("stats-grid"),
    timeline: document.getElementById("timeline-chart"),
    timelineSubhead: document.getElementById("timeline-subhead"),
    timelineLegend: document.getElementById("timeline-legend"),
    chartTooltip: document.getElementById("chart-tooltip"),
    modelFamilyChart: document.getElementById("model-family-chart"),
    modelFamilySubhead: document.getElementById("model-family-subhead"),
    modelFamilyLegend: document.getElementById("model-family-legend"),
    categoryChart: document.getElementById("category-chart"),
    categorySubhead: document.getElementById("category-subhead"),
    categoryLegend: document.getElementById("category-legend"),
    tableSummary: document.getElementById("table-summary"),
    tableFilterInput: document.getElementById("table-filter-input"),
    columnControls: document.getElementById("column-controls"),
    clearSelection: document.getElementById("clear-selection"),
    selectionSummary: document.getElementById("selection-summary"),
    dataTable: document.getElementById("data-table"),
    tableHeadRow: document.getElementById("table-head-row"),
    tableBody: document.getElementById("table-body"),
  };

  const releases = data.releases
    .map((release) => ({
      ...release,
      regexes: (release.patterns || []).map((pattern) => new RegExp(pattern, "i")),
      releaseDateObj: new Date(`${release.releaseDate}T00:00:00Z`),
      searchText: [
        release.label,
        release.vendor,
        release.family,
        release.releaseType,
        release.sourceKind,
        release.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    }))
    .sort((left, right) => left.releaseDate.localeCompare(right.releaseDate));

  const releasesByFamily = releases.reduce((map, release) => {
    if (!map.has(release.family)) {
      map.set(release.family, []);
    }
    map.get(release.family).push(release);
    return map;
  }, new Map());

  const records = data.records
    .map((record) => enhanceRecord(record))
    .sort((left, right) => left.startMs - right.startMs || left.problemText.localeCompare(right.problemText));

  const firstSeenBySystem = buildFirstSeenBySystem(records);
  records.forEach((record) => {
    record.effectiveDateInfo = buildEffectiveDateInfo(record);
  });

  const state = {
    problemSet: "autonomous-full",
    dateMode: "actual",
    modelGroup: "family",
    query: "",
    tableQuery: "",
    selectedRecords: null,
    selectedLabel: "",
    sort: { column: "date", direction: "asc" },
    visibleColumns: new Set(TABLE_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.key)),
    advancedPairs: new Set([
      "sect-1a:full",
      "sect-1b:full",
      "sect-1c:full",
      "sect-1d:full",
      "sect-1a:partial",
      "sect-1b:partial",
      "sect-1c:partial",
      "sect-1d:partial",
    ]),
  };

  init();

  function init() {
    renderSourceLine();
    renderAdvancedFilterGrid();
    renderColumnControls();
    bindEvents();
    bindTooltipDismissal();
    render();

    const observer = new ResizeObserver(() => renderChartsOnly());
    observer.observe(dom.timeline.parentElement);
    observer.observe(dom.modelFamilyChart.parentElement);
    observer.observe(dom.categoryChart.parentElement);
  }

  function bindEvents() {
    dom.problemSetSelect.addEventListener("change", (event) => {
      state.problemSet = event.target.value;
      clearSelection();
      render();
    });

    dom.dateModeToggle.addEventListener("click", () => {
      state.dateMode = state.dateMode === "actual" ? "effective" : "actual";
      clearSelection();
      render();
    });

    dom.modelGroupSelect.addEventListener("change", (event) => {
      state.modelGroup = event.target.value;
      clearSelection();
      render();
    });

    dom.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      clearSelection();
      render();
    });

    dom.tableFilterInput.addEventListener("input", (event) => {
      state.tableQuery = event.target.value.trim().toLowerCase();
      renderTable(getTableRecords(getVisibleRecords()));
    });

    dom.resetFilters.addEventListener("click", () => {
      state.problemSet = "autonomous-full";
      state.dateMode = "actual";
      state.modelGroup = "family";
      state.query = "";
      state.tableQuery = "";
      state.sort = { column: "date", direction: "asc" };
      state.visibleColumns = new Set(TABLE_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.key));
      state.advancedPairs = new Set([
        "sect-1a:full",
        "sect-1b:full",
        "sect-1c:full",
        "sect-1d:full",
        "sect-1a:partial",
        "sect-1b:partial",
        "sect-1c:partial",
        "sect-1d:partial",
      ]);
      clearSelection();

      dom.problemSetSelect.value = state.problemSet;
      dom.modelGroupSelect.value = state.modelGroup;
      dom.searchInput.value = "";
      dom.tableFilterInput.value = "";
      renderAdvancedFilterGrid();
      renderColumnControls();
      render();
    });

    dom.clearSelection.addEventListener("click", () => {
      clearSelection();
      render();
    });
  }

  function bindTooltipDismissal() {
    document.addEventListener("pointerdown", (event) => {
      if (isInteractiveChartTarget(event.target)) {
        return;
      }

      hideTooltip();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideTooltip();
      }
    });

    window.addEventListener("scroll", hideTooltip, { passive: true });
  }

  function isInteractiveChartTarget(target) {
    return target instanceof Element && Boolean(target.closest(".chart-point, .chart-segment"));
  }

  function render() {
    syncDateModeToggle();
    const visibleRecords = getVisibleRecords();
    const chartData = renderTimeline(visibleRecords);
    renderStats(visibleRecords, chartData);
    renderModelContributionChart(visibleRecords);
    renderCategoryChart(visibleRecords);
    renderTable(getTableRecords(visibleRecords));
  }

  function syncDateModeToggle() {
    const isEffectivelySolvable = state.dateMode === "effective";
    const label = isEffectivelySolvable ? "Switch to Solved date" : "Switch to Effectively Solvable Date";
    dom.dateModeToggle.textContent = label;
    dom.dateModeToggle.classList.toggle("is-active", isEffectivelySolvable);
    dom.dateModeToggle.setAttribute("aria-pressed", String(isEffectivelySolvable));
    dom.dateModeToggle.setAttribute("aria-label", `Date axis: ${label}`);
  }

  function renderChartsOnly() {
    const visibleRecords = getVisibleRecords();
    renderTimeline(visibleRecords);
    renderModelContributionChart(visibleRecords);
    renderCategoryChart(visibleRecords);
  }

  function renderSourceLine() {
    const generatedAt = new Date(data.metadata.generatedAt);
    dom.sourceLine.innerHTML = `
      <a href="${escapeHtml(data.metadata.wikiPageUrl)}" target="_blank" rel="noreferrer">
        Updated ${escapeHtml(formatDateTime(generatedAt))} from the Erdos wiki
      </a>
    `;
  }

  function renderAdvancedFilterGrid() {
    const sections = ["sect-1a", "sect-1b", "sect-1c", "sect-1d"];
    const outcomes = ["full", "partial"];

    dom.advancedGrid.replaceChildren(
      ...sections.flatMap((section) =>
        outcomes.map((outcome) => {
          const key = `${section}:${outcome}`;
          const label = document.createElement("label");
          label.className = "check-tile";
          label.innerHTML = `
            <input type="checkbox" ${state.advancedPairs.has(key) ? "checked" : ""} />
            <span>${escapeHtml(shortSectionLabel(section))} ${escapeHtml(OUTCOME_LABELS[outcome])}</span>
          `;
          label.querySelector("input").addEventListener("change", (event) => {
            if (event.target.checked) {
              state.advancedPairs.add(key);
            } else {
              state.advancedPairs.delete(key);
            }
            if (state.problemSet !== "advanced") {
              state.problemSet = "advanced";
              dom.problemSetSelect.value = "advanced";
            }
            clearSelection();
            render();
          });
          return label;
        })
      )
    );
  }

  function renderColumnControls() {
    dom.columnControls.replaceChildren(
      ...TABLE_COLUMNS.map((column) => {
        const label = document.createElement("label");
        label.className = "check-tile compact";
        label.innerHTML = `
          <input type="checkbox" ${state.visibleColumns.has(column.key) ? "checked" : ""} />
          <span>${escapeHtml(column.label)}</span>
        `;
        label.querySelector("input").addEventListener("change", (event) => {
          if (event.target.checked) {
            state.visibleColumns.add(column.key);
          } else {
            state.visibleColumns.delete(column.key);
          }
          renderTable(getTableRecords(getVisibleRecords()));
        });
        return label;
      })
    );
  }

  function getVisibleRecords() {
    const filtered = records.filter((record) => {
      if (!matchesProblemSet(record)) {
        return false;
      }

      if (state.query && !record.searchText.includes(state.query)) {
        return false;
      }

      if (state.dateMode === "actual" && !record.hasValidDate) {
        return false;
      }

      if (state.dateMode === "effective" && !record.effectiveDateInfo?.date) {
        return false;
      }

      return true;
    });

    return dedupeByProblem(filtered, state.problemSet === "partial" ? "positive" : "full");
  }

  function matchesProblemSet(record) {
    if (!["sect-1a", "sect-1b", "sect-1c", "sect-1d"].includes(record.subsectionAnchor)) {
      return false;
    }

    switch (state.problemSet) {
      case "autonomous-full":
        return record.subsectionAnchor === "sect-1a" && record.outcomeKind === "full";
      case "assisted-full":
        return isAssistedCompleteRecord(record);
      case "partial":
        return record.outcomeKind === "full" || record.outcomeKind === "partial";
      case "advanced":
        return state.advancedPairs.has(`${record.subsectionAnchor}:${record.outcomeKind}`);
      default:
        return false;
    }
  }

  function isAssistedCompleteRecord(record) {
    if (record.outcomeKind !== "full") {
      return false;
    }

    if (record.subsectionAnchor === "sect-1a" || record.subsectionAnchor === "sect-1d") {
      return true;
    }

    const text = [
      record.descriptionLabel,
      record.fieldsPlain.Literature,
      record.fieldsPlain.Outcome,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (record.subsectionAnchor === "sect-1b") {
      return /partial|building upon|variant|one part|stronger|lean/.test(text);
    }

    if (record.subsectionAnchor === "sect-1c") {
      return /new proof|proof found|full solution|stronger|upgraded|existing partial|derived explicit/.test(text);
    }

    return false;
  }

  function dedupeByProblem(list, mode) {
    const buckets = new Map();

    list.forEach((record) => {
      const keys = getProblemKeys(record);
      keys.forEach((key) => {
        if (!buckets.has(key)) {
          buckets.set(key, []);
        }
        buckets.get(key).push(record);
      });
    });

    return [...buckets.values()]
      .map((bucket) => selectRepresentativeRecord(bucket, mode))
      .filter(Boolean)
      .sort((left, right) => getChartDate(left) - getChartDate(right) || left.problemText.localeCompare(right.problemText));
  }

  function selectRepresentativeRecord(bucket, mode) {
    const ranked = [...bucket].sort((left, right) => {
      const outcomeRank = outcomeScore(right.outcomeKind) - outcomeScore(left.outcomeKind);
      if (mode === "full" && outcomeRank) {
        return outcomeRank;
      }
      const dateDiff = getChartDate(left) - getChartDate(right);
      if (dateDiff) {
        return dateDiff;
      }
      return left.problemText.localeCompare(right.problemText);
    });
    return ranked[0] || null;
  }

  function renderTimeline(visibleRecords) {
    const buckets = new Map();

    visibleRecords.forEach((record) => {
      const dateValue = getChartDate(record);
      if (!Number.isFinite(dateValue)) {
        return;
      }
      if (!buckets.has(dateValue)) {
        buckets.set(dateValue, []);
      }
      buckets.get(dateValue).push(record);
    });

    let cumulative = 0;
    const points = [...buckets.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([x, pointRecords]) => {
        cumulative += pointRecords.length;
        return {
          x,
          y: cumulative,
          delta: pointRecords.length,
          records: pointRecords,
        };
      });

    const estimatedCount = visibleRecords.filter((record) => record.effectiveDateInfo?.estimated).length;
    const dateModeText = state.dateMode === "effective" ? "effectively solvable date" : "solved date";
    dom.timelineSubhead.textContent = `${visibleRecords.length} unique problem(s), plotted by ${dateModeText}. ${
      state.dateMode === "effective" && estimatedCount
        ? `${estimatedCount} effectively solvable date(s) are estimates marked with *.`
        : ""
    }`;

    renderLineChart({
      svg: dom.timeline,
      legendEl: dom.timelineLegend,
      points,
      emptyMessage: "No matching problems.",
      label: currentProblemSetLabel(),
    });

    return { points };
  }

  function renderLineChart({ svg, legendEl, points, emptyMessage, label }) {
    svg.replaceChildren();
    legendEl.replaceChildren();

    if (!points.length) {
      renderEmptySvg(svg, emptyMessage, 260);
      return;
    }

    const width = getSvgWidth(svg, 320);
    const height = width < 700 ? 340 : 430;
    const margin = { top: 28, right: 28, bottom: 50, left: 54 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const minX = points[0].x;
    const maxX = points.at(-1).x === minX ? minX + DAY_MS : points.at(-1).x;
    const maxY = Math.max(1, points.at(-1).y);
    const color = SVG_THEME.line;

    const xScale = (value) => margin.left + ((value - minX) / (maxX - minX)) * plotWidth;
    const yScale = (value) => margin.top + plotHeight - (value / maxY) * plotHeight;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", String(height));

    drawGrid(svg, minX, maxX, maxY, xScale, yScale, width, height, margin);
    svg.appendChild(
      svgNode("path", {
        d: buildStepAreaPath(points, xScale, yScale, minX, maxX),
        fill: SVG_THEME.lineFill,
      })
    );
    svg.appendChild(
      svgNode("path", {
        d: buildStepPath(points, xScale, yScale, minX, maxX),
        fill: "none",
        stroke: color,
        "stroke-width": 3.5,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      })
    );

    points.forEach((point) => {
      const isSelected = state.selectedRecords === point.records;
      const circle = svgNode("circle", {
        cx: xScale(point.x),
        cy: yScale(point.y),
        r: isSelected ? 6 : 4,
        fill: color,
        stroke: isSelected ? SVG_THEME.selectedStroke : SVG_THEME.pointStroke,
        "stroke-width": isSelected ? 2.5 : 1.5,
        tabindex: 0,
      });
      circle.classList.add("chart-point");
      circle.addEventListener("mouseenter", (event) => showProblemTooltip(event, point.records, label, point));
      circle.addEventListener("mousemove", (event) => moveTooltip(event));
      circle.addEventListener("mouseleave", hideTooltip);
      circle.addEventListener("click", () => {
        state.selectedRecords = point.records;
        state.selectedLabel = `${formatDate(new Date(point.x))}: ${point.records.length} problem(s)`;
        renderTable(getTableRecords(getVisibleRecords()));
        renderSelectionSummary();
      });
      svg.appendChild(circle);
    });

    legendEl.appendChild(buildLegendItem(color, `${label}: ${points.at(-1).y}`));
  }

  function drawGrid(svg, minX, maxX, maxY, xScale, yScale, width, height, margin) {
    const yStep = Math.max(1, Math.ceil(maxY / 4));

    for (let yValue = 0; yValue <= maxY; yValue += yStep) {
      const y = yScale(yValue);
      svg.appendChild(svgNode("line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, stroke: SVG_THEME.grid }));
      svg.appendChild(
        svgNode("text", { x: margin.left - 10, y: y + 4, "text-anchor": "end", fill: SVG_THEME.muted, "font-size": 12 }, String(yValue))
      );
    }

    buildMonthTicks(minX, maxX, width).forEach((tick) => {
      const x = xScale(tick.value);
      svg.appendChild(svgNode("line", { x1: x, y1: margin.top, x2: x, y2: height - margin.bottom, stroke: SVG_THEME.gridSoft }));
      svg.appendChild(
        svgNode("text", { x, y: height - 18, "text-anchor": "middle", fill: SVG_THEME.muted, "font-size": width < 520 ? 11 : 12 }, tick.label)
      );
    });
  }

  function buildMonthTicks(minX, maxX, width) {
    const ticks = [];
    let cursor = new Date(minX);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
    const end = new Date(maxX);

    if (cursor.getTime() < minX) {
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }

    while (cursor <= end) {
      ticks.push({
        value: cursor.getTime(),
        date: new Date(cursor.getTime()),
      });
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }

    const selectedTicks = downsampleTicks(ticks, maxDateTicks(width));
    return selectedTicks.map((tick, index) => ({
      value: tick.value,
      label: formatMonthTick(tick.date, index, selectedTicks.length, minX, maxX),
    }));
  }

  function formatMonthTick(date, index, tickCount, minX, maxX) {
    const minDate = new Date(minX);
    const maxDate = new Date(maxX);
    const crossesYear = minDate.getUTCFullYear() !== maxDate.getUTCFullYear();
    const shouldShowYear =
      date.getUTCMonth() === 0 || (crossesYear && (tickCount <= 4 || index === 0 || index === tickCount - 1));

    return shouldShowYear ? `${monthShort(date)} ${date.getUTCFullYear()}` : monthShort(date);
  }

  function maxDateTicks(width) {
    if (width < 520) {
      return 3;
    }
    if (width < 760) {
      return 4;
    }
    if (width < 1040) {
      return 6;
    }
    return 8;
  }

  function downsampleTicks(ticks, maxTicks) {
    if (ticks.length <= maxTicks || maxTicks < 2) {
      return ticks;
    }

    const selectedIndexes = new Set();
    for (let index = 0; index < maxTicks; index += 1) {
      selectedIndexes.add(Math.round((index * (ticks.length - 1)) / (maxTicks - 1)));
    }

    return [...selectedIndexes].sort((left, right) => left - right).map((index) => ticks[index]);
  }

  function buildStepPath(points, xScale, yScale, minX, maxX) {
    let path = `M ${xScale(minX)} ${yScale(0)}`;
    let currentY = 0;

    points.forEach((point) => {
      const x = xScale(point.x);
      path += ` L ${x} ${yScale(currentY)} L ${x} ${yScale(point.y)}`;
      currentY = point.y;
    });

    path += ` L ${xScale(maxX)} ${yScale(currentY)}`;
    return path;
  }

  function buildStepAreaPath(points, xScale, yScale, minX, maxX) {
    const stepPath = buildStepPath(points, xScale, yScale, minX, maxX);
    return `${stepPath} L ${xScale(maxX)} ${yScale(0)} L ${xScale(minX)} ${yScale(0)} Z`;
  }

  function renderStats(visibleRecords, chartData) {
    const fullCount = visibleRecords.filter((record) => record.outcomeKind === "full").length;
    const partialCount = visibleRecords.filter((record) => record.outcomeKind === "partial").length;
    const estimatedCount = visibleRecords.filter((record) => record.effectiveDateInfo?.estimated).length;
    const latestPoint = chartData.points.at(-1);

    const stats = [
      { label: "Problems", value: visibleRecords.length, note: currentProblemSetLabel() },
      { label: "Full", value: fullCount, note: "Complete solution rows after dedupe" },
      { label: "Partial", value: partialCount, note: "Partial solution rows after dedupe" },
      {
        label: "Latest cumulative",
        value: latestPoint ? latestPoint.y : 0,
        note: latestPoint ? formatDate(new Date(latestPoint.x)) : "No data",
      },
      { label: "Estimated dates", value: estimatedCount, note: "Effectively solvable dates marked with *" },
    ];

    dom.statsGrid.replaceChildren(
      ...stats.map((stat) => {
        const item = document.createElement("article");
        item.className = "stat-item";
        item.innerHTML = `
          <span class="stat-label">${escapeHtml(stat.label)}</span>
          <strong>${escapeHtml(String(stat.value))}</strong>
          <span>${escapeHtml(stat.note)}</span>
        `;
        return item;
      })
    );
  }

  function renderModelContributionChart(visibleRecords) {
    const groups = buildModelGroups(visibleRecords).slice(0, 12);
    const modeLabel = state.modelGroup === "family" ? "family" : "model";

    dom.modelFamilySubhead.textContent = `${groups.length} ${modeLabel} group(s), stacked by outcome.`;
    renderStackedModelBars(dom.modelFamilyChart, groups);
    dom.modelFamilyLegend.replaceChildren(
      buildLegendItem(OUTCOME_COLORS.full, "Full"),
      buildLegendItem(OUTCOME_COLORS.partial, "Partial"),
      buildLegendItem(OUTCOME_COLORS.incorrect, "Incorrect"),
      buildLegendItem(OUTCOME_COLORS.neutral, "Other")
    );
  }

  function buildModelGroups(visibleRecords) {
    const groups = new Map();

    visibleRecords.forEach((record) => {
      const anchor = getAnchorReleaseMatch(record);
      const key =
        state.modelGroup === "family"
          ? anchor?.family || "unmatched"
          : anchor?.id || normalizeSystemName(record.aiSystemsLabel || "Unmatched");
      const label =
        state.modelGroup === "family"
          ? formatFamilyName(anchor?.family || firstSystemName(record) || "Unmatched")
          : anchor?.label || firstSystemName(record) || "Unmatched";
      const details = anchor
        ? `${anchor.vendor} | ${anchor.releaseDate} | ${anchor.sourceKind}`
        : "No curated release match";

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label,
          details,
          full: new Map(),
          partial: new Map(),
          incorrect: new Map(),
          neutral: new Map(),
        });
      }

      const bucket = groups.get(key)[record.outcomeKind] || groups.get(key).neutral;
      getProblemKeys(record).forEach((problemKey) => {
        if (!bucket.has(problemKey)) {
          bucket.set(problemKey, record);
        }
      });
    });

    return [...groups.values()]
      .map((group) => ({
        ...group,
        total: group.full.size + group.partial.size + group.incorrect.size + group.neutral.size,
      }))
      .filter((group) => group.total > 0)
      .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label));
  }

  function renderStackedModelBars(svg, groups) {
    svg.replaceChildren();

    if (!groups.length) {
      renderEmptySvg(svg, "No model groups.", 220);
      return;
    }

    const width = getSvgWidth(svg, 320);
    const compact = width < 620;
    const rowHeight = compact ? 36 : 42;
    const height = groups.length * rowHeight + 52;
    const labelWidth = Math.min(compact ? 165 : 280, Math.max(compact ? 128 : 160, width * (compact ? 0.32 : 0.25)));
    const barLeft = labelWidth + 24;
    const barWidth = Math.max(120, width - barLeft - 62);
    const maxTotal = Math.max(...groups.map((group) => group.total), 1);
    const segments = ["full", "partial", "incorrect", "neutral"];

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", String(height));

    groups.forEach((group, index) => {
      const y = 24 + index * rowHeight;
      let cursor = barLeft;

      const labelNode = svgNode(
        "text",
        { x: 14, y: y + 16, fill: SVG_THEME.text, "font-size": compact ? 11 : 12.5, "font-weight": 700 },
        truncateLabel(group.label, compact ? 18 : 34)
      );
      labelNode.addEventListener("mouseenter", (event) => showModelTooltip(event, group));
      labelNode.addEventListener("mousemove", moveTooltip);
      labelNode.addEventListener("mouseleave", hideTooltip);
      svg.appendChild(labelNode);

      svg.appendChild(svgNode("rect", { x: barLeft, y, width: barWidth, height: 18, rx: 9, fill: SVG_THEME.track }));

      segments.forEach((segment) => {
        const recordsInSegment = [...group[segment].values()];
        const value = recordsInSegment.length;
        if (!value) {
          return;
        }

        const segmentWidth = (value / maxTotal) * barWidth;
        const rect = svgNode("rect", {
          x: cursor,
          y,
          width: Math.max(segmentWidth, 2),
          height: 18,
          rx: 8,
          fill: OUTCOME_COLORS[segment],
          tabindex: 0,
        });
        rect.classList.add("chart-segment");
        rect.addEventListener("mouseenter", (event) =>
          showProblemTooltip(event, recordsInSegment, `${group.label} | ${OUTCOME_LABELS[segment]}`)
        );
        rect.addEventListener("mousemove", moveTooltip);
        rect.addEventListener("mouseleave", hideTooltip);
        rect.addEventListener("click", () => {
          state.selectedRecords = recordsInSegment;
          state.selectedLabel = `${group.label} | ${OUTCOME_LABELS[segment]}: ${value} problem(s)`;
          renderTable(getTableRecords(getVisibleRecords()));
          renderSelectionSummary();
        });
        svg.appendChild(rect);
        cursor += segmentWidth;
      });

      svg.appendChild(
        svgNode("text", { x: width - 16, y: y + 14, "text-anchor": "end", fill: SVG_THEME.muted, "font-size": 12 }, String(group.total))
      );
    });
  }

  function renderCategoryChart(visibleRecords) {
    const categories = new Map();

    visibleRecords.forEach((record) => {
      const key = record.subsectionAnchor;
      if (!categories.has(key)) {
        categories.set(key, {
          key,
          label: CATEGORY_LABELS[key] || record.subsection,
          color: CATEGORY_COLORS[key] || "#64748b",
          value: 0,
          records: [],
        });
      }
      const item = categories.get(key);
      item.value += 1;
      item.records.push(record);
    });

    const items = [...categories.values()].sort((left, right) => right.value - left.value);
    dom.categorySubhead.textContent = `${items.length} visible contribution categor${items.length === 1 ? "y" : "ies"}.`;

    renderDonutChart(dom.categoryChart, items, "No categories.");
    dom.categoryLegend.replaceChildren(
      ...items.map((item) => {
        const legend = buildLegendItem(item.color, `${item.label}: ${item.value}`);
        legend.addEventListener("click", () => {
          state.selectedRecords = item.records;
          state.selectedLabel = `${item.label}: ${item.value} problem(s)`;
          renderTable(getTableRecords(getVisibleRecords()));
          renderSelectionSummary();
        });
        return legend;
      })
    );
  }

  function renderDonutChart(svg, items, emptyMessage) {
    svg.replaceChildren();

    if (!items.length) {
      renderEmptySvg(svg, emptyMessage, 180);
      return;
    }

    const width = getSvgWidth(svg, 260);
    const height = width < 360 ? 240 : 290;
    const cx = width / 2;
    const cy = height / 2 - 8;
    const radius = width < 360 ? 64 : 82;
    const strokeWidth = width < 360 ? 28 : 34;
    const circumference = 2 * Math.PI * radius;
    const total = items.reduce((sum, item) => sum + item.value, 0);
    let offset = 0;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", String(height));
    svg.appendChild(svgNode("circle", { cx, cy, r: radius, fill: "none", stroke: SVG_THEME.track, "stroke-width": strokeWidth }));

    items.forEach((item) => {
      const dash = total ? (item.value / total) * circumference : 0;
      const segment = svgNode(
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
          tabindex: 0,
        },
        null,
        `${item.label}: ${item.value}`
      );
      segment.classList.add("chart-segment");
      segment.addEventListener("mouseenter", (event) => showProblemTooltip(event, item.records, item.label));
      segment.addEventListener("mousemove", moveTooltip);
      segment.addEventListener("mouseleave", hideTooltip);
      segment.addEventListener("click", () => {
        state.selectedRecords = item.records;
        state.selectedLabel = `${item.label}: ${item.value} problem(s)`;
        renderTable(getTableRecords(getVisibleRecords()));
        renderSelectionSummary();
      });
      svg.appendChild(segment);
      offset += dash;
    });

    svg.appendChild(
      svgNode("text", { x: cx, y: cy - 2, "text-anchor": "middle", fill: SVG_THEME.text, "font-size": 30, "font-weight": 800 }, String(total))
    );
    svg.appendChild(
      svgNode("text", { x: cx, y: cy + 22, "text-anchor": "middle", fill: SVG_THEME.muted, "font-size": 12 }, "problems")
    );
  }

  function getTableRecords(visibleRecords) {
    return state.selectedRecords || visibleRecords;
  }

  function renderTable(sourceRecords) {
    renderSelectionSummary();
    const visibleColumns = TABLE_COLUMNS.filter((column) => state.visibleColumns.has(column.key));
    const filtered = sourceRecords.filter((record) =>
      state.tableQuery ? record.searchText.includes(state.tableQuery) || getTableSearchText(record).includes(state.tableQuery) : true
    );
    const sorted = sortRows(filtered);

    dom.tableHeadRow.replaceChildren(
      ...visibleColumns.map((column) => {
        const th = document.createElement("th");
        th.dataset.col = column.key;
        th.textContent = column.label;
        if (state.sort.column === column.key) {
          th.classList.add("is-active");
          th.dataset.dir = state.sort.direction === "asc" ? "↑" : "↓";
          th.setAttribute("aria-sort", state.sort.direction === "asc" ? "ascending" : "descending");
        } else {
          th.setAttribute("aria-sort", "none");
        }
        th.addEventListener("click", () => {
          if (state.sort.column === column.key) {
            state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
          } else {
            state.sort = { column: column.key, direction: column.key === "date" ? "asc" : "asc" };
          }
          renderTable(sourceRecords);
        });
        return th;
      })
    );

    dom.tableSummary.textContent = `${sorted.length} row(s) ${
      state.selectedRecords ? "in selection" : "in current filter"
    }`;
    dom.clearSelection.hidden = !state.selectedRecords;

    if (!sorted.length) {
      dom.tableBody.innerHTML = `<tr><td colspan="${visibleColumns.length || 1}" class="empty-state">No matching problems.</td></tr>`;
      return;
    }

    dom.tableBody.innerHTML = sorted
      .map(
        (record) => `
          <tr>
            ${visibleColumns.map((column) => `<td>${renderTableCell(record, column.key)}</td>`).join("")}
          </tr>
        `
      )
      .join("");
  }

  function renderSelectionSummary() {
    if (!state.selectedRecords) {
      dom.selectionSummary.innerHTML = "";
      return;
    }

    dom.selectionSummary.innerHTML = `
      <strong>${escapeHtml(state.selectedLabel || "Selected subset")}</strong>
      <span>${escapeHtml(state.selectedRecords.length.toString())} row(s)</span>
    `;
  }

  function renderTableCell(record, key) {
    switch (key) {
      case "problem":
        return record.problemLinks.length
          ? record.problemLinks
              .map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">#${escapeHtml(link.label)}</a>`)
              .join(", ")
          : escapeHtml(record.problemText);
      case "date":
        return escapeHtml(record.dateRaw || "");
      case "effectiveDate":
        return `<span title="${escapeHtml(record.effectiveDateInfo.note)}">${escapeHtml(formatEffectiveDate(record.effectiveDateInfo))}</span>`;
      case "model":
        return escapeHtml(record.aiSystemsLabel || "");
      case "outcome":
        return `<span class="badge badge-${escapeHtml(record.outcomeKind)}">${escapeHtml(OUTCOME_LABELS[record.outcomeKind])}</span>`;
      case "category":
        return escapeHtml(record.categoryLabel);
      case "section":
        return escapeHtml(shortSectionLabel(record.subsectionAnchor));
      case "note":
        return `<span class="table-note">${escapeHtml(record.descriptionLabel || "")}</span>`;
      default:
        return "";
    }
  }

  function sortRows(rows) {
    const direction = state.sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
      const leftValue = getSortValue(left, state.sort.column);
      const rightValue = getSortValue(right, state.sort.column);
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction;
      }
      return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: "base" }) * direction;
    });
  }

  function getSortValue(record, key) {
    switch (key) {
      case "problem":
        return record.problemIds[0] || record.problemText;
      case "date":
        return record.startMs;
      case "effectiveDate":
        return record.effectiveDateInfo?.date?.getTime() || record.startMs;
      case "model":
        return record.aiSystemsLabel || "";
      case "outcome":
        return outcomeScore(record.outcomeKind);
      case "category":
        return record.categoryLabel;
      case "section":
        return record.subsectionAnchor;
      case "note":
        return record.descriptionLabel || "";
      default:
        return record.startMs;
    }
  }

  function enhanceRecord(record) {
    const dateInfo = parseDateInfo(record.dateRaw);
    const outcomeKind = classifyOutcome(record);
    const matchedReleases = matchReleases(record.aiSystemsLabel, dateInfo.valid ? dateInfo.start : null);
    const problemText = record.problemIds.length
      ? record.problemIds.map((problemId) => `#${problemId}`).join(", ")
      : record.problemLabel || "Unknown";
    const categoryLabel = CATEGORY_LABELS[record.subsectionAnchor] || record.subsection;
    const searchText = [
      problemText,
      record.problemLabel,
      record.aiSystemsLabel,
      record.humansLabel,
      record.descriptionLabel,
      record.subsection,
      categoryLabel,
      ...Object.values(record.fieldsPlain || {}),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return {
      ...record,
      dateInfo,
      hasValidDate: dateInfo.valid,
      startMs: dateInfo.start.getTime(),
      endMs: dateInfo.end.getTime(),
      outcomeKind,
      matchedReleases,
      problemText,
      categoryLabel,
      searchText,
    };
  }

  function buildFirstSeenBySystem(recordList) {
    const map = new Map();
    recordList.forEach((record) => {
      if (!record.hasValidDate) {
        return;
      }
      splitAiSystems(record.aiSystemsLabel).forEach((system) => {
        const key = normalizeSystemName(system);
        const existing = map.get(key);
        if (!existing || record.dateInfo.start < existing.date) {
          map.set(key, { date: record.dateInfo.start, label: system, record });
        }
      });
    });
    return map;
  }

  function buildEffectiveDateInfo(record) {
    const anchor = getAnchorReleaseMatch(record);

    if (anchor) {
      if (isInternalModel(anchor)) {
        const estimate = estimateInternalModelDate(anchor, record.dateInfo.start);
        if (estimate) {
          return {
            date: estimate.date,
            estimated: true,
            source: "internal-estimate",
            label: `${formatDate(estimate.date)}*`,
            note: `Estimated as two weeks after ${estimate.base.label} (${estimate.base.releaseDate}).`,
          };
        }
      }

      return {
        date: anchor.releaseDateObj,
        estimated: false,
        source: anchor.sourceKind,
        label: formatDate(anchor.releaseDateObj),
        note: `${anchor.label} release date (${anchor.sourceKind}).`,
      };
    }

    const firstSystem = firstSystemName(record);
    const firstSeen = firstSeenBySystem.get(normalizeSystemName(firstSystem));
    if (firstSeen) {
      return {
        date: firstSeen.date,
        estimated: false,
        source: "first-seen",
        label: formatDate(firstSeen.date),
        note: `${firstSystem} first appears in the scraped wiki data on ${formatDate(firstSeen.date)}.`,
      };
    }

    return {
      date: record.dateInfo.start,
      estimated: false,
      source: "fallback",
      label: formatDate(record.dateInfo.start),
      note: "Fell back to the solved date because no model date could be inferred.",
    };
  }

  function estimateInternalModelDate(anchor, eventDate) {
    const eventMs = eventDate?.getTime() || Number.POSITIVE_INFINITY;
    const prior = releases
      .filter(
        (release) =>
          release.vendor === anchor.vendor &&
          !isInternalModel(release) &&
          release.sourceKind === "official" &&
          release.releaseDateObj.getTime() <= eventMs
      )
      .sort((left, right) => left.releaseDateObj - right.releaseDateObj)
      .at(-1);

    if (!prior) {
      return null;
    }

    return {
      base: prior,
      date: new Date(prior.releaseDateObj.getTime() + 14 * DAY_MS),
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
    if (/\bGemini Pro\b/i.test(text) && !/\bGemini 3(?!\.1)\b/i.test(text) && !/\bGemini 3\.1\b/i.test(text)) {
      addMatch(selectFamilyRelease("gemini-pro", eventDate));
    }

    return matches.sort((left, right) => left.releaseDate.localeCompare(right.releaseDate));
  }

  function selectFamilyRelease(family, eventDate) {
    const familyReleases = releasesByFamily.get(family) || [];
    const eventMs = eventDate ? eventDate.getTime() : Number.POSITIVE_INFINITY;
    const viable = familyReleases.filter((release) => release.releaseDateObj.getTime() <= eventMs);
    return viable.at(-1) || familyReleases[0] || null;
  }

  function getAnchorReleaseMatch(record) {
    const viable = record.matchedReleases
      .filter((match) => match.lagDays === null || match.lagDays >= 0)
      .sort((left, right) => {
        const leftLag = left.lagDays ?? Number.POSITIVE_INFINITY;
        const rightLag = right.lagDays ?? Number.POSITIVE_INFINITY;
        return leftLag - rightLag;
      });
    return viable[0] || record.matchedReleases[0] || null;
  }

  function getChartDate(record) {
    if (state.dateMode === "effective") {
      return record.effectiveDateInfo?.date?.getTime() || Number.NaN;
    }
    return record.startMs;
  }

  function classifyOutcome(record) {
    const text = [
      record.descriptionLabel,
      record.fieldsPlain?.Outcome,
      record.fieldsPlain?.Result,
      record.fieldsPlain?.Computation,
      record.fieldsPlain?.Artifacts,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (/incorrect|major gaps|wrong reference|wrong references/.test(text)) {
      return "incorrect";
    }

    if (/full solution|new proof found|proof found|solution to stronger problem|upgraded to full solution|full solution found/.test(text)) {
      return "full";
    }

    if (/partial|variant problem|one part|related result|improved|cheap|reduction|initial exploration|conditional/.test(text)) {
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

    [
      {
        regex: /(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})\s*-\s*(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})/g,
        build: (groups) => ({ start: makeDate(groups[2], groups[1], groups[0]), end: makeDate(groups[5], groups[4], groups[3]) }),
      },
      {
        regex: /(\d{1,2})\s+([A-Za-z]+)\s*-\s*(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})/g,
        build: (groups) => ({ start: makeDate(groups[4], groups[1], groups[0]), end: makeDate(groups[4], groups[3], groups[2]) }),
      },
      {
        regex: /(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})/g,
        build: (groups) => ({ start: makeDate(groups[3], groups[2], groups[0]), end: makeDate(groups[3], groups[2], groups[1]) }),
      },
      {
        regex: /([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),\s*(\d{4})/g,
        build: (groups) => ({ start: makeDate(groups[3], groups[0], groups[1]), end: makeDate(groups[3], groups[0], groups[2]) }),
      },
    ].forEach((pattern) => {
      scrubbed = scrubbed.replace(pattern.regex, (...args) => {
        ranges.push(pattern.build(args.slice(1, -2)));
        return " ";
      });
    });

    const singles = [];
    [/(\d{1,2}\s+[A-Za-z]+,\s*\d{4})/g, /([A-Za-z]+\s+\d{1,2},\s*\d{4})/g, /([A-Za-z]+\s+\d{4})/g, /(\d{4})/g].forEach(
      (pattern) => {
        scrubbed = scrubbed.replace(pattern, (match) => {
          const parsed = parseSingleDate(match);
          if (parsed) {
            singles.push(parsed);
          }
          return " ";
        });
      }
    );

    const allRanges = [
      ...ranges,
      ...singles.map((date) => ({ start: date.start || date, end: date.end || date })),
    ].filter((range) => range.start instanceof Date && !Number.isNaN(range.start.getTime()));

    if (!allRanges.length) {
      return fallbackDateInfo();
    }

    return {
      valid: true,
      start: new Date(Math.min(...allRanges.map((range) => range.start.getTime()))),
      end: new Date(Math.max(...allRanges.map((range) => range.end.getTime()))),
    };
  }

  function parseSingleDate(token) {
    let match = token.match(/^(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})$/);
    if (match) {
      return makeDate(match[3], match[2], match[1]);
    }

    match = token.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
    if (match) {
      return makeDate(match[3], match[1], match[2]);
    }

    match = token.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (match) {
      return {
        start: makeDate(match[2], match[1], 1),
        end: new Date(Date.UTC(Number(match[2]), monthIndex(match[1]) + 1, 0)),
      };
    }

    match = token.match(/^(\d{4})$/);
    if (match) {
      return {
        start: new Date(Date.UTC(Number(match[1]), 0, 1)),
        end: new Date(Date.UTC(Number(match[1]), 11, 31)),
      };
    }

    return null;
  }

  function fallbackDateInfo() {
    const date = new Date(Date.UTC(1970, 0, 1));
    return { valid: false, start: date, end: date };
  }

  function makeDate(year, month, day) {
    return new Date(Date.UTC(Number(year), monthIndex(month), Number(day)));
  }

  function monthIndex(month) {
    return MONTHS[String(month).slice(0, 3).toLowerCase()] ?? 0;
  }

  function diffDays(leftDate, rightDate) {
    return Math.round((startOfDay(leftDate).getTime() - startOfDay(rightDate).getTime()) / DAY_MS);
  }

  function startOfDay(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  function splitAiSystems(value) {
    return String(value || "")
      .replace(/\band\b/gi, ",")
      .split(/[,;]+/)
      .map((part) => part.replace(/\([^)]*\)/g, "").trim())
      .filter(Boolean);
  }

  function firstSystemName(record) {
    return splitAiSystems(record.aiSystemsLabel)[0] || record.aiSystemsLabel || "Unmatched";
  }

  function normalizeSystemName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\([^)]*\)/g, "")
      .replace(/[^a-z0-9.]+/g, " ")
      .trim();
  }

  function isInternalModel(release) {
    return /internal/i.test(`${release.id} ${release.label}`);
  }

  function getProblemKeys(record) {
    return record.problemIds.length ? record.problemIds.map((problemId) => `problem:${problemId}`) : [`row:${record.id}`];
  }

  function outcomeScore(outcome) {
    return { full: 3, partial: 2, incorrect: 1, neutral: 0 }[outcome] || 0;
  }

  function currentProblemSetLabel() {
    return {
      "autonomous-full": "Fully autonomous complete solutions",
      "assisted-full": "Assisted + autonomous complete solutions",
      partial: "Partial solutions",
      advanced: "Advanced filter",
    }[state.problemSet];
  }

  function shortSectionLabel(anchor) {
    return {
      "sect-1a": "1(a)",
      "sect-1b": "1(b)",
      "sect-1c": "1(c)",
      "sect-1d": "1(d)",
      "sect-2a": "2(a)",
      "sect-2b": "2(b)",
      "sect-2c": "2(c)",
      "sect-2d": "2(d)",
      "sect-2e": "2(e)",
      "sect-3": "3",
    }[anchor] || anchor;
  }

  function showProblemTooltip(event, recordsInTooltip, heading, point = null) {
    const sample = recordsInTooltip.slice(0, 5);
    const dateLine = point ? `<div>${escapeHtml(formatDate(new Date(point.x)))} | cumulative ${escapeHtml(String(point.y))}</div>` : "";
    dom.chartTooltip.innerHTML = `
      <strong>${escapeHtml(heading)}</strong>
      ${dateLine}
      ${sample
        .map(
          (record) =>
            `<div><b>${escapeHtml(record.problemText)}</b> ${escapeHtml(record.aiSystemsLabel || "")} - ${escapeHtml(
              record.descriptionLabel || OUTCOME_LABELS[record.outcomeKind]
            )}</div>`
        )
        .join("")}
      ${recordsInTooltip.length > sample.length ? `<div>+${recordsInTooltip.length - sample.length} more</div>` : ""}
    `;
    dom.chartTooltip.hidden = false;
    moveTooltip(event);
  }

  function showModelTooltip(event, group) {
    dom.chartTooltip.innerHTML = `
      <strong>${escapeHtml(group.label)}</strong>
      <div>${escapeHtml(group.details)}</div>
      <div>${escapeHtml(String(group.total))} visible problem(s)</div>
    `;
    dom.chartTooltip.hidden = false;
    moveTooltip(event);
  }

  function moveTooltip(event) {
    const offset = 14;
    const rect = dom.chartTooltip.getBoundingClientRect();
    const x = Math.min(event.clientX + offset, window.innerWidth - rect.width - 12);
    const y = Math.min(event.clientY + offset, window.innerHeight - rect.height - 12);
    dom.chartTooltip.style.left = `${Math.max(12, x)}px`;
    dom.chartTooltip.style.top = `${Math.max(12, y)}px`;
  }

  function hideTooltip() {
    dom.chartTooltip.hidden = true;
  }

  function clearSelection() {
    state.selectedRecords = null;
    state.selectedLabel = "";
  }

  function getTableSearchText(record) {
    return [
      record.problemText,
      record.dateRaw,
      formatEffectiveDate(record.effectiveDateInfo),
      record.aiSystemsLabel,
      record.categoryLabel,
      record.descriptionLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function formatEffectiveDate(info) {
    if (!info?.date) {
      return "";
    }
    return `${formatDate(info.date)}${info.estimated ? "*" : ""}`;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }

  function formatDateTime(date) {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  }

  function monthShort(date) {
    return new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date);
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

    return String(family || "Unmatched")
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
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  function buildLegendItem(color, label) {
    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-swatch" style="background:${escapeHtml(color)}"></span>${escapeHtml(label)}`;
    return item;
  }

  function renderEmptySvg(svg, message, height) {
    svg.replaceChildren();
    const width = getSvgWidth(svg, 260);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", String(height));
    svg.appendChild(
      svgNode("text", { x: width / 2, y: height / 2, "text-anchor": "middle", fill: SVG_THEME.muted, "font-size": 14 }, message)
    );
  }

  function getSvgWidth(svg, minWidth) {
    return Math.max(Math.round(svg.clientWidth || svg.parentElement.clientWidth || minWidth), minWidth);
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

  function truncateLabel(value, maxLength) {
    const text = String(value);
    return text.length <= maxLength ? text : `${text.slice(0, Math.max(1, maxLength - 3))}...`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
})();
