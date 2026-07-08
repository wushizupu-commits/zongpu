const NODE_W = 176;
    const NODE_H = 76;
    const X_GAP = 212;
    const Y_GAP = 72;
    const VERTICAL_X_GAP = 196;
    const VERTICAL_Y_GAP = 112;
    const VISIBLE_INITIAL_DEPTH = 4;

    const svg = document.getElementById("chart");
    const appEl = document.getElementById("app");
    const viewport = document.getElementById("viewport");
    const detailPane = document.getElementById("detailPane");
    const detailTitle = document.getElementById("detailTitle");
    const detailMeta = document.getElementById("detailMeta");
    const detailTags = document.getElementById("detailTags");
    const detailLineage = document.getElementById("detailLineage");
    const overviewStats = document.getElementById("overviewStats");
    const longevityRecordsPanel = document.getElementById("longevityRecordsPanel");
    const spouseSurnamePanel = document.getElementById("spouseSurnamePanel");
    const daughterRecordsPanel = document.getElementById("daughterRecordsPanel");
    const generationChart = document.getElementById("generationChart");
    const detailFields = document.getElementById("detailFields");
    const detailNotice = document.getElementById("detailNotice");
    const detailActions = document.getElementById("detailActions");
    const canvasMeta = document.getElementById("canvasMeta");
    const searchInput = document.getElementById("search");
    const resultsEl = document.getElementById("results");
    const hoverCard = document.getElementById("hoverCard");
    const downloadPngBtn = document.getElementById("downloadPngBtn");
    const downloadPdfBtn = document.getElementById("downloadPdfBtn");
    const viewModeBtn = document.getElementById("viewModeBtn");
    const stepExpandBtn = document.getElementById("stepExpandBtn");
    const sidebarCollapseBtn = document.getElementById("sidebarCollapseBtn");
    const sidebarOpenBtn = document.getElementById("sidebarOpenBtn");
    const migrationModal = document.getElementById("migrationModal");
    const migrationMap = document.getElementById("migrationMap");
    const migrationCloseBtn = document.getElementById("migrationCloseBtn");
    const migrationZoomOutBtn = document.getElementById("migrationZoomOutBtn");
    const migrationZoomInBtn = document.getElementById("migrationZoomInBtn");
    const migrationResetMapBtn = document.getElementById("migrationResetMapBtn");
    const migrationZoomLabel = document.getElementById("migrationZoomLabel");
    const migrationPlaceTitle = document.getElementById("migrationPlaceTitle");
    const migrationSummary = document.getElementById("migrationSummary");
    const migrationRecords = document.getElementById("migrationRecords");
    const migrationPlaceById = new Map((DATA.migrationPlaces || []).map(place => [place.id, place]));
    let activeMigrationPlaceId = "";
    const MIGRATION_MAP_WIDTH = 860;
    const MIGRATION_MAP_HEIGHT = 560;
    const MIGRATION_MAP_MAX_SCALE = 10;
    const migrationMapView = {
      scale: 1,
      tx: 0,
      ty: 0,
      dragging: false,
      lastX: 0,
      lastY: 0,
      moved: false
    };

    const nodeMap = new Map(DATA.nodes.map(node => [node.key, { ...node, children: [], parent: null }]));
    const linkKey = (source, target) => `${source}>${target}`;
    const linkByPair = new Map();
    for (const link of DATA.links) {
      const parent = nodeMap.get(link.source);
      const child = nodeMap.get(link.target);
      if (parent && child) {
        parent.children.push(child);
        child.parent = parent;
        child.parentLinkAmbiguous = link.ambiguous;
        linkByPair.set(linkKey(link.source, link.target), link);
      }
    }

    for (const node of nodeMap.values()) {
      node.children.sort((a, b) => {
        const ga = parseFloat(a.gen) || 0;
        const gb = parseFloat(b.gen) || 0;
        return ga - gb || a.rowNumber - b.rowNumber;
      });
    }

    const root = {
      key: "__root__",
      id: "ROOT",
      name: "族谱总览",
      aliasName: "",
      aliasDisplayName: "",
      earlyDeathTag: "",
      gen: "",
      fatherId: "",
      biographyLink: null,
      rowNumber: 0,
      children: DATA.roots.map(key => nodeMap.get(key)).filter(Boolean),
      parent: null,
      childCount: DATA.roots.length
    };
    for (const child of root.children) child.parent = root;

    const collapsed = new Set();
    let selectedKey = "__root__";
    let matches = new Set();
    let lineageLinks = new Set();
    let lineageNodes = new Set(["__root__"]);
    let activeAdoptionEdgeKey = "";
    let transform = { x: 40, y: 40, k: 1 };
    let allVisible = [];
    let viewMode = "horizontal";
    let stepRevealNodeKeys = new Set();
    let stepRevealLinkKeys = new Set();
    let stepRevealTimer = 0;
    let mobileSidebarInitialized = false;
    const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointerQuery = window.matchMedia ? window.matchMedia("(hover: none), (pointer: coarse)") : null;
    const narrowViewportQuery = window.matchMedia ? window.matchMedia("(max-width: 760px)") : null;

    function isTouchOptimized() {
      return Boolean((coarsePointerQuery && coarsePointerQuery.matches) || (narrowViewportQuery && narrowViewportQuery.matches));
    }

    function refreshInteractionMode() {
      const touchMode = isTouchOptimized();
      appEl.classList.toggle("touch-mode", touchMode);
      if (touchMode) {
        hideHoverCard();
        if (!mobileSidebarInitialized) {
          appEl.classList.add("sidebar-hidden");
          mobileSidebarInitialized = true;
        }
      }
    }

    if (coarsePointerQuery) coarsePointerQuery.addEventListener("change", refreshInteractionMode);
    if (narrowViewportQuery) narrowViewportQuery.addEventListener("change", refreshInteractionMode);

    function showDetailPanel() {
      appEl.classList.remove("detail-hidden");
      detailPane.classList.add("open");
      hideHoverCard();
    }

    function hideDetailPanel() {
      detailPane.classList.remove("open");
      appEl.classList.add("detail-hidden");
    }

    function isDetailPanelVisible() {
      return !appEl.classList.contains("detail-hidden");
    }

    function initializeCollapse(node, depth = 0) {
      if (depth >= VISIBLE_INITIAL_DEPTH && node.children && node.children.length) {
        collapsed.add(node.key);
      }
      for (const child of node.children || []) initializeCollapse(child, depth + 1);
    }

    function stat(label, value, options = {}) {
      const tag = options.button ? "button" : "div";
      const id = options.id ? ` id="${escapeText(options.id)}"` : "";
      const type = options.button ? ` type="button"` : "";
      const title = options.title ? ` title="${escapeText(options.title)}"` : "";
      const aria = options.ariaExpanded !== undefined
        ? ` aria-expanded="${options.ariaExpanded ? "true" : "false"}"`
        : "";
      const classes = ["stat", options.button ? "stat-button" : "", options.className || ""]
        .filter(Boolean)
        .join(" ");
      const hint = options.hint ? `<em class="stat-hint">${escapeText(options.hint)}</em>` : "";
      return `<${tag}${id}${type}${title}${aria} class="${classes}"><strong>${escapeText(value ?? "-")}</strong><span>${escapeText(label)}</span>${hint}</${tag}>`;
    }

    function renderGenerationChart() {
      const counts = DATA.stats.generationCounts || [];
      if (!counts.length) {
        generationChart.innerHTML = "";
        return;
      }

      const width = 360;
      const height = 196;
      const padLeft = 36;
      const padRight = 44;
      const padTop = 22;
      const padBottom = 32;
      const plotWidth = width - padLeft - padRight;
      const plotHeight = height - padTop - padBottom;
      const maxCount = Math.max(...counts.map(item => item.count), 1);
      const xFor = index => padLeft + (counts.length === 1 ? plotWidth / 2 : index * plotWidth / (counts.length - 1));
      const yFor = count => padTop + (maxCount - count) * plotHeight / maxCount;
      const points = counts.map((item, index) => [xFor(index), yFor(item.count), item]);
      const path = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
      const grid = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
        const y = padTop + ratio * plotHeight;
        return `<line class="chart-grid" x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width - padRight}" y2="${y.toFixed(1)}" />`;
      }).join("");
      const lastPoint = points[points.length - 1];
      const minTickLabelGap = 24;
      const xLabels = points
        .filter(([x, , item], index) => {
          if (index === 0 || index === points.length - 1) return true;
          if (item.generation % 5 !== 0) return false;
          return !lastPoint || Math.abs(lastPoint[0] - x) >= minTickLabelGap;
        })
        .map(([x, , item]) => `<text class="chart-label" x="${x.toFixed(1)}" y="${height - 9}" text-anchor="middle">${item.generation}</text>`)
        .join("");
      const yLabels = [0, Math.ceil(maxCount / 2), maxCount].map(value => {
        const y = yFor(value);
        return `<text class="chart-label" x="${padLeft - 7}" y="${(y + 3).toFixed(1)}" text-anchor="end">${value}</text>`;
      }).join("");
      const pointMarks = points.map(([x, y, item], index) => `
        <circle class="chart-point" data-point-index="${index}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${item.count === maxCount ? 3.8 : 2.8}"></circle>
        <circle class="chart-hit" data-point-index="${index}" data-generation="${item.generation}" data-count="${item.count}" data-x="${x.toFixed(1)}" data-y="${y.toFixed(1)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" tabindex="0">
          <title>第${item.generation}世：${item.count}人</title>
        </circle>
      `).join("");
      const peak = DATA.stats.peakGeneration;
      const note = peak
        ? `第${peak.generation}世人数最多，共 ${peak.count} 人；折线按 Gen（世代）字段统计。`
        : "折线按 Gen（世代）字段统计。";

      generationChart.innerHTML = `
        <h2>世代人口趋势</h2>
        <div class="chart-tooltip" id="generationChartTooltip"></div>
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="各世代人口数量折线图">
          ${grid}
          <line class="chart-axis" x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${height - padBottom}" />
          <line class="chart-axis" x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}" />
          <line class="chart-crosshair" x1="0" y1="${padTop}" x2="0" y2="${height - padBottom}" />
          <path class="chart-line" d="${path}" />
          ${pointMarks}
          ${xLabels}
          ${yLabels}
          <text class="chart-label chart-axis-title" x="${width - 6}" y="${height - 9}" text-anchor="end">世代</text>
        </svg>
        <p class="chart-note">${escapeText(note)}</p>`;
      const tooltip = generationChart.querySelector(".chart-tooltip");
      const crosshair = generationChart.querySelector(".chart-crosshair");
      const chartSvg = generationChart.querySelector("svg");
      const visiblePoints = new Map(
        Array.from(generationChart.querySelectorAll(".chart-point")).map(point => [point.dataset.pointIndex, point])
      );

      function clearActiveChartPoint() {
        tooltip.classList.remove("visible");
        crosshair.classList.remove("visible");
        for (const point of visiblePoints.values()) point.classList.remove("chart-active");
      }

      function setActiveChartPoint(target, event) {
        const point = visiblePoints.get(target.dataset.pointIndex);
        if (!point) return;
        for (const item of visiblePoints.values()) item.classList.remove("chart-active");
        point.classList.add("chart-active");
        crosshair.setAttribute("x1", target.dataset.x);
        crosshair.setAttribute("x2", target.dataset.x);
        crosshair.classList.add("visible");
        tooltip.innerHTML = `<strong>第${escapeText(target.dataset.generation)}世</strong>${escapeText(target.dataset.count)} 人`;
        const rect = generationChart.getBoundingClientRect();
        const svgRect = chartSvg.getBoundingClientRect();
        const fallbackLeft = svgRect.left - rect.left + Number(target.dataset.x) / width * svgRect.width;
        const fallbackTop = svgRect.top - rect.top + Number(target.dataset.y) / height * svgRect.height;
        const pointerLeft = Number.isFinite(event.clientX) ? event.clientX - rect.left : fallbackLeft;
        const pointerTop = Number.isFinite(event.clientY) ? event.clientY - rect.top : fallbackTop;
        const left = Math.max(8, Math.min(pointerLeft + 12, rect.width - 118));
        const top = Math.max(44, pointerTop - 36);
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.classList.add("visible");
      }

      for (const hit of generationChart.querySelectorAll(".chart-hit")) {
        hit.addEventListener("mouseenter", event => setActiveChartPoint(hit, event));
        hit.addEventListener("mousemove", event => setActiveChartPoint(hit, event));
        hit.addEventListener("mouseleave", clearActiveChartPoint);
        hit.addEventListener("focus", event => setActiveChartPoint(hit, event));
        hit.addEventListener("blur", clearActiveChartPoint);
      }
      chartSvg.addEventListener("mouseleave", clearActiveChartPoint);
    }

    function renderSpouseSurnamePanel() {
      const ranks = DATA.stats.spouseSurnameTop5 || [];
      if (!ranks.length) {
        spouseSurnamePanel.innerHTML = "";
        return;
      }
      const maxCount = Math.max(...ranks.map(item => item.count), 1);
      spouseSurnamePanel.innerHTML = `
        <h2>配偶姓氏 Top 5</h2>
        <div class="surname-ranks">
          ${ranks.map(item => `
            <div class="surname-rank">
              <b>${escapeText(item.surname)}氏</b>
              <span class="surname-bar"><i style="width:${Math.max(7, item.count / maxCount * 100).toFixed(1)}%"></i></span>
              <span>${escapeText(item.count)}位</span>
            </div>
          `).join("")}
        </div>
        <p class="chart-note">按配偶栏中“某氏”等姓氏记载统计。</p>`;
    }

    function renderDaughterRecordsPanel() {
      const records = DATA.daughterRecords || [];
      const rows = records.map(record => `
        <div class="daughter-row">
          <span>第${escapeText(record.gen || "?")}世</span>
          <span class="daughter-person">
            <b>${escapeText(record.name)}</b>
            <small>${escapeText(record.id)}</small>
          </span>
          <span class="daughter-count">${escapeText(record.count)}人</span>
          <span class="daughter-bio">${escapeText(record.biography || "事迹未载")}</span>
        </div>
      `).join("");
      daughterRecordsPanel.innerHTML = `
        <h2>女儿相关记录</h2>
        <p class="chart-note">共 ${escapeText(records.length)} 条人物记录提到女儿，合计 ${escapeText(DATA.stats.daughterTotalCount || 0)} 人；下方为事迹字段原文。</p>
        <div class="daughter-table">
          <div class="daughter-row header"><span>世代</span><span>人物 / ID</span><span>人数</span></div>
          ${rows || `<p class="chart-note">未找到明确的女儿记载。</p>`}
        </div>`;
    }

    function renderLongevityRecordsPanel() {
      const records = DATA.longevity80PlusRecords || [];
      const lifeSummary = record => {
        const parts = [];
        if (record.lifeText && !["未载", "未載"].includes(record.lifeText)) parts.push(`生卒：${record.lifeText}`);
        if (record.birthAD || record.deathAD) parts.push(`公元：${record.birthAD || "?"}-${record.deathAD || "?"}`);
        return parts.join("；") || "生卒未载";
      };
      const rows = records.map(record => `
        <div class="longevity-row">
          <span>第${escapeText(record.gen || "?")}世</span>
          <span class="longevity-person">
            <b>${escapeText(record.name)}</b>
            <small>${escapeText(record.id)}</small>
          </span>
          <span class="longevity-age">${escapeText(record.value)}岁</span>
          <span class="longevity-life">${escapeText(lifeSummary(record))}</span>
        </div>
      `).join("");
      longevityRecordsPanel.innerHTML = `
        <h2>80 岁以上人员</h2>
        <p class="chart-note">按“寿数”字段统计，共 ${escapeText(records.length)} 人；按寿数从高到低排列。</p>
        <div class="longevity-table">
          <div class="longevity-row header"><span>世代</span><span>人物 / ID</span><span>寿数</span></div>
          ${rows || `<p class="chart-note">未找到 80 岁以上人员记录。</p>`}
        </div>`;
    }

    function migrationPoint(place, width = MIGRATION_MAP_WIDTH, height = MIGRATION_MAP_HEIGHT) {
      const lonMin = 73;
      const lonMax = 135;
      const latMin = 17;
      const latMax = 54;
      const x = 36 + (place.lon - lonMin) / (lonMax - lonMin) * (width - 72);
      const y = 32 + (latMax - place.lat) / (latMax - latMin) * (height - 64);
      return {
        x: Math.max(24, Math.min(width - 24, x)),
        y: Math.max(24, Math.min(height - 28, y))
      };
    }

    function migrationPath(coords) {
      return coords.map((coord, index) => {
        const point = migrationPoint({ lon: coord[0], lat: coord[1] });
        return `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      }).join(" ") + " Z";
    }

    const CHINA_OUTLINE_COORDS = [
      [73.6, 39.5], [76.2, 40.9], [78.8, 45.6], [85.1, 49.2], [91.2, 50.8],
      [96.2, 49.4], [100.5, 53.5], [108.1, 53.0], [116.7, 49.8], [119.8, 46.6],
      [124.2, 46.0], [131.2, 48.3], [134.4, 47.2], [131.7, 43.6], [124.7, 42.8],
      [121.0, 39.9], [122.0, 37.4], [119.8, 34.8], [121.6, 31.2], [120.3, 28.2],
      [117.2, 24.6], [112.2, 21.8], [109.0, 21.6], [107.4, 18.2], [103.2, 22.4],
      [100.2, 21.7], [98.4, 25.4], [96.6, 28.3], [92.8, 29.3], [89.1, 27.7],
      [85.7, 29.4], [81.6, 31.3], [78.4, 32.4], [76.9, 35.0], [73.6, 36.8]
    ];

    const CHINA_ISLAND_COORDS = [
      [[109.2, 20.8], [110.7, 20.9], [111.0, 19.5], [110.0, 18.3], [108.7, 18.7]],
      [[120.1, 25.5], [121.7, 25.1], [122.1, 23.7], [121.3, 22.0], [120.2, 22.6], [119.8, 24.1]]
    ];

    function migrationSvgPoint(event) {
      const svgEl = migrationMap.querySelector("svg");
      if (!svgEl) return { x: MIGRATION_MAP_WIDTH / 2, y: MIGRATION_MAP_HEIGHT / 2 };
      const rect = svgEl.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * MIGRATION_MAP_WIDTH / Math.max(rect.width, 1),
        y: (event.clientY - rect.top) * MIGRATION_MAP_HEIGHT / Math.max(rect.height, 1)
      };
    }

    function clampMigrationMapView() {
      migrationMapView.scale = Math.max(1, Math.min(MIGRATION_MAP_MAX_SCALE, migrationMapView.scale));
      const margin = 110;
      const minTx = MIGRATION_MAP_WIDTH - MIGRATION_MAP_WIDTH * migrationMapView.scale - margin;
      const minTy = MIGRATION_MAP_HEIGHT - MIGRATION_MAP_HEIGHT * migrationMapView.scale - margin;
      migrationMapView.tx = Math.max(minTx, Math.min(margin, migrationMapView.tx));
      migrationMapView.ty = Math.max(minTy, Math.min(margin, migrationMapView.ty));
      if (migrationMapView.scale === 1) {
        migrationMapView.tx = Math.max(-40, Math.min(40, migrationMapView.tx));
        migrationMapView.ty = Math.max(-40, Math.min(40, migrationMapView.ty));
      }
    }

    function updateMigrationMapTransform() {
      clampMigrationMapView();
      const layer = document.getElementById("migrationMapLayer");
      if (layer) {
        layer.setAttribute("transform", `translate(${migrationMapView.tx.toFixed(2)} ${migrationMapView.ty.toFixed(2)}) scale(${migrationMapView.scale.toFixed(3)})`);
      }
      const markerScale = 1 / migrationMapView.scale;
      for (const marker of migrationMap.querySelectorAll(".migration-marker")) {
        marker.setAttribute("transform", `scale(${markerScale.toFixed(4)})`);
      }
      if (migrationZoomLabel) {
        migrationZoomLabel.textContent = `${Math.round(migrationMapView.scale * 100)}%`;
      }
    }

    function setMigrationMapZoom(nextScale, center = null) {
      const oldScale = migrationMapView.scale;
      const scale = Math.max(1, Math.min(MIGRATION_MAP_MAX_SCALE, nextScale));
      const point = center || { x: MIGRATION_MAP_WIDTH / 2, y: MIGRATION_MAP_HEIGHT / 2 };
      const ratio = scale / oldScale;
      migrationMapView.tx = point.x - (point.x - migrationMapView.tx) * ratio;
      migrationMapView.ty = point.y - (point.y - migrationMapView.ty) * ratio;
      migrationMapView.scale = scale;
      updateMigrationMapTransform();
    }

    function resetMigrationMapView() {
      migrationMapView.scale = 1;
      migrationMapView.tx = 0;
      migrationMapView.ty = 0;
      updateMigrationMapTransform();
    }

    function migrationMapLayerPoint(event) {
      const point = migrationSvgPoint(event);
      return {
        x: (point.x - migrationMapView.tx) / migrationMapView.scale,
        y: (point.y - migrationMapView.ty) / migrationMapView.scale
      };
    }

    function findNearestMigrationPlace(point) {
      const places = DATA.migrationPlaces || [];
      let best = null;
      let bestDistance = Infinity;
      for (const place of places) {
        const placePoint = migrationPoint(place);
        const distance = Math.hypot(placePoint.x - point.x, placePoint.y - point.y);
        if (distance < bestDistance) {
          best = place;
          bestDistance = distance;
        }
      }
      const hitRadius = Math.max(14, 34 / migrationMapView.scale);
      return best && bestDistance <= hitRadius ? best : null;
    }

    function attachMigrationMapEvents() {
      const svgEl = migrationMap.querySelector("svg");
      if (!svgEl) return;
      svgEl.addEventListener("wheel", event => {
        event.preventDefault();
        const direction = event.deltaY > 0 ? -1 : 1;
        const factor = direction > 0 ? 1.18 : 0.84;
        setMigrationMapZoom(migrationMapView.scale * factor, migrationSvgPoint(event));
      }, { passive: false });
      svgEl.addEventListener("dblclick", event => {
        event.preventDefault();
        setMigrationMapZoom(migrationMapView.scale * 1.35, migrationSvgPoint(event));
      });
      svgEl.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        migrationMapView.dragging = true;
        migrationMapView.moved = false;
        migrationMapView.lastX = event.clientX;
        migrationMapView.lastY = event.clientY;
        migrationMap.classList.add("is-panning");
        svgEl.setPointerCapture(event.pointerId);
      });
      svgEl.addEventListener("pointermove", event => {
        if (!migrationMapView.dragging) return;
        const rect = svgEl.getBoundingClientRect();
        const dx = (event.clientX - migrationMapView.lastX) * MIGRATION_MAP_WIDTH / Math.max(rect.width, 1);
        const dy = (event.clientY - migrationMapView.lastY) * MIGRATION_MAP_HEIGHT / Math.max(rect.height, 1);
        if (Math.abs(dx) + Math.abs(dy) > 1.2) migrationMapView.moved = true;
        migrationMapView.tx += dx;
        migrationMapView.ty += dy;
        migrationMapView.lastX = event.clientX;
        migrationMapView.lastY = event.clientY;
        updateMigrationMapTransform();
      });
      svgEl.addEventListener("pointerup", event => {
        migrationMapView.dragging = false;
        migrationMap.classList.remove("is-panning");
        try {
          svgEl.releasePointerCapture(event.pointerId);
        } catch (error) {}
        if (!migrationMapView.moved) {
          const place = findNearestMigrationPlace(migrationMapLayerPoint(event));
          if (place) selectMigrationPlace(place.id);
        }
        migrationMapView.moved = false;
      });
      svgEl.addEventListener("pointercancel", () => {
        migrationMapView.dragging = false;
        migrationMapView.moved = false;
        migrationMap.classList.remove("is-panning");
      });
    }

    function renderMigrationMap(selectedId = "") {
      const places = DATA.migrationPlaces || [];
      const width = MIGRATION_MAP_WIDTH;
      const height = MIGRATION_MAP_HEIGHT;
      if (!places.length) {
        migrationMap.innerHTML = `<div class="notice">暂未从葬地和事迹字段中识别出可展示的迁徙散落地点。</div>`;
        migrationPlaceTitle.textContent = "暂无迁徙地点";
        migrationSummary.innerHTML = "";
        migrationRecords.innerHTML = "";
        return;
      }
      const maxCount = Math.max(...places.map(place => place.count), 1);
      const provinceLabels = [
        { name: "北京", lon: 116.4, lat: 39.9 },
        { name: "河北", lon: 115.0, lat: 38.2 },
        { name: "山东", lon: 118.0, lat: 36.4 },
        { name: "江苏", lon: 119.2, lat: 32.2 },
        { name: "安徽", lon: 117.4, lat: 31.5 },
        { name: "浙江", lon: 120.0, lat: 29.6 },
        { name: "江西", lon: 116.5, lat: 28.4 },
        { name: "福建", lon: 118.5, lat: 26.1 },
        { name: "广东", lon: 113.5, lat: 23.3 },
        { name: "湖南", lon: 113.0, lat: 28.2 },
        { name: "湖北", lon: 112.6, lat: 30.7 },
        { name: "河南", lon: 113.7, lat: 34.1 },
        { name: "四川", lon: 103.8, lat: 30.5 },
        { name: "陕西", lon: 108.8, lat: 34.3 },
        { name: "内蒙古", lon: 111.7, lat: 42.1 },
        { name: "新疆", lon: 85.0, lat: 41.5 },
        { name: "西藏", lon: 88.5, lat: 31.5 },
        { name: "云南", lon: 101.0, lat: 24.5 },
        { name: "海南", lon: 110.0, lat: 19.2 },
        { name: "台湾", lon: 121.0, lat: 23.7 }
      ];
      const country = `<path class="map-country" d="${migrationPath(CHINA_OUTLINE_COORDS)}" />`;
      const islands = CHINA_ISLAND_COORDS.map(coords => `<path class="map-island" d="${migrationPath(coords)}" />`).join("");
      const labels = provinceLabels.map(label => {
        const point = migrationPoint(label, width, height);
        return `<text class="map-region-label" x="${point.x.toFixed(1)}" y="${point.y.toFixed(1)}" text-anchor="middle">${escapeText(label.name)}</text>`;
      }).join("");
      const points = places.map(place => {
        const point = migrationPoint(place, width, height);
        const radius = 6 + Math.sqrt(place.count / maxCount) * 16;
        const active = place.id === selectedId ? " active" : "";
        const labelDx = point.x > width - 150 ? -radius - 8 : radius + 8;
        const anchor = point.x > width - 150 ? "end" : "start";
        return `
          <g class="migration-place${active}" data-place-id="${escapeText(place.id)}" transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})">
            <g class="migration-marker">
              <circle r="${radius.toFixed(1)}"></circle>
              <text x="${labelDx.toFixed(1)}" y="4" text-anchor="${anchor}">${escapeText(place.name)} ${escapeText(place.count)}</text>
              <title>${escapeText(place.province)}·${escapeText(place.name)}：${escapeText(place.count)} 条记录</title>
            </g>
          </g>`;
      }).join("");
      migrationMap.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="子孙迁移分布散落地示意图">
          <rect class="map-frame" x="16" y="16" width="${width - 32}" height="${height - 32}" rx="18"></rect>
          <g id="migrationMapLayer">
            ${country}
            ${islands}
            ${labels}
            ${points}
          </g>
        </svg>`;
      attachMigrationMapEvents();
      updateMigrationMapTransform();
    }

    function renderMigrationPlaceDetail(place) {
      if (!place) {
        migrationPlaceTitle.textContent = "请选择地点";
        migrationSummary.innerHTML = "";
        migrationRecords.innerHTML = "";
        return;
      }
      migrationPlaceTitle.textContent = `${place.name}（${place.province}）`;
      const generationText = (place.generations || [])
        .map(item => `第${item.generation}世 ${item.count}`)
        .join("、") || "-";
      migrationSummary.innerHTML = `
        <span><b>${escapeText(place.count)}</b>关联记录</span>
        <span><b>${escapeText(place.burialCount)}</b>葬地来源</span>
        <span><b>${escapeText(place.biographyCount)}</b>事迹来源</span>
        <span><b>${escapeText(place.manualCount || 0)}</b>补充来源</span>
        <span><b>${escapeText(place.province)}</b>所属区域</span>
      `;
      const rows = (place.records || []).map(record => `
        <div class="migration-record">
          <b>${escapeText(record.name)}</b>
          <small>第${escapeText(record.gen || "?")}世 · ${escapeText(record.id)}</small>
          <div>${(record.sources || []).map(source => `<em>${escapeText(source)}</em>`).join("")}</div>
          ${(record.contexts || []).map(context => `<p>${escapeText(context)}</p>`).join("")}
        </div>
      `).join("");
      migrationRecords.innerHTML = `
        <p class="chart-note">世代分布：${escapeText(generationText)}</p>
        ${rows || `<p class="chart-note">暂无对应人物记录。</p>`}`;
    }

    function selectMigrationPlace(placeId) {
      activeMigrationPlaceId = placeId || (DATA.migrationPlaces && DATA.migrationPlaces[0] && DATA.migrationPlaces[0].id) || "";
      const place = migrationPlaceById.get(activeMigrationPlaceId);
      renderMigrationMap(activeMigrationPlaceId);
      renderMigrationPlaceDetail(place);
    }

    function openMigrationModal() {
      migrationModal.hidden = false;
      const firstPlace = activeMigrationPlaceId || (DATA.migrationPlaces && DATA.migrationPlaces[0] && DATA.migrationPlaces[0].id) || "";
      selectMigrationPlace(firstPlace);
    }

    function closeMigrationModal() {
      migrationModal.hidden = true;
    }

    function setOverviewExpandablePanel(panelName, shouldShow) {
      const longevityButton = document.getElementById("longevity80StatBtn");
      const daughterButton = document.getElementById("daughterStatBtn");
      const showLongevity = panelName === "longevity" && shouldShow;
      const showDaughter = panelName === "daughter" && shouldShow;
      longevityRecordsPanel.hidden = !showLongevity;
      daughterRecordsPanel.hidden = !showDaughter;
      if (longevityButton) longevityButton.setAttribute("aria-expanded", showLongevity ? "true" : "false");
      if (daughterButton) daughterButton.setAttribute("aria-expanded", showDaughter ? "true" : "false");
      const panel = showLongevity ? longevityRecordsPanel : showDaughter ? daughterRecordsPanel : null;
      if (panel) {
        window.setTimeout(() => panel.scrollIntoView({ block: "nearest", behavior: "smooth" }), 0);
      }
    }

    function renderStats() {
      const s = DATA.stats;
      const longest = s.maxLongevity || {};
      const peak = s.peakGeneration || {};
      overviewStats.innerHTML = [
        stat("人物记录", s.sourceRows),
        stat("世代范围", `${s.generationMin || "?"}-${s.generationMax || "?"}`),
        stat("寿数有载", s.longevityRecordedCount),
        stat("80岁以上", s.longevity80PlusCount, {
          id: "longevity80StatBtn",
          button: true,
          hint: "点击查看明细",
          title: "展开或收起 80 岁以上人员明细",
          ariaExpanded: false
        }),
        stat(longest.name ? `最长寿：${longest.name}` : "最长寿", longest.value ? `${longest.value}岁` : "-"),
        stat("人口峰值世代", peak.generation ? `第${peak.generation}世 / ${peak.count}人` : "-"),
        stat("过继关系", s.adoptionLinkCount || 0),
        stat("配偶有载", s.spouseRecordedCount),
        stat("迁徙分布", `${s.migrationPlaceCount || 0}地 / ${s.migrationRecordCount || 0}条`, {
          id: "migrationStatBtn",
          button: true,
          hint: "点击打开地图",
          title: "打开子孙迁移分布散落地示意图"
        }),
        stat("女儿总数", s.daughterTotalCount || 0, {
          id: "daughterStatBtn",
          button: true,
          hint: `${s.daughterRecordCount || 0} 条记录，点击查看`,
          title: "展开或收起女儿相关记录",
          ariaExpanded: false
        })
      ].join("");
      renderLongevityRecordsPanel();
      renderSpouseSurnamePanel();
      renderDaughterRecordsPanel();
      renderGenerationChart();
    }

    function visibleChildren(node) {
      if (collapsed.has(node.key)) return [];
      return node.children || [];
    }

    function layout() {
      const branchGap = viewMode === "vertical"
        ? Math.max(18, VERTICAL_X_GAP - NODE_W)
        : Math.max(8, Y_GAP - NODE_H);
      const lineGap = viewMode === "vertical" ? NODE_W + branchGap : NODE_H + branchGap;

      function shiftSubtree(node, amount) {
        if (viewMode === "vertical") {
          node.x += amount;
          node._min += amount;
          node._max += amount;
        } else {
          node.y += amount;
          node._min += amount;
          node._max += amount;
        }
      }

      function layoutSubtree(node, depth) {
        node.depth = depth;
        const children = visibleChildren(node);
        if (viewMode === "vertical") {
          node.y = depth * VERTICAL_Y_GAP;
        } else {
          node.x = depth * X_GAP;
        }

        if (!children.length) {
          if (viewMode === "vertical") {
            node.x = 0;
          } else {
            node.y = 0;
          }
          node._min = 0;
          node._max = 0;
          return;
        }

        for (const child of children) layoutSubtree(child, depth + 1);

        let cursor = 0;
        for (const [index, child] of children.entries()) {
          const offset = index === 0 ? -child._min : cursor - child._min;
          shiftSubtree(child, offset);
          cursor = child._max + lineGap;
        }

        const childrenMin = Math.min(...children.map(child => child._min));
        const childrenMax = Math.max(...children.map(child => child._max));
        const childrenCenter = (childrenMin + childrenMax) / 2;
        for (const child of children) shiftSubtree(child, -childrenCenter);

        if (viewMode === "vertical") {
          node.x = 0;
        } else {
          node.y = 0;
        }
        node._min = Math.min(0, ...children.map(child => child._min));
        node._max = Math.max(0, ...children.map(child => child._max));
      }

      function collect(node, bucket = []) {
        bucket.push(node);
        for (const child of visibleChildren(node)) collect(child, bucket);
        return bucket;
      }

      function applyParentOffsets(node) {
        if (viewMode === "vertical") {
          for (const child of visibleChildren(node)) {
            child.x += node.x;
            applyParentOffsets(child);
          }
        } else {
          for (const child of visibleChildren(node)) {
            child.y += node.y;
            applyParentOffsets(child);
          }
        }
      }

      layoutSubtree(root, 0);
      root.x = 0;
      root.y = 0;
      applyParentOffsets(root);
      allVisible = collect(root, []);
    }

    function linkPath(source, target) {
      if (viewMode === "vertical") {
        const sx = source.x + NODE_W / 2;
        const sy = source.y + NODE_H;
        const tx = target.x + NODE_W / 2;
        const ty = target.y;
        const mid = (sy + ty) / 2;
        return `M${sx},${sy} C${sx},${mid} ${tx},${mid} ${tx},${ty}`;
      } else {
        const sx = source.x + NODE_W;
        const sy = source.y + NODE_H / 2;
        const tx = target.x;
        const ty = target.y + NODE_H / 2;
        const mid = (sx + tx) / 2;
        return `M${sx},${sy} C${mid},${sy} ${mid},${ty} ${tx},${ty}`;
      }
    }

    function revealOffset(node) {
      if (!node.parent) return { x: 0, y: 0 };
      if (viewMode === "vertical") {
        return {
          x: node.parent.x + NODE_W / 2 - (node.x + NODE_W / 2),
          y: node.parent.y + NODE_H - node.y
        };
      }
      return {
        x: node.parent.x + NODE_W - node.x,
        y: node.parent.y + NODE_H / 2 - (node.y + NODE_H / 2)
      };
    }

    function animateRevealNode(group, node, index) {
      if (prefersReducedMotion) return;
      const offset = revealOffset(node);
      const delay = Math.min(index * 0.035, 0.18);
      group.style.opacity = "0";
      group.style.transition = `opacity .42s cubic-bezier(.18,.86,.28,1) ${delay}s`;

      const motion = document.createElementNS("http://www.w3.org/2000/svg", "animateTransform");
      motion.setAttribute("attributeName", "transform");
      motion.setAttribute("type", "translate");
      motion.setAttribute("additive", "sum");
      motion.setAttribute("from", `${offset.x} ${offset.y}`);
      motion.setAttribute("to", "0 0");
      motion.setAttribute("dur", ".52s");
      motion.setAttribute("begin", `${delay}s`);
      motion.setAttribute("calcMode", "spline");
      motion.setAttribute("keySplines", ".18 .86 .28 1");
      motion.setAttribute("fill", "remove");
      group.appendChild(motion);

      window.requestAnimationFrame(() => {
        group.style.opacity = "1";
      });
      window.setTimeout(() => {
        group.style.opacity = "";
        group.style.transition = "";
      }, 760);
    }

    function animateRevealPath(path) {
      if (prefersReducedMotion) return;
      let length = 1;
      try {
        length = Math.max(1, path.getTotalLength());
      } catch (error) {
        length = 160;
      }
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length);
      path.style.transition = "none";
      window.requestAnimationFrame(() => {
        path.style.transition = "stroke-dashoffset .58s cubic-bezier(.18,.86,.28,1)";
        path.style.strokeDashoffset = "0";
      });
      window.setTimeout(() => {
        path.style.strokeDasharray = "";
        path.style.strokeDashoffset = "";
        path.style.transition = "";
      }, 720);
    }

    function adoptionPath(source, target) {
      const sx = source.x + NODE_W / 2;
      const sy = source.y + NODE_H / 2;
      const tx = target.x + NODE_W / 2;
      const ty = target.y + NODE_H / 2;
      if (viewMode === "vertical") {
        const direction = tx >= sx ? 1 : -1;
        const curve = Math.max(70, Math.abs(tx - sx) / 2);
        return `M${sx},${sy} C${sx + direction * curve},${sy - 34} ${tx - direction * curve},${ty - 34} ${tx},${ty}`;
      } else {
        const direction = tx >= sx ? 1 : -1;
        const curve = Math.max(80, Math.abs(tx - sx) / 2);
        return `M${sx},${sy} C${sx + direction * curve},${sy - 28} ${tx - direction * curve},${ty - 28} ${tx},${ty}`;
      }
    }

    function adoptionLabelPosition(source, target) {
      return {
        x: (source.x + target.x + NODE_W) / 2,
        y: (source.y + target.y + NODE_H) / 2 - (viewMode === "vertical" ? 24 : 18)
      };
    }

    function escapeText(text) {
      return String(text ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
      }[ch]));
    }

    function personRows(node) {
      const rows = [
        ["直接子嗣数", String(node.directChildTotal ?? node.childCount ?? 0)]
      ];
      for (const [label, value] of Object.entries(node.detailFields || {})) {
        rows.push([label, value || "未载"]);
      }
      return rows;
    }

    function detailValue(node, label) {
      return (node.detailFields && node.detailFields[label]) || "";
    }

    function lifeYears(node) {
      const birth = detailValue(node, "公元生");
      const death = detailValue(node, "公元卒");
      if (birth || death) return `${birth || "未载"} - ${death || "未载"}`;
      return detailValue(node, "生卒原文") || "未载";
    }

    function hoverRows(node) {
      return [
        ["寿数", detailValue(node, "寿数") || "未载"],
        ["生卒年", lifeYears(node)],
        ["葬地", detailValue(node, "葬地/向") || "未载"],
        ["事迹", detailValue(node, "事迹") || "未载"],
        ["备注", detailValue(node, "备注") || "未载"]
      ];
    }

    function rowsToHtml(rows, compact = false) {
      const longLabels = new Set(["字/号/行", "配偶", "生卒原文", "葬地/向", "葬地", "事迹", "备注"]);
      return rows.map(([label, value]) =>
        `<div class="field${compact && (longLabels.has(label) || String(value).length > 24) ? " long" : ""}"><dt>${escapeText(label)}</dt><dd>${escapeText(value)}</dd></div>`
      ).join("");
    }

    function renderPersonHeading(node) {
      const generation = String(node.gen || "").trim();
      detailTags.hidden = false;
      detailTags.innerHTML = [
        generation ? `<span class="detail-tag generation">第${escapeText(generation)}世</span>` : "",
        `<span class="detail-tag id">${escapeText(node.id || "无 ID")}</span>`
      ].join("");
      detailTitle.textContent = node.name;
      const alias = String(node.aliasDisplayName || "").trim();
      detailMeta.textContent = alias || "";
      detailMeta.hidden = !alias;
    }

    function renderRootHeading() {
      detailTags.hidden = true;
      detailTags.innerHTML = "";
      detailTitle.textContent = "族谱总览";
      detailMeta.hidden = false;
      detailMeta.textContent = `${DATA.stats.sourceRows} 条人物记录。`;
    }

    function lineageName(node) {
      if (!node) return "";
      const name = String(node.name || "").trim();
      return name || node.id || "未命名";
    }

    function lineagePath(node) {
      const path = [];
      let cursor = node;
      while (cursor && cursor.key !== "__root__") {
        path.unshift(cursor);
        cursor = cursor.parent;
      }
      return path;
    }

    function renderDetailLineage(node) {
      const path = lineagePath(node);
      if (!path.length) {
        detailLineage.hidden = true;
        detailLineage.innerHTML = "";
        return;
      }
      detailLineage.hidden = false;
      detailLineage.innerHTML = path.map((item, index) => {
        const current = index === path.length - 1;
        const button = `<button class="lineage-chip${current ? " current" : ""}" data-key="${escapeText(item.key)}" title="定位到 ${escapeText(item.id || lineageName(item))}">${escapeText(lineageName(item))}</button>`;
        return current ? button : `${button}<span class="lineage-separator" aria-hidden="true">›</span>`;
      }).join("");
      for (const button of detailLineage.querySelectorAll(".lineage-chip")) {
        button.addEventListener("click", () => {
          if (button.dataset.key === selectedKey) return;
          revealNode(button.dataset.key);
        });
      }
    }

    function showHoverCard(node, event, targetElement = null) {
      if (isTouchOptimized()) {
        hideHoverCard();
        return;
      }
      if (isDetailPanelVisible()) {
        hideHoverCard();
        return;
      }
      if (!node || node.key === "__root__") return;
      hoverCard.innerHTML =
        `<h3>${escapeText(node.name)}</h3>` +
        `<div class="hover-meta">ID：${escapeText(node.id)}</div>` +
        `<dl>${rowsToHtml(hoverRows(node), true)}</dl>`;
      hoverCard.classList.add("visible");
      moveHoverCard(event, targetElement);
    }

    function moveHoverCard(event, targetElement = null) {
      if (!hoverCard.classList.contains("visible")) return;
      const gap = 14;
      const rect = hoverCard.getBoundingClientRect();
      const targetRect = targetElement ? targetElement.getBoundingClientRect() : null;
      const baseX = Number.isFinite(event?.clientX) ? event.clientX : (targetRect ? targetRect.right : 24);
      const baseY = Number.isFinite(event?.clientY) ? event.clientY : (targetRect ? targetRect.top : 24);
      let x = baseX + gap;
      let y = baseY + gap;
      if (x + rect.width > window.innerWidth - 10) x = baseX - rect.width - gap;
      if (y + rect.height > window.innerHeight - 10) y = window.innerHeight - rect.height - 10;
      hoverCard.style.left = `${Math.max(10, x)}px`;
      hoverCard.style.top = `${Math.max(10, y)}px`;
    }

    function hideHoverCard() {
      hoverCard.classList.remove("visible");
    }

    function clearAdoptionHover() {
      viewport.querySelectorAll(".adoption-hover").forEach(element => {
        element.classList.remove("adoption-hover");
      });
      viewport.querySelectorAll(".node.adoption-related").forEach(element => {
        element.classList.remove("adoption-related");
      });
    }

    function setAdoptionHover(link, isActive, path, label) {
      const adoptionEdgeKey = linkKey(link.source.key, link.target.key);
      if (isActive && activeAdoptionEdgeKey === adoptionEdgeKey) return;
      if (!isActive && activeAdoptionEdgeKey && activeAdoptionEdgeKey !== adoptionEdgeKey) return;
      if (!isActive) {
        path.classList.remove("adoption-hover");
        label.classList.remove("adoption-hover");
        activeAdoptionEdgeKey = "";
      } else {
        clearAdoptionHover();
        activeAdoptionEdgeKey = adoptionEdgeKey;
        path.classList.add("adoption-hover");
        label.classList.add("adoption-hover");
      }
      for (const key of [link.source.key, link.target.key]) {
        for (const nodeElement of viewport.querySelectorAll(".node")) {
          if (nodeElement.dataset.key === key) {
            nodeElement.classList.toggle("adoption-related", isActive);
          }
        }
      }
    }

    function short(text, max = 12) {
      text = String(text || "");
      return text.length > max ? text.slice(0, max - 1) + "…" : text;
    }

    function textWidthEstimate(text, fontSize = 13) {
      let width = 0;
      for (const char of String(text || "")) {
        if (/\s/.test(char)) width += fontSize * 0.32;
        else if (/[\x00-\xff]/.test(char)) width += fontSize * 0.58;
        else width += fontSize;
      }
      return width;
    }

    function fitText(text, maxWidth, fontSize = 13) {
      const value = String(text || "");
      if (textWidthEstimate(value, fontSize) <= maxWidth) return value;
      let result = "";
      for (const char of value) {
        if (textWidthEstimate(result + char + "…", fontSize) > maxWidth) break;
        result += char;
      }
      return result ? result + "…" : "…";
    }

    function applyTransform() {
      viewport.setAttribute("transform", `translate(${transform.x} ${transform.y}) scale(${transform.k})`);
    }

    function viewModeText() {
      return viewMode === "vertical" ? "纵向" : "横向";
    }

    function updateCanvasMeta() {
      canvasMeta.textContent = `${viewModeText()}视图，可见节点 ${allVisible.length} / ${DATA.nodes.length + 1}，缩放 ${Math.round(transform.k * 100)}%`;
    }

    function updateViewModeButton() {
      const isVertical = viewMode === "vertical";
      const label = isVertical ? "横向视图" : "纵向视图";
      const labelEl = viewModeBtn.querySelector(".button-label");
      if (labelEl) labelEl.textContent = label;
      viewModeBtn.title = isVertical ? "切换回从左到右的横向展开视图" : "切换为自上而下的纵向展开视图";
      viewModeBtn.setAttribute("aria-label", label);
      viewModeBtn.setAttribute("aria-pressed", isVertical ? "true" : "false");
    }

    function structuralDepth(node) {
      let depth = 0;
      let cursor = node;
      while (cursor && cursor.parent) {
        depth += 1;
        cursor = cursor.parent;
      }
      return depth;
    }

    function hasCollapsedAncestor(node) {
      let cursor = node.parent;
      while (cursor) {
        if (collapsed.has(cursor.key)) return true;
        cursor = cursor.parent;
      }
      return false;
    }

    function stepExpandCandidates() {
      return Array.from(nodeMap.values()).filter(node =>
        collapsed.has(node.key) &&
        (node.children || []).length &&
        !hasCollapsedAncestor(node)
      );
    }

    function updateStepExpandButton() {
      if (!stepExpandBtn) return;
      const candidates = stepExpandCandidates();
      stepExpandBtn.disabled = candidates.length === 0;
      if (!candidates.length) {
        stepExpandBtn.title = "所有可展开节点已展开";
        return;
      }
      const nextDepth = Math.min(...candidates.map(structuralDepth));
      const generationLabels = Array.from(new Set(
        candidates
          .filter(node => structuralDepth(node) === nextDepth)
          .map(node => String(node.gen || "").trim())
          .filter(Boolean)
      ));
      stepExpandBtn.title = generationLabels.length
        ? `展开第 ${generationLabels.join("、")} 世节点的全部子节点`
        : "按当前可见层级逐级展开下一代节点";
    }

    function prepareStepReveal(beforeKeys) {
      stepRevealNodeKeys = new Set(
        allVisible
          .filter(node => node.key !== "__root__" && !beforeKeys.has(node.key))
          .map(node => node.key)
      );
      stepRevealLinkKeys = new Set();
      for (const node of allVisible) {
        if (stepRevealNodeKeys.has(node.key) && node.parent) {
          stepRevealLinkKeys.add(linkKey(node.parent.key, node.key));
        }
      }
      window.clearTimeout(stepRevealTimer);
      stepRevealTimer = window.setTimeout(() => {
        stepRevealNodeKeys.clear();
        stepRevealLinkKeys.clear();
      }, 900);
    }

    function stepExpandNextGeneration() {
      const candidates = stepExpandCandidates();
      if (!candidates.length) {
        updateStepExpandButton();
        return;
      }
      const beforeKeys = new Set(allVisible.map(node => node.key));
      const nextDepth = Math.min(...candidates.map(structuralDepth));
      for (const node of candidates) {
        if (structuralDepth(node) === nextDepth) collapsed.delete(node.key);
      }
      layout();
      prepareStepReveal(beforeKeys);
      render();
      fitVisible();
    }

    function updateLineage(key) {
      lineageLinks = new Set();
      lineageNodes = new Set();
      let cursor = key === "__root__" ? root : nodeMap.get(key);
      while (cursor) {
        lineageNodes.add(cursor.key);
        if (cursor.parent) {
          lineageLinks.add(linkKey(cursor.parent.key, cursor.key));
        }
        cursor = cursor.parent;
      }
    }

    function toggleNodeChildren(node) {
      if (!node || !(node.children || []).length) return false;
      if (collapsed.has(node.key)) collapsed.delete(node.key);
      else collapsed.add(node.key);
      return true;
    }

    function render() {
      updateLineage(selectedKey);
      layout();
      const visibleKeys = new Set(allVisible.map(node => node.key));
      const links = DATA.links
        .map(link => {
          const source = nodeMap.get(link.source);
          const target = nodeMap.get(link.target);
          return { ...link, source, target };
        })
        .filter(link => link.source && link.target && visibleKeys.has(link.source.key) && visibleKeys.has(link.target.key));

      const rootLinks = root.children
        .filter(child => visibleKeys.has(child.key))
        .map(child => ({ source: root, target: child, ambiguous: child.parentLinkAmbiguous }));

      const adoptionLinks = (DATA.adoptionLinks || [])
        .map(link => {
          const source = nodeMap.get(link.source);
          const target = nodeMap.get(link.target);
          return { ...link, source, target };
        })
        .filter(link => link.source && link.target && visibleKeys.has(link.source.key) && visibleKeys.has(link.target.key));

      viewport.innerHTML = "";
      activeAdoptionEdgeKey = "";

      const linkGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      for (const link of [...rootLinks, ...links]) {
        const key = linkKey(link.source.key, link.target.key);
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", [
          "link",
          link.ambiguous ? "ambiguous" : "",
          lineageLinks.has(key) ? "lineage" : ""
        ].filter(Boolean).join(" "));
        path.setAttribute("d", linkPath(link.source, link.target));
        linkGroup.appendChild(path);
        if (stepRevealLinkKeys.has(key)) animateRevealPath(path);
      }
      for (const link of adoptionLinks) {
        const adoptionGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        adoptionGroup.setAttribute("class", "adoption-edge");
        adoptionGroup.dataset.source = link.source.key;
        adoptionGroup.dataset.target = link.target.key;
        const pathData = adoptionPath(link.source, link.target);

        const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        hitPath.setAttribute("class", "link adoption-hit");
        hitPath.setAttribute("d", pathData);
        adoptionGroup.appendChild(hitPath);

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "link adoption");
        path.setAttribute("d", pathData);
        adoptionGroup.appendChild(path);

        const labelPoint = adoptionLabelPosition(link.source, link.target);
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("class", "adoption-label");
        label.setAttribute("x", labelPoint.x);
        label.setAttribute("y", labelPoint.y);
        label.textContent = "过继";
        adoptionGroup.appendChild(label);

        const showAdoptionHover = () => {
          setAdoptionHover(link, true, path, label);
        };
        const hideAdoptionHover = () => {
          setAdoptionHover(link, false, path, label);
        };
        adoptionGroup.addEventListener("pointerenter", showAdoptionHover);
        adoptionGroup.addEventListener("pointerover", showAdoptionHover);
        adoptionGroup.addEventListener("pointermove", showAdoptionHover);
        adoptionGroup.addEventListener("pointerleave", hideAdoptionHover);
        adoptionGroup.addEventListener("mouseenter", showAdoptionHover);
        adoptionGroup.addEventListener("mouseover", showAdoptionHover);
        adoptionGroup.addEventListener("mousemove", showAdoptionHover);
        adoptionGroup.addEventListener("mouseleave", hideAdoptionHover);
        hitPath.addEventListener("pointerenter", showAdoptionHover);
        hitPath.addEventListener("pointerover", showAdoptionHover);
        hitPath.addEventListener("pointermove", showAdoptionHover);
        hitPath.addEventListener("mouseover", showAdoptionHover);
        hitPath.addEventListener("mousemove", showAdoptionHover);
        path.addEventListener("pointerenter", showAdoptionHover);
        path.addEventListener("pointerover", showAdoptionHover);
        path.addEventListener("pointermove", showAdoptionHover);
        path.addEventListener("mouseover", showAdoptionHover);
        path.addEventListener("mousemove", showAdoptionHover);

        linkGroup.appendChild(adoptionGroup);
      }
      viewport.appendChild(linkGroup);

      const nodeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      let revealIndex = 0;
      for (const node of allVisible) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const classes = ["node"];
        if (node.key === "__root__" || DATA.roots.includes(node.key)) classes.push("root");
        if (node.key === selectedKey) classes.push("selected");
        if (lineageNodes.has(node.key) && node.key !== selectedKey) classes.push("ancestor");
        if (matches.has(node.key)) classes.push("match");
        if (stepRevealNodeKeys.has(node.key)) classes.push("step-reveal");
        if (node.earlyDeathTag) classes.push("early-death");
        g.setAttribute("class", classes.join(" "));
        g.setAttribute("transform", `translate(${node.x},${node.y})`);
        g.setAttribute("tabindex", "0");
        g.setAttribute("role", "button");
        g.setAttribute("aria-label", `${node.name} ${node.id}，点击展开或收起子节点`);
        g.dataset.key = node.key;

        const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        hitArea.setAttribute("class", "hit-area");
        hitArea.setAttribute("x", -8);
        hitArea.setAttribute("y", -12);
        hitArea.setAttribute("width", NODE_W + 16);
        hitArea.setAttribute("height", NODE_H + 22);
        hitArea.setAttribute("rx", 10);
        g.appendChild(hitArea);

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("class", "node-card");
        rect.setAttribute("width", NODE_W);
        rect.setAttribute("height", NODE_H);
        rect.setAttribute("rx", 10);
        rect.setAttribute("ry", 10);
        g.appendChild(rect);

        const hasChildren = (node.children || []).length > 0;
        const generationValue = String(node.gen || "").trim();
        const earlyDeathValue = String(node.earlyDeathTag || "").trim();
        const aliasDisplayName = String(node.aliasDisplayName || "").trim();
        const metaItems = [];
        if (earlyDeathValue) metaItems.push({ label: earlyDeathValue, tagClass: "early-death-tag", labelClass: "early-death-label" });
        if (generationValue) metaItems.push({ label: `${generationValue}世`, tagClass: "generation-tag", labelClass: "generation-label" });
        if (aliasDisplayName) metaItems.push({ label: aliasDisplayName, tagClass: "alias-tag", labelClass: "alias-label" });
        if (metaItems.length) {
          let chipLeft = 12;
          for (let index = 0; index < metaItems.length; index += 1) {
            const item = metaItems[index];
            const maxLabelWidth = item.tagClass === "alias-tag" ? 58 : 40;
            const minLabelWidth = item.tagClass === "generation-tag" ? 28 : (item.tagClass === "alias-tag" ? 34 : 20);
            const labelWidth = Math.max(minLabelWidth, Math.min(maxLabelWidth, item.label.length * 7 + 10));
            const metaGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            metaGroup.setAttribute("class", "node-meta-badge");
            metaGroup.setAttribute("transform", `translate(${chipLeft},9)`);

            const metaTag = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            metaTag.setAttribute("class", item.tagClass);
            metaTag.setAttribute("width", labelWidth);
            metaTag.setAttribute("height", 13);
            metaGroup.appendChild(metaTag);

            const metaLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            metaLabel.setAttribute("class", item.labelClass);
            metaLabel.setAttribute("x", labelWidth / 2);
            metaLabel.setAttribute("y", 7);
            metaLabel.textContent = item.tagClass === "alias-tag" ? fitText(item.label, labelWidth - 10, 7.6) : item.label;
            metaGroup.appendChild(metaLabel);

            g.appendChild(metaGroup);
            chipLeft += labelWidth + 3;
          }
        }

        const contentLeft = 14;
        const contentRight = hasChildren ? 48 : 14;
        const contentWidth = NODE_W - contentLeft - contentRight;
        const nameY = metaItems.length ? 39 : 30;

        const name = document.createElementNS("http://www.w3.org/2000/svg", "text");
        name.setAttribute("class", "name");
        name.setAttribute("x", contentLeft);
        name.setAttribute("y", nameY);
        name.textContent = fitText(node.name, contentWidth, 13.5);
        g.appendChild(name);

        const idY = metaItems.length ? 61 : 56;
        const idStripWidth = NODE_W - (hasChildren ? 58 : 24);
        const idStrip = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        idStrip.setAttribute("class", "id-strip");
        idStrip.setAttribute("x", 12);
        idStrip.setAttribute("y", idY - 12);
        idStrip.setAttribute("width", idStripWidth);
        idStrip.setAttribute("height", 16);
        g.appendChild(idStrip);

        const id = document.createElementNS("http://www.w3.org/2000/svg", "text");
        id.setAttribute("class", "id");
        id.setAttribute("x", 18);
        id.setAttribute("y", idY);
        id.textContent = fitText(node.id, idStripWidth - 12, 10.5);
        g.appendChild(id);

        if (hasChildren) {
          const toggle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          toggle.setAttribute("class", "child-toggle");
          toggle.setAttribute("cx", NODE_W - 25);
          toggle.setAttribute("cy", NODE_H - 27);
          toggle.setAttribute("r", 12);
          g.appendChild(toggle);

          const badge = document.createElementNS("http://www.w3.org/2000/svg", "text");
          badge.setAttribute("class", "badge");
          badge.setAttribute("x", NODE_W - 25);
          badge.setAttribute("y", NODE_H - 26.5);
          badge.textContent = collapsed.has(node.key) ? "+" : "−";
          g.appendChild(badge);
        }

        g.addEventListener("pointerdown", event => {
          if (event.pointerType === "touch" || isTouchOptimized()) {
            hideHoverCard();
            return;
          }
          dragDistance = 0;
          suppressCanvasClick = false;
          event.stopPropagation();
        });
        g.addEventListener("pointerup", event => {
          if (event.pointerType !== "touch" && !isTouchOptimized()) event.stopPropagation();
        });
        g.addEventListener("pointerenter", event => {
          showHoverCard(node, event, g);
        });
        g.addEventListener("pointermove", event => {
          moveHoverCard(event, g);
        });
        g.addEventListener("pointerleave", () => {
          hideHoverCard();
        });
        g.addEventListener("mouseenter", event => {
          showHoverCard(node, event, g);
        });
        g.addEventListener("mousemove", event => {
          moveHoverCard(event, g);
        });
        g.addEventListener("mouseleave", () => {
          hideHoverCard();
        });

        g.addEventListener("click", event => {
          event.stopPropagation();
          if (dragDistance > 8 || suppressCanvasClick) {
            event.preventDefault();
            return;
          }
          hideHoverCard();
          selectedKey = node.key;
          toggleNodeChildren(node);
          selectNode(node.key, false);
          render();
        });

        g.addEventListener("keydown", event => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          selectedKey = node.key;
          toggleNodeChildren(node);
          selectNode(node.key, false);
          render();
        });

        nodeGroup.appendChild(g);
        if (stepRevealNodeKeys.has(node.key)) {
          animateRevealNode(g, node, revealIndex);
          revealIndex += 1;
        }
      }
      viewport.appendChild(nodeGroup);
      applyTransform();
      updateCanvasMeta();
      updateStepExpandButton();
    }

    function selectNode(key, shouldRender = true) {
      selectedKey = key;
      updateLineage(key);
      const node = key === "__root__" ? root : nodeMap.get(key);
      if (!node) return;
      showDetailPanel();

      if (key === "__root__") {
        appEl.classList.add("root-detail");
        renderRootHeading();
        overviewStats.hidden = false;
        longevityRecordsPanel.hidden = true;
        spouseSurnamePanel.hidden = false;
        daughterRecordsPanel.hidden = true;
        const longevity80StatBtn = document.getElementById("longevity80StatBtn");
        if (longevity80StatBtn) longevity80StatBtn.setAttribute("aria-expanded", "false");
        const daughterStatBtn = document.getElementById("daughterStatBtn");
        if (daughterStatBtn) daughterStatBtn.setAttribute("aria-expanded", "false");
        generationChart.hidden = false;
        detailNotice.innerHTML = "";
        detailActions.hidden = true;
        detailActions.innerHTML = "";
        detailFields.innerHTML = "";
        detailLineage.hidden = true;
        detailLineage.innerHTML = "";
        if (shouldRender) render();
        return;
      }

      appEl.classList.remove("root-detail");
      renderPersonHeading(node);
      renderDetailLineage(node);
      overviewStats.hidden = true;
      longevityRecordsPanel.hidden = true;
      spouseSurnamePanel.hidden = true;
      daughterRecordsPanel.hidden = true;
      generationChart.hidden = true;

      const warnings = [];
      if (node.duplicateIdCount > 1) warnings.push(`此 ID 在原表中出现 ${node.duplicateIdCount} 次，本图按每一行分别显示。`);
      const ambiguous = DATA.ambiguousParents.find(item => item.childKey === key);
      if (ambiguous) warnings.push(`生父 ID「${ambiguous.fatherId}」有多个候选父节点，本图采用该行之前最近的同 ID 记录。`);
      const orphan = DATA.orphanFathers.find(item => item.childKey === key);
      if (orphan) warnings.push(`生父 ID「${orphan.fatherId}」未在表中找到，因此作为根分支显示。`);
      detailNotice.innerHTML = warnings.length ? `<div class="notice">${warnings.map(escapeText).join("<br>")}</div>` : "";
      const actionLinks = [];
      if (node.biographyLink && node.biographyLink.url) {
        actionLinks.push({
          url: node.biographyLink.url,
          label: "祖贤传略",
          title: node.biographyLink.title || node.name,
        });
      }
      for (const link of node.imageArchiveLinks || []) {
        if (!link || !link.url) continue;
        actionLinks.push({
          url: link.url,
          label: link.label || "先祖画像",
          title: link.title || "相关图志",
        });
      }
      if (actionLinks.length) {
        detailActions.hidden = false;
        detailActions.innerHTML = actionLinks.map(link => `<a class="biography-link" href="${escapeText(link.url)}" title="${escapeText(link.title)}" aria-label="${escapeText(link.label)}：${escapeText(link.title)}"><span>${escapeText(link.label)}</span></a>`).join("");
      } else {
        detailActions.hidden = true;
        detailActions.innerHTML = "";
      }

      const parent = node.parent && node.parent.key !== "__root__" ? node.parent : null;
      detailFields.innerHTML = rowsToHtml(personRows(node));
      if (shouldRender) render();
    }

    function ancestors(node) {
      const list = [];
      let cursor = node.parent;
      while (cursor) {
        list.push(cursor);
        cursor = cursor.parent;
      }
      return list;
    }

    function revealNode(key) {
      const node = nodeMap.get(key);
      if (!node) return;
      for (const item of ancestors(node)) collapsed.delete(item.key);
      selectNode(key, false);
      render();
      focusNode(node);
    }

    function focusNode(node) {
      const rect = svg.getBoundingClientRect();
      transform.k = Math.min(Math.max(transform.k, 0.75), 1.25);
      transform.x = rect.width / 2 - (node.x + NODE_W / 2) * transform.k;
      transform.y = rect.height / 2 - (node.y + NODE_H / 2) * transform.k;
      applyTransform();
    }

    function normalizePersonRouteId(value) {
      return String(value || "").replace(/\s+/g, "").replace(/－/g, "-").toUpperCase();
    }

    function loosePersonRouteId(value) {
      return normalizePersonRouteId(value)
        .split("-")
        .map(part => /^\d+$/.test(part) ? String(Number(part)) : part)
        .join("-");
    }

    function findNodeByPersonRouteId(value) {
      const normalized = normalizePersonRouteId(value);
      if (!normalized) return null;
      const exact = DATA.nodes.find(node => normalizePersonRouteId(node.id) === normalized);
      if (exact) return exact;
      const loose = loosePersonRouteId(value);
      const looseMatches = DATA.nodes.filter(node => loosePersonRouteId(node.id) === loose);
      return looseMatches.length === 1 ? looseMatches[0] : null;
    }

    function revealPersonFromRoute() {
      const params = new URLSearchParams(window.location.search);
      let targetId = params.get("person") || "";
      const hash = decodeURIComponent(window.location.hash || "").replace(/^#/, "");
      if (!targetId && hash.startsWith("person=")) targetId = hash.slice("person=".length);
      const node = findNodeByPersonRouteId(targetId);
      if (!node) return false;
      revealNode(node.key);
      return true;
    }

    function canvasSafeArea() {
      const rect = svg.getBoundingClientRect();
      const padding = isTouchOptimized() ? 18 : 40;
      let top = padding;
      let left = padding;
      let right = padding;
      let bottom = padding;
      if (isTouchOptimized()) {
        const overlaySelectors = [".canvas-toolbar", ".canvas-meta", ".canvas-actions"];
        for (const selector of overlaySelectors) {
          const element = document.querySelector(selector);
          if (!element) continue;
          const style = window.getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden") continue;
          const overlayRect = element.getBoundingClientRect();
          if (overlayRect.width <= 0 || overlayRect.height <= 0) continue;
          const relativeBottom = overlayRect.bottom - rect.top;
          if (relativeBottom > 0) top = Math.max(top, relativeBottom + 22);
        }
        bottom = 28;
        left = 14;
        right = 14;
      }
      const width = Math.max(120, rect.width - left - right);
      const height = Math.max(120, rect.height - top - bottom);
      return { rect, left, top, width, height };
    }

    function fitVisible() {
      if (!allVisible.length) return;
      const safe = canvasSafeArea();
      const minX = Math.min(...allVisible.map(n => n.x));
      const maxX = Math.max(...allVisible.map(n => n.x + NODE_W));
      const minY = Math.min(...allVisible.map(n => n.y));
      const maxY = Math.max(...allVisible.map(n => n.y + NODE_H));
      const graphWidth = Math.max(1, maxX - minX);
      const graphHeight = Math.max(1, maxY - minY);
      const scaleX = safe.width / graphWidth;
      const scaleY = safe.height / graphHeight;
      transform.k = Math.min(1.35, Math.max(0.08, Math.min(scaleX, scaleY)));
      transform.x = safe.left + (safe.width - graphWidth * transform.k) / 2 - minX * transform.k;
      transform.y = safe.top + (safe.height - graphHeight * transform.k) / 2 - minY * transform.k;
      applyTransform();
      updateCanvasMeta();
    }

    function normalizeSearchText(value) {
      return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/吳/g, "吴")
        .replace(/\s+/g, "");
    }

    function searchTerms(value) {
      const normalized = normalizeSearchText(value);
      const terms = normalized ? [normalized] : [];
      if (normalized.length > 1 && normalized.startsWith("吴")) {
        terms.push(normalized.slice(1));
      }
      return [...new Set(terms)];
    }

    function searchText(node) {
      const alias = detailValue(node, "字/号/行");
      return normalizeSearchText([node.id, node.name, node.aliasName, node.aliasDisplayName, alias].join(" "));
    }

    function updateSearch() {
      const queries = searchTerms(searchInput.value);
      matches = new Set();
      resultsEl.innerHTML = "";
      if (!queries.length) {
        render();
        return;
      }
      const found = DATA.nodes
        .filter(node => queries.some(query => searchText(node).includes(query)))
        .slice(0, 80);
      for (const node of found) matches.add(node.key);
      resultsEl.innerHTML = found.slice(0, 12).map(node => {
        const alias = node.aliasDisplayName ? ` · ${node.aliasDisplayName}` : "";
        return `<button class="result" data-key="${escapeText(node.key)}"><b>${escapeText(node.name)}</b><small>${escapeText(node.id + alias)}</small></button>`;
      }).join("") || `<p>没有匹配结果。</p>`;
      for (const button of resultsEl.querySelectorAll(".result")) {
        button.addEventListener("click", () => revealNode(button.dataset.key));
      }
      render();
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    }

    function snapshotStyles() {
      return `
        .link { fill:none; stroke:#c8b891; stroke-width:1.35; }
        .link.ambiguous { stroke:#b56a1c; stroke-dasharray:5 5; }
        .link.adoption { stroke:#88b8b3; stroke-width:1.8; stroke-dasharray:4 7; opacity:.82; }
        .link.adoption-hit { stroke:rgba(142,187,187,.001); stroke-width:14; }
        .link.adoption.adoption-hover { stroke-width:3; opacity:1; stroke-dasharray:8 7; }
        .link.lineage { stroke:#963f2f; stroke-width:3.2; stroke-linecap:round; stroke-dasharray:10 9; }
        .adoption-label {
          fill:#5e8989;
          font-size:11px;
          font-weight:650;
          text-anchor:middle;
          paint-order:stroke;
          stroke:#f6efdf;
          stroke-width:4px;
          stroke-linejoin:round;
        }
        .adoption-label.adoption-hover { fill:#2d7070; font-size:12px; }
        .node .node-card { fill:#fffaf0; stroke:#bda77e; stroke-width:1.15; rx:10; ry:10; }
        .node .id-strip { fill:rgba(132,108,68,.075); stroke:rgba(184,148,97,.18); stroke-width:.7; rx:8; ry:8; }
        .node.root .node-card { stroke:#286a66; stroke-width:1.9; fill:#eaf5f1; }
        .node.selected .node-card { stroke:#a64232; stroke-width:2.8; fill:#fff4df; }
        .node.ancestor .node-card { stroke:#963f2f; stroke-width:2.1; }
        .node.match .node-card { stroke:#b56a1c; stroke-width:2; }
        .node.adoption-related .node-card { stroke:#88b8b3; stroke-width:2.4; fill:#eef8f5; }
        .node.early-death .node-card { stroke:#a64232; stroke-width:1.7; }
        .node.selected.early-death .node-card { stroke:#a64232; stroke-width:2.8; fill:#fff4df; }
        .node .generation-tag { fill:rgba(166,66,50,.075); stroke:none; stroke-width:0; rx:4; ry:4; }
        .node .generation-label {
          fill:rgba(150,63,47,.78);
          font-size:7.4px;
          font-weight:740;
          text-anchor:middle;
          dominant-baseline:middle;
        }
        .node .early-death-tag {
          fill:rgba(166,66,50,.09);
          stroke:none;
          stroke-width:0;
          rx:4;
          ry:4;
        }
        .node .early-death-label {
          fill:rgba(150,63,47,.82);
          font-size:7.4px;
          font-weight:730;
          text-anchor:middle;
          dominant-baseline:middle;
        }
        .node .alias-tag {
          fill:rgba(40,106,102,.075);
          stroke:none;
          stroke-width:0;
          rx:4;
          ry:4;
        }
        .node .alias-label {
          fill:rgba(40,106,102,.82);
          font-size:7.6px;
          font-weight:740;
          text-anchor:middle;
          dominant-baseline:middle;
        }
        .node .hit-area { fill:transparent; stroke:transparent; }
        .node text {
          fill:#241b14;
          letter-spacing:0;
          font-family:"Noto Serif CJK SC","Noto Serif CJK TC","Source Han Serif SC","Source Han Serif TC","Songti SC","STSong","SimSun","PMingLiU",serif;
        }
        .node .name { font-size:13.5px; font-weight:760; }
        .node .id { fill:rgba(86,75,62,.82); font-size:10.5px; font-weight:620; }
        .node .child-toggle { fill:rgba(246,239,223,.94); stroke:rgba(40,106,102,.36); stroke-width:1.2; }
        .node .badge { fill:#286a66; font-size:12px; font-weight:800; text-anchor:middle; dominant-baseline:middle; }
      `;
    }

    function canvasTimestamp() {
      const now = new Date();
      const pad = value => String(value).padStart(2, "0");
      return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    }

    const SNAPSHOT_PADDING = 120;
    const SNAPSHOT_TARGET_RATIO = 2.35;
    const SNAPSHOT_MAX_PIXELS = 230000000;
    const SNAPSHOT_MAX_SIDE = 32760;
    const SNAPSHOT_PDF_TILE_RATIO = 2.15;
    const SNAPSHOT_PDF_TILE_MAX_PIXELS = 24000000;
    const SNAPSHOT_PDF_TILE_MAX_SIDE = 6200;

    function snapshotBounds() {
      if (!allVisible.length) {
        const rect = svg.getBoundingClientRect();
        return {
          minX: 0,
          minY: 0,
          width: Math.max(1, Math.round(rect.width)),
          height: Math.max(1, Math.round(rect.height))
        };
      }
      const minX = Math.min(...allVisible.map(node => node.x));
      const maxX = Math.max(...allVisible.map(node => node.x + NODE_W));
      const minY = Math.min(...allVisible.map(node => node.y));
      const maxY = Math.max(...allVisible.map(node => node.y + NODE_H));
      return {
        minX: minX - SNAPSHOT_PADDING,
        minY: minY - SNAPSHOT_PADDING,
        width: Math.max(1, Math.ceil(maxX - minX + SNAPSHOT_PADDING * 2)),
        height: Math.max(1, Math.ceil(maxY - minY + SNAPSHOT_PADDING * 2))
      };
    }

    function snapshotRatio(width, height) {
      const byPixels = Math.sqrt(SNAPSHOT_MAX_PIXELS / Math.max(1, width * height));
      const bySide = SNAPSHOT_MAX_SIDE / Math.max(width, height, 1);
      return Math.max(0.12, Math.min(SNAPSHOT_TARGET_RATIO, byPixels, bySide));
    }

    function snapshotPdfTiles(bounds, ratio) {
      const maxTileWidth = Math.max(420, Math.floor(SNAPSHOT_PDF_TILE_MAX_SIDE / ratio));
      const maxTileHeightBySide = Math.max(420, Math.floor(SNAPSHOT_PDF_TILE_MAX_SIDE / ratio));
      const maxTileHeightByPixels = Math.max(
        420,
        Math.floor(SNAPSHOT_PDF_TILE_MAX_PIXELS / Math.max(1, maxTileWidth * ratio * ratio))
      );
      const tileWidth = Math.min(bounds.width, maxTileWidth);
      const tileHeight = Math.min(bounds.height, maxTileHeightBySide, maxTileHeightByPixels);
      const tiles = [];
      let row = 1;
      for (let y = bounds.minY; y < bounds.minY + bounds.height; y += tileHeight) {
        let column = 1;
        for (let x = bounds.minX; x < bounds.minX + bounds.width; x += tileWidth) {
          tiles.push({
            minX: x,
            minY: y,
            width: Math.min(tileWidth, bounds.minX + bounds.width - x),
            height: Math.min(tileHeight, bounds.minY + bounds.height - y),
            row,
            column
          });
          column += 1;
        }
        row += 1;
      }
      return tiles;
    }

    function buildSnapshotSvgSource(slice, outputWidth = slice.width, outputHeight = slice.height) {
      const width = slice.width;
      const height = slice.height;
      const clone = svg.cloneNode(true);
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(outputWidth));
      clone.setAttribute("height", String(outputHeight));
      clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
      clone.removeAttribute("class");

      const clonedViewport = clone.querySelector("#viewport");
      if (clonedViewport) {
        clonedViewport.setAttribute("transform", `translate(${(-slice.minX).toFixed(2)} ${(-slice.minY).toFixed(2)}) scale(1)`);
      }

      const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
      style.textContent = snapshotStyles();
      clone.insertBefore(style, clone.firstChild);

      const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      background.setAttribute("width", "100%");
      background.setAttribute("height", "100%");
      background.setAttribute("fill", "#f6efdf");
      clone.insertBefore(background, style.nextSibling);

      return new XMLSerializer().serializeToString(clone);
    }

    async function captureCanvasSlice(slice, ratio) {
      const outputWidth = Math.max(1, Math.round(slice.width * ratio));
      const outputHeight = Math.max(1, Math.round(slice.height * ratio));
      const source = buildSnapshotSvgSource(slice, outputWidth, outputHeight);
      const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      try {
        const image = new Image();
        const loaded = new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
        });
        image.src = url;
        await loaded;
        const canvas = document.createElement("canvas");
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const context = canvas.getContext("2d");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.fillStyle = "#f6efdf";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas;
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    async function captureCanvas() {
      hideHoverCard();
      const bounds = snapshotBounds();
      return captureCanvasSlice(bounds, snapshotRatio(bounds.width, bounds.height));
    }

    async function downloadCanvasPng() {
      hideHoverCard();
      const bounds = snapshotBounds();
      const ratio = snapshotRatio(bounds.width, bounds.height);
      const canvas = await captureCanvasSlice(bounds, ratio);
      canvas.toBlob(blob => {
        if (!blob) return;
        downloadBlob(blob, `族谱画布快照-${canvasTimestamp()}.png`);
        canvas.width = 1;
        canvas.height = 1;
      }, "image/png");
    }

    function dataUrlToBytes(dataUrl) {
      const binary = atob(dataUrl.split(",")[1]);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    }

    function concatBytes(parts) {
      const length = parts.reduce((sum, part) => sum + part.length, 0);
      const result = new Uint8Array(length);
      let offset = 0;
      for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
      }
      return result;
    }

    function jpegBytesForPdf(canvas) {
      return dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.96));
    }

    function makePdfBlobFromPages(pages) {
      const encoder = new TextEncoder();
      const kids = pages.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
      const objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`
      ];
      pages.forEach((page, index) => {
        const pageObj = 3 + index * 3;
        const imageObj = pageObj + 1;
        const contentObj = pageObj + 2;
        const pageWidth = Math.round(page.width * 0.75);
        const pageHeight = Math.round(page.height * 0.75);
        const imageName = `/Im${index + 1}`;
        const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n${imageName} Do\nQ\n`;
        objects.push(
          `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << ${imageName} ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj\n`,
          [
            encoder.encode(`${imageObj} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`),
            page.jpegBytes,
            encoder.encode("\nendstream\nendobj\n")
          ],
          `${contentObj} 0 obj\n<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`
        );
      });

      const parts = [];
      const offsets = [0];
      let byteOffset = 0;
      const push = value => {
        const bytes = typeof value === "string" ? encoder.encode(value) : value;
        parts.push(bytes);
        byteOffset += bytes.length;
      };

      push("%PDF-1.4\n% zongpu snapshot\n");
      for (const object of objects) {
        offsets.push(byteOffset);
        if (Array.isArray(object)) object.forEach(push);
        else push(object);
      }
      const xrefOffset = byteOffset;
      push(`xref\n0 ${objects.length + 1}\n`);
      push("0000000000 65535 f \n");
      for (let index = 1; index <= objects.length; index += 1) {
        push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
      }
      push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
      return new Blob([concatBytes(parts)], { type: "application/pdf" });
    }

    function makePdfBlobFromCanvas(canvas) {
      return makePdfBlobFromPages([{
        jpegBytes: jpegBytesForPdf(canvas),
        width: canvas.width,
        height: canvas.height
      }]);
    }

    function makeSinglePagePdfFromTiles(bounds, tiles) {
      const encoder = new TextEncoder();
      const maxPdfSide = 7200;
      const pdfUnit = Math.min(0.75, maxPdfSide / Math.max(bounds.width, bounds.height, 1));
      const pageWidth = Math.max(1, Math.round(bounds.width * pdfUnit));
      const pageHeight = Math.max(1, Math.round(bounds.height * pdfUnit));
      const pageObject = 3;
      const contentObject = 4;
      const firstImageObject = 5;
      const xObjects = tiles.map((_, index) => `/Im${index + 1} ${firstImageObject + index} 0 R`).join(" ");
      const commands = tiles.map((tile, index) => {
        const x = (tile.minX - bounds.minX) * pdfUnit;
        const y = pageHeight - (tile.minY - bounds.minY + tile.height) * pdfUnit;
        const width = tile.width * pdfUnit;
        const height = tile.height * pdfUnit;
        return `q\n${width.toFixed(3)} 0 0 ${height.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm\n/Im${index + 1} Do\nQ\n`;
      }).join("");
      const objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        `${pageObject} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << ${xObjects} >> >> /Contents ${contentObject} 0 R >>\nendobj\n`,
        `${contentObject} 0 obj\n<< /Length ${encoder.encode(commands).length} >>\nstream\n${commands}endstream\nendobj\n`
      ];

      tiles.forEach((tile, index) => {
        objects.push([
          encoder.encode(`${firstImageObject + index} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${tile.widthPx} /Height ${tile.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${tile.jpegBytes.length} >>\nstream\n`),
          tile.jpegBytes,
          encoder.encode("\nendstream\nendobj\n")
        ]);
      });

      const parts = [];
      const offsets = [0];
      let byteOffset = 0;
      const push = value => {
        const bytes = typeof value === "string" ? encoder.encode(value) : value;
        parts.push(bytes);
        byteOffset += bytes.length;
      };
      push("%PDF-1.4\n% zongpu snapshot\n");
      for (const object of objects) {
        offsets.push(byteOffset);
        if (Array.isArray(object)) object.forEach(push);
        else push(object);
      }
      const xrefOffset = byteOffset;
      push(`xref\n0 ${objects.length + 1}\n`);
      push("0000000000 65535 f \n");
      for (let index = 1; index <= objects.length; index += 1) {
        push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
      }
      push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
      return new Blob([concatBytes(parts)], { type: "application/pdf" });
    }

    async function downloadCanvasPdf() {
      hideHoverCard();
      const bounds = snapshotBounds();
      const ratio = SNAPSHOT_PDF_TILE_RATIO;
      const slices = snapshotPdfTiles(bounds, ratio);
      const tiles = [];
      for (const slice of slices) {
        const canvas = await captureCanvasSlice(slice, ratio);
        tiles.push({
          ...slice,
          widthPx: canvas.width,
          heightPx: canvas.height,
          jpegBytes: jpegBytesForPdf(canvas)
        });
        canvas.width = 1;
        canvas.height = 1;
      }
      downloadBlob(makeSinglePagePdfFromTiles(bounds, tiles), `族谱画布快照-${canvasTimestamp()}.pdf`);
    }

    viewModeBtn.addEventListener("click", () => {
      viewMode = viewMode === "vertical" ? "horizontal" : "vertical";
      updateViewModeButton();
      render();
      fitVisible();
    });
    document.getElementById("fitBtn").addEventListener("click", fitVisible);
    stepExpandBtn.addEventListener("click", stepExpandNextGeneration);
    document.getElementById("expandBtn").addEventListener("click", () => {
      collapsed.clear();
      render();
      fitVisible();
    });
    document.getElementById("collapseBtn").addEventListener("click", () => {
      collapsed.clear();
      initializeCollapse(root);
      render();
      fitVisible();
    });
    document.getElementById("rootBtn").addEventListener("click", () => {
      selectNode("__root__");
      fitVisible();
    });
    detailPane.addEventListener("click", event => {
      const target = event.target instanceof Element ? event.target : null;
      const migrationButton = target ? target.closest("#migrationStatBtn") : null;
      if (migrationButton) {
        openMigrationModal();
        return;
      }

      const longevityButton = target ? target.closest("#longevity80StatBtn") : null;
      if (longevityButton) {
        const shouldShow = longevityRecordsPanel.hidden;
        setOverviewExpandablePanel("longevity", shouldShow);
        return;
      }

      const daughterButton = target ? target.closest("#daughterStatBtn") : null;
      if (daughterButton) {
        const shouldShow = daughterRecordsPanel.hidden;
        setOverviewExpandablePanel("daughter", shouldShow);
      }
    });
    migrationCloseBtn.addEventListener("click", closeMigrationModal);
    migrationZoomOutBtn.addEventListener("click", () => setMigrationMapZoom(migrationMapView.scale / 1.28));
    migrationZoomInBtn.addEventListener("click", () => setMigrationMapZoom(migrationMapView.scale * 1.28));
    migrationResetMapBtn.addEventListener("click", resetMigrationMapView);
    migrationModal.addEventListener("click", event => {
      if (event.target === migrationModal) closeMigrationModal();
    });
    window.addEventListener("keydown", event => {
      if (event.key === "Escape" && !migrationModal.hidden) closeMigrationModal();
    });
    searchInput.addEventListener("input", updateSearch);
    downloadPngBtn.addEventListener("click", () => {
      downloadCanvasPng().catch(error => {
        console.error(error);
        alert("PNG 快照生成失败，请稍后重试。");
      });
    });
    downloadPdfBtn.addEventListener("click", () => {
      downloadCanvasPdf().catch(error => {
        console.error(error);
        alert("PDF 快照生成失败，请稍后重试。");
      });
    });
    sidebarCollapseBtn.addEventListener("click", () => {
      appEl.classList.add("sidebar-hidden");
      window.requestAnimationFrame(fitVisible);
    });
    sidebarOpenBtn.addEventListener("pointerdown", event => {
      event.stopPropagation();
    });
    sidebarOpenBtn.addEventListener("click", () => {
      appEl.classList.remove("sidebar-hidden");
      window.requestAnimationFrame(fitVisible);
    });
    window.zongpuTools = {
      captureCanvas,
      makePdfBlobFromCanvas,
      downloadCanvasPng,
      downloadCanvasPdf
    };

    let dragging = false;
    let lastPoint = null;
    let dragDistance = 0;
    let suppressCanvasClick = false;
    const activePointers = new Map();
    let pinchState = null;

    function pointerPoint(event) {
      return { x: event.clientX, y: event.clientY };
    }

    function distanceBetween(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function midpoint(a, b) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    function zoomAtClientPoint(clientX, clientY, nextScale) {
      const rect = svg.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const oldK = transform.k;
      const newK = Math.min(2.8, Math.max(0.05, nextScale));
      transform.x = mx - ((mx - transform.x) / oldK) * newK;
      transform.y = my - ((my - transform.y) / oldK) * newK;
      transform.k = newK;
    }

    function finishPointerGesture(event) {
      activePointers.delete(event.pointerId);
      if (event.pointerId !== undefined) {
        try { svg.releasePointerCapture(event.pointerId); } catch (error) {}
      }
      if (activePointers.size >= 2) {
        const points = Array.from(activePointers.values()).slice(0, 2);
        pinchState = {
          distance: distanceBetween(points[0], points[1]),
          scale: transform.k,
          center: midpoint(points[0], points[1])
        };
        lastPoint = null;
        return;
      }
      pinchState = null;
      if (activePointers.size === 1) {
        lastPoint = Array.from(activePointers.values())[0];
        dragging = true;
        return;
      }
      suppressCanvasClick = dragDistance > 6;
      dragging = false;
      lastPoint = null;
      svg.classList.remove("dragging");
      if (suppressCanvasClick) {
        window.setTimeout(() => {
          suppressCanvasClick = false;
        }, 140);
      }
    }

    svg.addEventListener("pointerdown", event => {
      if (event.button !== undefined && event.button !== 0 && event.pointerType !== "touch") return;
      hideHoverCard();
      if (activePointers.size === 0) dragDistance = 0;
      const point = pointerPoint(event);
      activePointers.set(event.pointerId, point);
      dragging = true;
      lastPoint = point;
      if (activePointers.size >= 2) {
        const points = Array.from(activePointers.values()).slice(0, 2);
        pinchState = {
          distance: distanceBetween(points[0], points[1]),
          scale: transform.k,
          center: midpoint(points[0], points[1])
        };
      }
      try { svg.setPointerCapture(event.pointerId); } catch (error) {}
      svg.classList.add("dragging");
    });
    svg.addEventListener("pointermove", event => {
      if (!activePointers.has(event.pointerId)) return;
      const previous = activePointers.get(event.pointerId);
      const point = pointerPoint(event);
      activePointers.set(event.pointerId, point);
      dragDistance += Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
      if (activePointers.size >= 2) {
        const points = Array.from(activePointers.values()).slice(0, 2);
        const currentDistance = distanceBetween(points[0], points[1]);
        const currentCenter = midpoint(points[0], points[1]);
        if (!pinchState || !pinchState.distance) {
          pinchState = { distance: currentDistance, scale: transform.k, center: currentCenter };
          return;
        }
        const newScale = pinchState.scale * (currentDistance / pinchState.distance);
        zoomAtClientPoint(currentCenter.x, currentCenter.y, newScale);
        const dx = currentCenter.x - pinchState.center.x;
        const dy = currentCenter.y - pinchState.center.y;
        transform.x += dx;
        transform.y += dy;
        pinchState.center = currentCenter;
        applyTransform();
        updateCanvasMeta();
        return;
      }
      if (!dragging || !lastPoint) return;
      transform.x += point.x - lastPoint.x;
      transform.y += point.y - lastPoint.y;
      lastPoint = point;
      applyTransform();
    });
    svg.addEventListener("pointerup", event => {
      finishPointerGesture(event);
    });
    svg.addEventListener("pointercancel", finishPointerGesture);
    svg.addEventListener("lostpointercapture", event => {
      if (activePointers.has(event.pointerId)) finishPointerGesture(event);
    });
    svg.addEventListener("click", event => {
      if (suppressCanvasClick) return;
      if (event.target && event.target.closest && event.target.closest(".node")) return;
      hideDetailPanel();
    });
    svg.addEventListener("wheel", event => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      zoomAtClientPoint(event.clientX, event.clientY, transform.k * factor);
      applyTransform();
      updateCanvasMeta();
    }, { passive: false });

    renderStats();
    refreshInteractionMode();
    initializeCollapse(root);
    updateViewModeButton();
    render();
    fitVisible();
    hideDetailPanel();
    revealPersonFromRoute();
  
