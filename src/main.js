// Estado y comportamiento de la aplicación. Los datos de dominio permanecen en data.json.
const AUTH_HASH = "bf6b5bdb74c79ece9fc0ad0ac9fb0359f9555d4f35a83b2e6ec69ae99e09603d";
const AUTH_SESSION_KEY = "procesos-auth-ok";
const MAP_SYSTEM_ID = "mapa-de-procesos";

const state = {
  systems: [],
  favoriteIds: new Set(),
  riskLevels: [],
  processGroups: [],
  processCatalog: new Map(),
  strategicMacros: new Map(),
  categoryDetails: new Map(),
  activeView: "all",
  selectedSystemId: MAP_SYSTEM_ID
};

const list = document.querySelector("#systemList");
const search = document.querySelector("#systemSearch");
const count = document.querySelector("#systemCount");
const workspace = document.querySelector("#workspace");
const viewButtons = [...document.querySelectorAll("[data-view]")];

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function unlockApp() {
  document.body.classList.remove("locked");
  document.querySelector("#loginUser").value = "";
  document.querySelector("#loginPass").value = "";
}

async function loadData() {
  const response = await fetch("src/assets/data.json");
  if (!response.ok) throw new Error(`No se pudo cargar data.json (${response.status})`);
  return response.json();
}

function buildProcessGroups(data) {
  return data.categories.map((category) => {
    if (category.id === "strategic") {
      return {
        ...category,
        items: data.macroprocesses
          .filter((macro) => macro.categoryId === category.id)
          .map((macro) => ({ id: macro.id, label: macro.label, type: "macro" }))
      };
    }
    return {
      ...category,
      groups: data.groups.filter((group) => group.categoryId === category.id).map((group) => ({
        ...group,
        items: data.processes
          .filter((process) => process.groupId === group.id)
          .map((process) => ({ id: process.id, label: process.label, type: "process" })),
        subgroups: data.subgroups.filter((subgroup) => subgroup.groupId === group.id).map((subgroup) => ({
          ...subgroup,
          items: data.processes
            .filter((process) => process.subgroupId === subgroup.id)
            .map((process) => ({ id: process.id, label: process.label, type: "process" }))
        }))
      }))
    };
  });
}

function renderProcessLink(item) {
  const route = item.type === "macro" ? "macro" : "proceso";
  const macroClass = item.type === "macro" ? " is-macro" : "";
  return `<a class="process-link${macroClass}" href="#${route}-${item.id}" data-process-id="${item.id}" title="Ver detalle de ${item.label}">${item.label}</a>`;
}

function renderProcessGroup(group) {
  const subgroups = group.subgroups.map((subgroup) => `
    <p class="process-group-subtitle">${subgroup.title}</p>
    <div class="process-links">${subgroup.items.map(renderProcessLink).join("")}</div>`).join("");
  return `<section class="process-group"><h3>${group.title}</h3><div class="process-links">${group.items.map(renderProcessLink).join("")}</div>${subgroups}</section>`;
}

function renderStrategicMacro(macro, label = macro.label, subtitle = "Macroproceso estratégico") {
  const counts = new Map(state.riskLevels.map((level) => [level.label, 0]));
  macro.processes.forEach((process) => counts.set(process.risk, (counts.get(process.risk) || 0) + 1));
  const total = macro.processes.length;
  let cumulative = 0;
  const gradient = state.riskLevels.map((level) => {
    const start = cumulative / total * 100;
    cumulative += counts.get(level.label);
    return `${level.color} ${start}% ${cumulative / total * 100}%`;
  }).join(", ");
  const legend = state.riskLevels.map((level) => {
    const amount = counts.get(level.label);
    return `<li><span class="risk-swatch" style="--risk-color:${level.color}" aria-hidden="true"></span><strong style="--risk-color:${level.color}">${level.label}</strong><span>${amount} proceso${amount === 1 ? "" : "s"} <small>(${Math.round(amount / total * 100)}%)</small></span></li>`;
  }).join("");
  const processes = macro.processes.map((process) => {
    const level = state.riskLevels.find((item) => item.label === process.risk);
    return `<li>${process.name}<span class="risk-badge" style="--risk-color:${level.color}">${level.label}</span></li>`;
  }).join("");
  workspace.innerHTML = `
    <section class="process-screen" aria-labelledby="processDetailTitle">
      <a class="detail-back" href="#mapa">Volver al mapa</a>
      <header class="process-detail-heading"><h1 id="processDetailTitle">${label}</h1><p>${subtitle}</p></header>
      <div class="macro-overview"><section class="macro-description" aria-labelledby="macroDescriptionTitle"><h2 id="macroDescriptionTitle">Descripción del macroproceso</h2><p>${macro.description}</p></section><section class="macro-count" aria-label="Cantidad de procesos existentes"><span>Procesos existentes</span><strong>${total}</strong><small>en este macroproceso</small></section></div>
      <div class="macro-dashboard"><section class="risk-panel" aria-label="Dashboard de nivel de riesgo"><div class="risk-panel-heading"><span>Procesos por nivel de riesgo</span><span>Total: ${total} procesos</span></div><div class="risk-content"><div class="risk-chart" style="--risk-gradient:${gradient}" role="img" aria-label="Distribución de riesgo en ${total} procesos"><div class="risk-total">${total}<small>procesos</small></div></div><ul class="risk-legend">${legend}</ul></div></section><section class="macro-process-list" aria-labelledby="macroProcessListTitle"><h2 id="macroProcessListTitle">Procesos incluidos (${total})</h2><ol>${processes}</ol></section></div>
      <p class="demo-note">Datos de ejemplo; distribución calculada desde los procesos listados.</p>
    </section>`;
}

function renderProcessDetail(process) {
  workspace.innerHTML = `
    <section class="process-screen" aria-labelledby="processDetailTitle">
      <a class="detail-back" href="#mapa">Volver al mapa</a>
      <header class="process-detail-heading"><h1 id="processDetailTitle">${process.label}</h1><p>${process.category}</p></header>
      <section class="process-detail-content" aria-labelledby="detailSectionTitle"><h2 id="detailSectionTitle">Detalle del proceso</h2><p>La información detallada de este proceso estará disponible aquí.</p></section>
    </section>`;
}

function renderMap() {
  const levels = state.processGroups.map((level) => `
    <section class="process-level ${level.className}" aria-labelledby="level-${level.id}">
      <h2 id="level-${level.id}"><a href="#categoria-${level.id}" title="Ver detalle de ${level.title}">${level.title}</a></h2>
      <div class="process-grid ${level.id}-grid">${level.items ? level.items.map(renderProcessLink).join("") : level.groups.map(renderProcessGroup).join("")}</div>
    </section>`).join("");
  workspace.innerHTML = `
    <section class="process-screen" aria-labelledby="processTitle"><div class="process-heading"><div><h1 id="processTitle">Mapa de Procesos</h1><p>Procesos estratégicos, misionales y de apoyo de la Universidad Chinchorro.</p></div></div><div class="process-flow"><aside class="process-boundary"><div class="process-boundary-copy"><h2>Entradas</h2><p>Necesidades de desarrollo científico, tecnológico y humanístico del territorio y la institución.</p></div></aside><div class="process-levels">${levels}</div><aside class="process-boundary"><div class="process-boundary-copy"><h2>Resultados</h2><p>Profesionales formados, publicaciones, asesorías, cursos y servicios para la comunidad.</p></div></aside></div><p class="process-status" id="processStatus" role="status" aria-live="polite"></p></section>`;
}

function renderWorkspace() {
  if (!state.processGroups.length) return;
  const categoryId = window.location.hash.match(/^#categoria-([a-z0-9-]+)$/)?.[1];
  if (state.categoryDetails.has(categoryId)) return renderStrategicMacro(state.categoryDetails.get(categoryId), state.categoryDetails.get(categoryId).label, "Macroproceso");
  const macroId = window.location.hash.match(/^#macro-([a-z0-9-]+)$/)?.[1];
  if (state.strategicMacros.has(macroId)) return renderStrategicMacro(state.strategicMacros.get(macroId));
  const processId = window.location.hash.match(/^#proceso-([a-z0-9-]+)$/)?.[1];
  if (state.processCatalog.has(processId)) return renderProcessDetail(state.processCatalog.get(processId));
  if (state.selectedSystemId !== MAP_SYSTEM_ID) {
    workspace.innerHTML = '<p class="workspace-label">Inicio area: <span>[2]</span></p>';
    return;
  }
  renderMap();
}

function selectSystem(id) {
  if (window.location.hash.startsWith("#proceso-") || window.location.hash.startsWith("#macro-")) window.location.hash = "#mapa";
  state.selectedSystemId = id;
  renderSystems();
  renderWorkspace();
}

function renderSystems() {
  const query = search.value.trim().toLocaleLowerCase("es");
  const visible = state.systems.filter((system) => system.name.toLocaleLowerCase("es").includes(query) && (state.activeView === "all" || state.favoriteIds.has(system.id)));
  visible.sort((first, second) => {
    if (first.id === MAP_SYSTEM_ID) return -1;
    if (second.id === MAP_SYSTEM_ID) return 1;
    return Number(state.favoriteIds.has(second.id)) - Number(state.favoriteIds.has(first.id));
  });
  count.textContent = state.activeView === "all" ? state.systems.length : state.favoriteIds.size;
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No se encontraron sistemas";
    list.append(empty);
    return;
  }
  visible.forEach((system) => {
    const isFavorite = state.favoriteIds.has(system.id);
    const row = document.createElement("li");
    row.className = `system-row${state.selectedSystemId === system.id ? " selected" : ""}`;
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", String(state.selectedSystemId === system.id));
    row.tabIndex = 0;
    row.innerHTML = `<span class="status-dot" aria-hidden="true"></span><span class="system-name" title="${system.name}">${system.name}</span>`;
    const favorite = document.createElement("button");
    favorite.className = `favorite-button${isFavorite ? " is-favorite" : ""}`;
    favorite.type = "button";
    favorite.setAttribute("aria-label", `${isFavorite ? "Quitar de" : "Agregar a"} favoritos: ${system.name}`);
    favorite.title = isFavorite ? "Quitar de favoritos" : "Agregar a favoritos";
    favorite.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m8 1.4 2 4.1 4.5.7-3.2 3.2.7 4.6L8 11.8l-4 2.2.7-4.6-3.2-3.2L6 5.5z"/></svg>';
    favorite.addEventListener("click", (event) => {
      event.stopPropagation();
      isFavorite ? state.favoriteIds.delete(system.id) : state.favoriteIds.add(system.id);
      renderSystems();
    });
    row.addEventListener("click", () => selectSystem(system.id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectSystem(system.id);
      }
    });
    row.append(favorite);
    list.append(row);
  });
}

function bindEvents() {
  if (sessionStorage.getItem(AUTH_SESSION_KEY) === "1") unlockApp();
  document.querySelector("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = document.querySelector("#loginError");
    const user = document.querySelector("#loginUser").value.trim();
    const password = document.querySelector("#loginPass").value;
    if (await sha256Hex(`${user}:${password}`) === AUTH_HASH) {
      sessionStorage.setItem(AUTH_SESSION_KEY, "1");
      error.textContent = "";
      unlockApp();
    } else {
      error.textContent = "Usuario o contraseña incorrectos.";
      document.querySelector("#loginPass").value = "";
    }
  });
  search.addEventListener("input", renderSystems);
  window.addEventListener("hashchange", renderWorkspace);
  viewButtons.forEach((button) => button.addEventListener("click", () => {
    state.activeView = button.dataset.view;
    viewButtons.forEach((tab) => {
      const selected = tab === button;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    renderSystems();
  }));
  const app = document.querySelector("#app");
  const sidebar = document.querySelector("#sidebar");
  const menuToggle = document.querySelector("#menuToggle");
  menuToggle.addEventListener("click", () => {
    const collapsed = app.classList.toggle("sidebar-collapsed");
    sidebar.classList.toggle("is-collapsed", collapsed);
    menuToggle.setAttribute("aria-label", collapsed ? "Expandir menú" : "Contraer menú");
    menuToggle.title = collapsed ? "Expandir menú" : "Contraer menú";
  });
  document.querySelector("#collapseList").addEventListener("click", () => {
    const collapsed = sidebar.classList.toggle("is-collapsed");
    document.querySelector("#collapseList").setAttribute("aria-label", collapsed ? "Mostrar lista de sistemas" : "Ocultar lista de sistemas");
  });
  let remainingSeconds = 56 * 60 + 15;
  window.setInterval(() => {
    if (remainingSeconds > 0) remainingSeconds -= 1;
    document.querySelector("#sessionTime").textContent = `${Math.floor(remainingSeconds / 60)} M : ${String(remainingSeconds % 60).padStart(2, "0")} S`;
  }, 1000);
}

async function initApp() {
  bindEvents();
  try {
    const data = await loadData();
    state.systems = data.systems;
    state.favoriteIds = new Set(data.systems.filter((system) => system.favorite).map((system) => system.id));
    state.riskLevels = data.riskLevels.map((level) => ({ label: level.label, color: `var(${level.colorVar})` }));
    state.processGroups = buildProcessGroups(data);
    data.macroprocesses.filter((macro) => macro.categoryId === "strategic").forEach((macro) => {
      state.strategicMacros.set(macro.id, { ...macro, processes: data.processes.filter((process) => process.macroprocessId === macro.id).map((process) => ({ name: process.label, risk: process.risk })) });
    });
    state.processGroups.forEach((level) => {
      (level.items || []).filter((item) => item.type === "macro").forEach((item) => state.processCatalog.set(item.id, { label: item.label, category: level.title }));
      (level.groups || []).forEach((group) => {
        [...group.items, ...group.subgroups.flatMap((subgroup) => subgroup.items)].forEach((item) => state.processCatalog.set(item.id, { label: item.label, category: `${level.title} · ${group.title}` }));
      });
    });
    data.categories.forEach((category) => {
      const level = state.processGroups.find((item) => item.id === category.id);
      const entries = category.id === "strategic" ? [...state.strategicMacros.values()].flatMap((macro) => macro.processes) : level.groups.flatMap((group) => [...group.items, ...group.subgroups.flatMap((subgroup) => subgroup.items)]);
      const offset = category.id === "mission" ? 1 : 2;
      state.categoryDetails.set(category.id, { label: category.title, description: category.description, processes: entries.map((entry, index) => ({ name: entry.name || entry.label, risk: entry.risk || state.riskLevels[(index + offset) % state.riskLevels.length].label })) });
    });
    renderSystems();
    renderWorkspace();
  } catch (error) {
    console.error(error);
    workspace.innerHTML = '<p class="workspace-label">No se pudo cargar data.json. Si abriste el archivo directamente (file://), sirve la carpeta con un servidor local e inténtalo de nuevo.</p>';
  }
}

initApp();
