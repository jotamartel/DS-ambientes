/* eslint-disable */
(function () {
  "use strict";

  // Initialize all blocks on the page (theme can have multiple).
  document.querySelectorAll(".dsa-projects[data-customer-id]:not([data-dsa-init])").forEach(initBlock);

  function initBlock(root) {
    root.dataset.dsaInit = "1";
    const app = root.querySelector(".dsa-app");
    if (!app) return; // user not logged in — block already showed login CTA

    const state = {
      view: "list", // "list" | "detail" | "search"
      projects: [],
      project: null,       // detail payload when in detail view
      search: { query: "", results: [], envId: null },
      currency: root.dataset.currency || "ARS",
      busy: false,
      error: null,
    };

    bootstrap();

    async function bootstrap() {
      try {
        const data = await api("GET", "/projects");
        state.projects = data.projects ?? [];
        state.view = "list";
      } catch (e) {
        state.error = e.message || "Error de carga";
      }
      render();
    }

    // ---- API ----
    async function api(method, path, body) {
      const opts = { method, headers: { Accept: "application/json" } };
      if (body !== undefined) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(`/apps/projects/api${path}`, opts);
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : null;
      if (!res.ok) {
        throw new Error((data && data.error) || `HTTP ${res.status}`);
      }
      return data;
    }

    // ---- Render dispatcher ----
    function render() {
      let html;
      if (state.error) {
        html = renderError();
      } else if (state.view === "list") {
        html = renderList();
      } else if (state.view === "detail") {
        html = renderDetail();
      } else if (state.view === "search") {
        html = renderSearch();
      }
      app.innerHTML = html;
      attachEvents();
    }

    function renderError() {
      return `
        <div class="dsa-error">${esc(state.error)}</div>
        <button class="dsa-btn" data-action="retry">Reintentar</button>
      `;
    }

    // ---- List view ----
    function renderList() {
      const totalProjects = state.projects.length;

      const items = totalProjects === 0
        ? `<div class="dsa-empty"><p class="dsa-empty-text">Todavía no tenés proyectos.</p><p class="dsa-muted">Creá uno usando el formulario de arriba.</p></div>`
        : `<ul class="dsa-list">${state.projects.map(p => {
            const meta = [
              `${p.environmentCount} ambiente${p.environmentCount === 1 ? "" : "s"}`,
              `${p.itemCount} producto${p.itemCount === 1 ? "" : "s"}`,
              formatRelative(p.updatedAt),
            ];
            const totalDisplay = (p.totalAmount && p.totalAmount > 0)
              ? `<div class="dsa-list-total-amount">${formatPrice(p.totalAmount, p.currencyCode || state.currency)}</div>
                 ${p.totalAmountUsd && p.totalAmountUsd > 0
                   ? `<div class="dsa-list-total-usd">${formatPrice(p.totalAmountUsd, "USD", 2)}</div>`
                   : ""}
                 <div class="dsa-list-total-label">Total estimado</div>`
              : `<div class="dsa-list-total-label">Sin productos</div>`;
            return `
              <li class="dsa-list-item" data-action="open" data-id="${esc(p.id)}">
                <div>
                  <strong class="dsa-list-name">${esc(p.name)}</strong>
                  <div class="dsa-list-meta">${meta.map(m => `<span>${esc(m)}</span>`).join("")}</div>
                </div>
                <div class="dsa-list-total">${totalDisplay}</div>
              </li>
            `;
          }).join("")}</ul>`;

      const heading = totalProjects === 0
        ? "Todavía no creaste ningún proyecto"
        : `${totalProjects} proyecto${totalProjects === 1 ? "" : "s"}`;

      return `
        <div class="dsa-page-header">
          <div>
            <p class="dsa-page-subtitle">${esc(heading)}</p>
          </div>
        </div>

        <form class="dsa-card" data-action="create" style="margin-bottom: 16px;">
          <div class="dsa-stack">
            <label class="dsa-label" for="dsa-new-name">Nuevo proyecto</label>
            <div class="dsa-inline-form">
              <input id="dsa-new-name" name="name" class="dsa-input" placeholder="Ej: Casa A — Reforma cocina" required maxlength="120" />
              <button type="submit" class="dsa-btn dsa-btn-primary" ${state.busy ? "disabled" : ""}>
                ${state.busy ? "Creando..." : "Crear proyecto"}
              </button>
            </div>
          </div>
        </form>

        ${items}
      `;
    }

    function formatPrice(amount, currency, fractionDigits) {
      const num = Number(amount) || 0;
      const cur = currency || "ARS";
      const fd = typeof fractionDigits === "number" ? fractionDigits : 0;
      try {
        return new Intl.NumberFormat("es-AR", {
          style: "currency", currency: cur,
          minimumFractionDigits: fd, maximumFractionDigits: fd,
        }).format(num);
      } catch (_) {
        return `${cur} ${num.toFixed(fd)}`;
      }
    }

    function formatRelative(iso) {
      try {
        const then = new Date(iso).getTime();
        const now = Date.now();
        const diff = Math.max(0, now - then);
        const min = Math.floor(diff / 60000);
        if (min < 1) return "ahora";
        if (min < 60) return `hace ${min} min`;
        const h = Math.floor(min / 60);
        if (h < 24) return `hace ${h} h`;
        const d = Math.floor(h / 24);
        if (d < 7) return `hace ${d} día${d === 1 ? "" : "s"}`;
        const w = Math.floor(d / 7);
        if (w < 5) return `hace ${w} semana${w === 1 ? "" : "s"}`;
        const mo = Math.floor(d / 30);
        return `hace ${mo} mes${mo === 1 ? "" : "es"}`;
      } catch (_) { return ""; }
    }

    // ---- Detail view ----
    function renderDetail() {
      const p = state.project;
      if (!p) return "";
      const proj = p.project;
      const totalItems = p.environments.reduce((s, e) => s + e.items.length, 0);
      const currency = proj.currencyCode || state.currency;
      const total = proj.totalAmount || 0;

      const envsHtml = p.environments.length === 0
        ? `<div class="dsa-empty"><p class="dsa-empty-text">Todavía no agregaste ambientes.</p></div>`
        : p.environments.map(env => renderEnv(env, currency)).join("");

      return `
        <div class="dsa-toolbar">
          <button class="dsa-link" data-action="back">← Mis proyectos</button>
        </div>

        <div class="dsa-detail-header">
          <div style="flex:1; min-width: 240px;">
            <h1 class="dsa-detail-title">${esc(proj.name)}</h1>
            ${proj.clientName ? `<p class="dsa-detail-client">${esc(proj.clientName)}</p>` : ""}
          </div>
          <div class="dsa-detail-actions">
            <button class="dsa-btn dsa-btn-sm" data-action="duplicate">Duplicar</button>
            <button class="dsa-btn dsa-btn-sm" data-action="${proj.archived ? "unarchive" : "archive"}">
              ${proj.archived ? "Desarchivar" : "Archivar"}
            </button>
            <button class="dsa-btn dsa-btn-sm dsa-btn-danger" data-action="delete">Eliminar</button>
          </div>
        </div>

        <div class="dsa-stats">
          <div class="dsa-stat">
            <p class="dsa-stat-label">Ambientes</p>
            <p class="dsa-stat-value">${p.environments.length}</p>
          </div>
          <div class="dsa-stat">
            <p class="dsa-stat-label">Productos</p>
            <p class="dsa-stat-value">${totalItems}</p>
          </div>
          <div class="dsa-stat dsa-stat-highlight">
            <p class="dsa-stat-label">Total estimado</p>
            <p class="dsa-stat-value">${total > 0 ? formatPrice(total, currency) : "—"}</p>
            ${proj.totalAmountUsd && proj.totalAmountUsd > 0
              ? `<p class="dsa-stat-secondary">${formatPrice(proj.totalAmountUsd, "USD", 2)}</p>`
              : ""}
          </div>
          <div class="dsa-stat">
            <p class="dsa-stat-label">Actualizado</p>
            <p class="dsa-stat-value" style="font-size:14px; font-weight:500;">${esc(formatRelative(proj.updatedAt))}</p>
          </div>
        </div>

        <form class="dsa-card" data-action="rename" style="margin-bottom: 12px;">
          <div class="dsa-stack">
            <label class="dsa-label">Nombre del proyecto</label>
            <div class="dsa-inline-form">
              <input name="name" class="dsa-input" value="${esc(proj.name)}" maxlength="120" required />
              <button type="submit" class="dsa-btn dsa-btn-sm">Guardar</button>
            </div>
          </div>
        </form>

        <div class="dsa-share">
          <strong class="dsa-h3">Compartir con cliente</strong>
          ${proj.shareUrl
            ? `<div class="dsa-share-row">
                 <input class="dsa-input" readonly value="${esc(proj.shareUrl)}" data-action="select-share" />
                 <button class="dsa-btn dsa-btn-sm" data-action="share-revoke">Revocar</button>
               </div>`
            : `<p class="dsa-muted" style="margin: 8px 0 12px;">Generá un enlace público que tu cliente pueda abrir para ver la propuesta.</p>
               <button class="dsa-btn dsa-btn-sm" data-action="share-generate">Generar enlace</button>`
          }
        </div>

        <form class="dsa-card dsa-card-tight" data-action="env-create" style="margin-bottom: 12px;">
          <div class="dsa-inline-form">
            <input name="name" class="dsa-input" placeholder="Nuevo ambiente (ej: Cocina)" required maxlength="80" />
            <button type="submit" class="dsa-btn">+ Agregar ambiente</button>
          </div>
        </form>

        ${envsHtml}

        ${totalItems > 0 ? `
          <div class="dsa-summary">
            <div class="dsa-summary-left">
              <span class="dsa-summary-label">Total · ${totalItems} productos</span>
              <span class="dsa-summary-total">${total > 0 ? formatPrice(total, currency) : "—"}</span>
              ${proj.totalAmountUsd && proj.totalAmountUsd > 0
                ? `<span class="dsa-summary-total-usd">${formatPrice(proj.totalAmountUsd, "USD", 2)}</span>`
                : ""}
            </div>
            <button class="dsa-btn dsa-btn-primary" data-action="cart-project">
              Agregar todo al carrito
            </button>
          </div>
        ` : ""}
      `;
    }

    function renderEnv(env, currency) {
      const subtotal = env.subtotal || 0;
      const subtotalUsd = env.subtotalUsd;
      const subtotalHtml = subtotal > 0
        ? `<span class="dsa-env-subtotal">${formatPrice(subtotal, currency)}${
            subtotalUsd && subtotalUsd > 0
              ? `<span class="dsa-env-subtotal-usd"> · ${formatPrice(subtotalUsd, "USD", 2)}</span>`
              : ""
          }</span>`
        : "";
      return `
        <article class="dsa-environment" data-env-id="${esc(env.id)}">
          <header class="dsa-env-header">
            <div class="dsa-env-header-left">
              <h3 class="dsa-env-name">${esc(env.name)}</h3>
              ${subtotalHtml}
            </div>
            <div class="dsa-env-actions">
              <button class="dsa-btn dsa-btn-sm dsa-btn-ghost" data-action="env-rename" data-id="${esc(env.id)}">Renombrar</button>
              <button class="dsa-btn dsa-btn-sm dsa-btn-ghost" data-action="env-duplicate" data-id="${esc(env.id)}">Duplicar</button>
              <button class="dsa-btn dsa-btn-sm dsa-btn-ghost dsa-btn-danger" data-action="env-delete" data-id="${esc(env.id)}">Eliminar</button>
            </div>
          </header>
          <div class="dsa-env-body">
            <div class="dsa-env-toolbar">
              <button class="dsa-btn dsa-btn-sm" data-action="search-open" data-env-id="${esc(env.id)}">+ Agregar producto</button>
              ${env.items.length > 0 ? `
                <button class="dsa-btn dsa-btn-sm dsa-btn-ghost" data-action="cart-env" data-env-id="${esc(env.id)}">
                  Agregar este ambiente al carrito
                </button>
              ` : ""}
            </div>
            ${env.items.length === 0
              ? `<p class="dsa-muted" style="padding: 8px 0;">Sin productos en este ambiente.</p>`
              : env.items.map(item => renderItem(item)).join("")
            }
          </div>
        </article>
      `;
    }

    function renderItem(item) {
      const live = item.live;
      const priceText = live ? formatPrice(parseFloat(live.price.amount), live.price.currencyCode) : null;
      const usdText = live && live.priceUsd
        ? formatPrice(parseFloat(live.priceUsd.amount), live.priceUsd.currencyCode, 2)
        : null;
      return `
        <div class="dsa-item" data-item-id="${esc(item.id)}">
          ${live && live.imageUrl
            ? `<img class="dsa-product-img" src="${esc(live.imageUrl)}" alt="${esc(live.imageAlt || "")}" loading="lazy" />`
            : `<div class="dsa-product-img"></div>`
          }
          <div class="dsa-product-info">
            ${live ? `
              <p class="dsa-product-title">${esc(live.productTitle)}</p>
              ${live.variantTitle ? `<p class="dsa-product-variant">${esc(live.variantTitle)}</p>` : ""}
              <p class="dsa-product-price">${esc(priceText || "")}</p>
              ${usdText ? `<p class="dsa-product-price-usd">${esc(usdText)}</p>` : ""}
              ${!live.available ? `<p class="dsa-unavailable">Sin stock</p>` : ""}
            ` : `
              <p class="dsa-unavailable">Producto no disponible</p>
            `}
          </div>
          <div class="dsa-item-actions">
            <input type="number" class="dsa-input dsa-qty" min="1" max="9999" value="${item.quantity}"
                   data-action="item-qty" data-id="${esc(item.id)}" />
            <button class="dsa-btn dsa-btn-sm dsa-btn-ghost dsa-btn-danger" data-action="item-delete" data-id="${esc(item.id)}">Quitar</button>
          </div>
          ${item.note ? `<p class="dsa-note">${esc(item.note)}</p>` : ""}
        </div>
      `;
    }

    // ---- Search view ----
    function renderSearch() {
      return `
        <div class="dsa-toolbar">
          <button class="dsa-link" data-action="search-close">← Volver al proyecto</button>
        </div>
        <form class="dsa-card" data-action="search-submit" onsubmit="return false">
          <input
            name="q"
            class="dsa-input dsa-search-input"
            placeholder="Buscar productos..."
            value="${esc(state.search.query)}"
            autofocus
            autocomplete="off"
            spellcheck="false"
          />
        </form>
        <div class="dsa-search-results">${renderSearchResults()}</div>
      `;
    }

    function renderSearchResults() {
      if (state.search.busy) {
        return `<p class="dsa-muted">Buscando...</p>`;
      }
      const q = state.search.query.trim();
      if (q.length === 0) return `<p class="dsa-muted">Escribí para buscar productos.</p>`;
      if (q.length < 2) return `<p class="dsa-muted">Escribí al menos 2 caracteres.</p>`;
      if (state.search.results.length === 0) return `<p class="dsa-muted">Sin resultados.</p>`;
      return state.search.results.map(p => `
        <article class="dsa-card">
          <div class="dsa-product">
            ${p.imageUrl
              ? `<img class="dsa-product-img" src="${esc(p.imageUrl)}" alt="" loading="lazy" />`
              : `<div class="dsa-product-img"></div>`
            }
            <div class="dsa-product-info">
              <p class="dsa-product-title">${esc(p.productTitle)}</p>
            </div>
          </div>
          <div class="dsa-stack">
            ${p.variants.map(v => `
              <button class="dsa-row dsa-row-spread dsa-variant-btn"
                      data-action="search-add"
                      data-product-id="${esc(p.productId)}"
                      data-variant-id="${esc(v.variantId)}"
                      data-product-handle="${esc(p.productHandle || "")}">
                <span>
                  ${v.variantTitle === "Default Title" ? esc(p.productTitle) : esc(v.variantTitle)}
                  <span class="dsa-muted"> — ${esc(formatPrice(parseFloat(v.price.amount), v.price.currencyCode))}</span>
                  ${v.priceUsd ? `<span class="dsa-muted"> · ${esc(formatPrice(parseFloat(v.priceUsd.amount), v.priceUsd.currencyCode, 2))}</span>` : ""}
                  ${!v.available ? `<span class="dsa-unavailable"> · Sin stock</span>` : ""}
                </span>
                <span class="dsa-chevron">+</span>
              </button>
            `).join("")}
          </div>
        </article>
      `).join("");
    }

    let searchTimer = null;
    let searchAbort = null;

    async function runLiveSearch(rawQuery) {
      const q = rawQuery.trim();
      state.search.query = rawQuery;
      if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; }
      if (searchAbort) { try { searchAbort.abort(); } catch(_) {} searchAbort = null; }

      if (q.length < 2) {
        state.search.results = [];
        state.search.busy = false;
        updateSearchResultsDom();
        return;
      }

      state.search.busy = true;
      updateSearchResultsDom();

      searchTimer = setTimeout(async () => {
        searchAbort = new AbortController();
        try {
          const res = await fetch(
            `/apps/projects/api/products?q=${encodeURIComponent(q)}`,
            { signal: searchAbort.signal, headers: { Accept: "application/json" } },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          state.search.results = data.results || [];
          state.search.busy = false;
          updateSearchResultsDom();
        } catch (e) {
          if (e && e.name === "AbortError") return;
          state.search.busy = false;
          state.search.results = [];
          updateSearchResultsDom();
        }
      }, 250);
    }

    function updateSearchResultsDom() {
      const container = app.querySelector(".dsa-search-results");
      if (!container) return;
      container.innerHTML = renderSearchResults();
      // Re-bind clicks on the freshly rendered variant buttons.
      container.querySelectorAll('[data-action="search-add"]').forEach(btn => {
        btn.addEventListener("click", (e) => handleClick("search-add", btn, e));
      });
    }

    // ---- Event handling ----
    function attachEvents() {
      // Generic data-action click dispatcher
      app.querySelectorAll("[data-action]").forEach(el => {
        const action = el.dataset.action;
        if (el.tagName === "FORM") {
          el.addEventListener("submit", (e) => {
            e.preventDefault();
            handleSubmit(action, el);
          });
        } else if (el.tagName === "INPUT" && action === "item-qty") {
          el.addEventListener("change", () => onItemQtyChange(el.dataset.id, Number(el.value)));
        } else if (el.tagName === "INPUT" && action === "select-share") {
          el.addEventListener("focus", (e) => e.target.select());
        } else {
          el.addEventListener("click", (e) => {
            handleClick(action, el, e);
          });
        }
      });

      // Live-search input: debounced fetch as the user types.
      const searchInput = app.querySelector(".dsa-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => runLiveSearch(e.target.value));
        // If we already have a query (e.g. came back from detail), kick off a search now.
        if (state.search.query.trim().length >= 2 && state.search.results.length === 0) {
          runLiveSearch(state.search.query);
        }
      }
    }

    let tempCounter = 0;
    const tempId = () => `temp-${Date.now()}-${++tempCounter}`;

    async function handleClick(action, el, ev) {
      ev.stopPropagation();
      const proj = () => state.project && state.project.project;

      switch (action) {
        case "retry":
          state.error = null; await bootstrap(); return;

        case "open":
          await openProject(el.dataset.id); return;

        case "back": {
          state.view = "list"; state.project = null; render();
          // Refresh list lazily in background — display is already correct from last render.
          api("GET", "/projects").then((d) => {
            state.projects = d.projects ?? [];
            render();
          }).catch(() => {});
          return;
        }

        case "duplicate": {
          // Hard to optimistic-create a project with all data. Just call API and open.
          try {
            const r = await api("POST", `/projects/${proj().id}`, { intent: "duplicate" });
            await openProject(r.project.id);
          } catch (e) { alert(e.message); }
          return;
        }

        case "archive":
          // Optimistic: leave list, then API
          state.view = "list"; state.project = null; render();
          api("POST", `/projects/${el.dataset.id || (proj() && proj().id)}`, { intent: "archive" })
            .then(() => api("GET", "/projects"))
            .then((d) => { state.projects = d.projects ?? []; render(); })
            .catch((e) => alert(e.message));
          return;

        case "unarchive": {
          state.project.project.archived = false; render();
          api("POST", `/projects/${proj().id}`, { intent: "unarchive" })
            .catch((e) => { state.project.project.archived = true; render(); alert(e.message); });
          return;
        }

        case "delete": {
          if (!confirm("¿Eliminar el proyecto?")) return;
          const id = proj().id;
          state.view = "list"; state.project = null;
          state.projects = state.projects.filter((p) => p.id !== id);
          render();
          api("DELETE", `/projects/${id}`).catch((e) => alert(e.message));
          return;
        }

        case "share-generate": {
          try {
            const r = await api("POST", `/projects/${proj().id}`, { intent: "share-generate" });
            state.project.project.shareUrl = r.shareUrl;
            state.project.project.shareToken = r.shareToken;
            render();
          } catch (e) { alert(e.message); }
          return;
        }

        case "share-revoke": {
          const oldUrl = state.project.project.shareUrl;
          const oldToken = state.project.project.shareToken;
          state.project.project.shareUrl = null;
          state.project.project.shareToken = null;
          render();
          api("POST", `/projects/${proj().id}`, { intent: "share-revoke" })
            .catch((e) => {
              state.project.project.shareUrl = oldUrl;
              state.project.project.shareToken = oldToken;
              render(); alert(e.message);
            });
          return;
        }

        case "env-rename": {
          const env = state.project.environments.find((e) => e.id === el.dataset.id);
          const newName = prompt("Nuevo nombre del ambiente", env ? env.name : "");
          if (!newName || newName.trim() === "" || !env) return;
          const oldName = env.name;
          env.name = newName.trim(); render();
          api("POST", `/projects/${proj().id}/environments`, {
            intent: "rename", environmentId: env.id, name: env.name,
          }).catch((e) => { env.name = oldName; render(); alert(e.message); });
          return;
        }

        case "env-duplicate": {
          const src = state.project.environments.find((e) => e.id === el.dataset.id);
          if (!src) return;
          const tempEnv = {
            id: tempId(),
            name: src.name + " (copia)",
            sortOrder: state.project.environments.length,
            items: src.items.map((i) => ({ ...i, id: tempId() })),
          };
          state.project.environments.push(tempEnv); render();
          try {
            const r = await api("POST", `/projects/${proj().id}/environments`, {
              intent: "duplicate", environmentId: src.id,
            });
            // Reconcile: replace tempEnv with real one. Map items by index (server preserves order).
            tempEnv.id = r.environment.id;
            tempEnv.name = r.environment.name;
            tempEnv.sortOrder = r.environment.sortOrder;
            const respItems = r.environment.items || [];
            tempEnv.items = respItems.map((it, idx) => ({
              id: it.id,
              variantId: it.variantId,
              quantity: it.quantity,
              note: it.note,
              live: src.items[idx] ? src.items[idx].live : null,
            }));
            render();
          } catch (e) {
            state.project.environments = state.project.environments.filter((e) => e !== tempEnv);
            render(); alert(e.message);
          }
          return;
        }

        case "env-delete": {
          if (!confirm("¿Eliminar el ambiente y todos sus productos?")) return;
          const envId = el.dataset.id;
          const idx = state.project.environments.findIndex((e) => e.id === envId);
          if (idx === -1) return;
          const removed = state.project.environments[idx];
          state.project.environments.splice(idx, 1); render();
          api("POST", `/projects/${proj().id}/environments`, {
            intent: "delete", environmentId: envId,
          }).catch((e) => {
            state.project.environments.splice(idx, 0, removed); render(); alert(e.message);
          });
          return;
        }

        case "search-open":
          state.view = "search";
          state.search = { query: "", results: [], envId: el.dataset.envId };
          render(); return;

        case "search-close":
          state.view = "detail"; render(); return;

        case "search-add": {
          const productId = el.dataset.productId;
          const variantId = el.dataset.variantId;
          const productHandle = el.dataset.productHandle || null;

          // Pull live data straight from search results (we already have everything).
          let liveData = null;
          for (const p of state.search.results) {
            if (p.productId === productId) {
              const v = p.variants.find((vv) => vv.variantId === variantId);
              if (v) {
                liveData = {
                  variantId, productId,
                  productTitle: p.productTitle,
                  productHandle: p.productHandle,
                  variantTitle: v.variantTitle === "Default Title" ? null : v.variantTitle,
                  price: v.price,
                  available: v.available,
                  imageUrl: p.imageUrl,
                  imageAlt: null,
                };
              }
              break;
            }
          }

          const env = state.project.environments.find((e) => e.id === state.search.envId);
          if (!env) return;

          const tempItem = {
            id: tempId(),
            variantId, quantity: 1, note: null,
            live: liveData,
          };
          env.items.push(tempItem);
          state.view = "detail"; render();

          api("POST", `/projects/${proj().id}/items`, {
            intent: "add",
            environmentId: env.id,
            productId, variantId, productHandle,
            quantity: 1,
          }).then((r) => {
            tempItem.id = r.item.id;
          }).catch((e) => {
            const i = env.items.indexOf(tempItem);
            if (i !== -1) env.items.splice(i, 1);
            render(); alert(e.message);
          });
          return;
        }

        case "item-delete": {
          if (!confirm("¿Quitar este producto?")) return;
          const itemId = el.dataset.id;
          let containerEnv = null, removedItem = null, removedIdx = -1;
          for (const env of state.project.environments) {
            const idx = env.items.findIndex((i) => i.id === itemId);
            if (idx !== -1) {
              containerEnv = env; removedItem = env.items[idx]; removedIdx = idx;
              env.items.splice(idx, 1); break;
            }
          }
          if (!removedItem) return;
          render();
          api("POST", `/projects/${proj().id}/items`, {
            intent: "delete", itemId,
          }).catch((e) => {
            containerEnv.items.splice(removedIdx, 0, removedItem);
            render(); alert(e.message);
          });
          return;
        }

        case "cart-project": {
          try {
            const r = await api("POST", `/projects/${proj().id}/cart`, { scope: "project" });
            window.location.href = r.checkoutUrl;
          } catch (e) { alert(e.message); }
          return;
        }
        case "cart-env": {
          try {
            const r = await api("POST", `/projects/${proj().id}/cart`, {
              scope: "environment", environmentId: el.dataset.envId,
            });
            window.location.href = r.checkoutUrl;
          } catch (e) { alert(e.message); }
          return;
        }
      }
    }

    async function handleSubmit(action, form) {
      const data = formData(form);
      const proj = () => state.project && state.project.project;

      switch (action) {
        case "create": {
          const name = String(data.name || "").trim();
          if (!name) return;
          // Optimistic: append to list, navigate to detail with empty payload until API responds.
          const placeholder = { id: tempId(), name, environmentCount: 0, itemCount: 0 };
          state.projects.unshift(placeholder);
          render();
          try {
            const r = await api("POST", "/projects", { name });
            placeholder.id = r.project.id;
            await openProject(r.project.id);
          } catch (e) {
            state.projects = state.projects.filter((p) => p !== placeholder);
            render(); alert(e.message);
          }
          return;
        }

        case "rename": {
          const name = String(data.name || "").trim();
          if (!name) return;
          const oldName = proj().name;
          state.project.project.name = name; render();
          api("POST", `/projects/${proj().id}`, { intent: "rename", name })
            .catch((e) => { state.project.project.name = oldName; render(); alert(e.message); });
          return;
        }

        case "env-create": {
          const name = String(data.name || "").trim();
          if (!name) return;
          // Reset the input value optimistically too.
          const input = form.querySelector('input[name="name"]');
          if (input) input.value = "";
          const tempEnv = {
            id: tempId(), name,
            sortOrder: state.project.environments.length,
            items: [],
          };
          state.project.environments.push(tempEnv); render();
          try {
            const r = await api("POST", `/projects/${proj().id}/environments`, {
              intent: "create", name,
            });
            tempEnv.id = r.environment.id;
            tempEnv.sortOrder = r.environment.sortOrder;
          } catch (e) {
            state.project.environments = state.project.environments.filter((e) => e !== tempEnv);
            render(); alert(e.message);
          }
          return;
        }

        case "search-submit": {
          // Form submit is mostly for Enter key — re-trigger live search.
          runLiveSearch(String(data.q || ""));
          return;
        }
      }
    }

    async function onItemQtyChange(itemId, quantity) {
      if (!Number.isInteger(quantity) || quantity < 1) return;
      let target = null;
      let oldQty = 0;
      for (const env of state.project.environments) {
        const found = env.items.find((i) => i.id === itemId);
        if (found) { target = found; oldQty = found.quantity; found.quantity = quantity; break; }
      }
      if (!target) return;
      // Don't re-render — the input already has the new value.
      api("POST", `/projects/${state.project.project.id}/items`, {
        intent: "update", itemId, quantity,
      }).catch((e) => {
        target.quantity = oldQty;
        render(); alert(e.message);
      });
    }

    async function openProject(id) {
      const data = await api("GET", `/projects/${id}`);
      state.project = data;
      state.view = "detail";
      render();
    }

    function formData(form) {
      const obj = {};
      new FormData(form).forEach((v, k) => { obj[k] = v; });
      return obj;
    }

    function esc(s) {
      if (s == null) return "";
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
  }
})();
