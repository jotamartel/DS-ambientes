/* eslint-disable */
(function () {
  "use strict";

  document.querySelectorAll(".dsa-projects[data-customer-id]:not([data-dsa-init])").forEach(initBlock);

  function initBlock(root) {
    root.dataset.dsaInit = "1";
    const app = root.querySelector(".dsa-app");
    if (!app) return;

    const i18n = (() => {
      // Read translations baked into the dom (we cheat — use textContent of templates / hidden spans if needed).
      // For now we hard-code the few strings the JS produces. Add a hidden i18n map later if needed.
      return {
        "list.empty": (root.dataset.emptyText || "¡No tienes proyectos creados!"),
        "list.count_one": "1 producto",
        "list.count_other": "{n} productos",
        "list.ver_detalle": "Ver detalle",
        "detail.back": "← Mis proyectos",
        "detail.new_env": "Nuevo ambiente",
        "detail.ambientes": "Ambientes",
        "detail.productos": "Productos",
        "detail.total": "Total estimado",
        "detail.updated": "Actualizado",
        "detail.name_label": "Nombre del proyecto",
        "detail.save": "Guardar",
        "detail.duplicate": "Duplicar",
        "detail.archive": "Archivar",
        "detail.unarchive": "Desarchivar",
        "detail.delete": "Eliminar",
        "detail.share_title": "Compartir con cliente",
        "detail.share_generate": "Crear enlace",
        "detail.share_revoke": "Revocar",
        "detail.share_intro": "Generá un enlace público para que tu cliente vea la propuesta.",
        "detail.env_no_envs": "Todavía no agregaste ambientes.",
        "env.name_label": "Nombre del ambiente",
        "env.rename": "Renombrar",
        "env.delete": "Eliminar ambiente",
        "env.add_product": "+ Agregar producto",
        "env.cart": "Agregar al carrito",
        "env.no_items": "Sin productos en este ambiente.",
        "item.qty": "Cantidad",
        "item.qty_m2": "m²",
        "item.boxes": "≈ {n} cajas",
        "item.save": "Guardar",
        "item.remove": "Quitar",
        "item.unavailable": "Producto no disponible",
        "item.oos": "Sin stock",
        "search.title": "Agrega productos",
        "search.back": "← Mis ambientes",
        "search.placeholder": "Buscar productos...",
        "search.add_product": "Agregar producto",
        "search.prompt": "Escribí para buscar productos.",
        "search.too_short": "Escribí al menos 2 caracteres.",
        "search.busy": "Buscando...",
        "search.empty": "Sin resultados.",
        "qty.units_label": "Unidades",
        "qty.m2_label": "Metros cuadrados",
        "qty.rendimiento": "Rendimiento: {value} m² por caja",
        "qty.waste": "Sumar {pct}% de desperdicio",
        "qty.summary_m2": "Se agregan {qty} m²",
        "qty.boxes": " · equivale a {n} cajas",
        "qty.error": "No se pudo agregar el producto.",
        "suggest.title": "Pegamento sugerido",
        "suggest.for": "Para: {products}",
        "suggest.detail": "{qty} u. para {m2} m² · rinde {rend} m² por unidad",
        "suggest.add": "Agregar",
        "summary.label": "Total · {n} productos",
        "summary.cart_all": "Agregar todo al carrito",
        "confirm.delete_project": "¿Eliminar el proyecto?",
        "confirm.delete_env": "¿Eliminar el ambiente y todos sus productos?",
        "confirm.delete_item": "¿Quitar este producto?",
        "files.title": "Archivos del proyecto",
        "files.subtitle": "Subí imágenes o PDFs relacionados con tu proyecto (máx. 10 MB cada uno).",
        "files.upload": "Subir archivo",
        "files.uploading": "Subiendo {name}...",
        "files.empty": "Todavía no agregaste archivos.",
        "files.delete": "Eliminar archivo",
        "files.confirm_delete": "¿Eliminar este archivo?",
        "files.error_size": "El archivo supera el tamaño máximo de 10 MB.",
        "files.error_type": "Tipo de archivo no permitido. Solo imágenes y PDF.",
        "files.error_upload": "No se pudo subir el archivo.",
      };
    })();

    const state = {
      view: "list",        // "list" | "detail" | "search" | "error"
      projects: [],
      project: null,
      search: { query: "", results: [], busy: false, envId: null },
      currency: root.dataset.currency || "ARS",
      busy: false,
      error: null,
      pendingQty: {},      // itemId → qty waiting to be saved by user
    };

    const wastePct = (() => {
      const n = parseInt(String(root.dataset.wastePct ?? "").trim(), 10);
      if (!Number.isFinite(n) || n < 0) return 10;
      return Math.min(100, n);
    })();

    bindRootEvents();
    bootstrap();

    function setView(view) {
      state.view = view;
      root.dataset.state = view;
    }

    async function bootstrap() {
      setView("loading");
      try {
        const data = await api("GET", "/projects");
        state.projects = data.projects ?? [];
        const deepLinkId = new URLSearchParams(location.search).get("project");
        if (deepLinkId && state.projects.some((p) => p.id === deepLinkId)) {
          await openProject(deepLinkId);
          return;
        }
        setView("list");
      } catch (e) {
        state.error = e.message || "Error de carga";
        setView("error");
      }
      render();
    }

    async function api(method, path, body) {
      const opts = { method, headers: { Accept: "application/json" } };
      if (body !== undefined) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(`/apps/projects/api${path}`, opts);
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json().catch(() => null) : null;
      if (!res.ok || !data) {
        throw new Error((data && data.error) || (res.ok ? "Respuesta inválida del servidor" : `Error ${res.status}`));
      }
      return data;
    }

    function render() {
      if (state.error) {
        app.innerHTML = renderError();
      } else if (state.view === "loading") {
        // server-side loading wrapper, do nothing
      } else if (state.view === "list") {
        renderListInto(app);
      } else if (state.view === "detail") {
        recalcProject();
        app.innerHTML = renderDetail();
        paintFilesGrid();
      } else if (state.view === "search") {
        renderSearchInto(app);
      }
      attachEvents();
    }

    /* Recompute environment subtotals and project totals from items.
       Keeps the sticky total and stats card in sync after add/qty/delete
       without requiring a refetch. */
    function recalcProject() {
      if (!state.project) return;
      let projTotal = 0;
      let projTotalUsd = 0;
      for (const env of state.project.environments) {
        let envSubtotal = 0;
        let envSubtotalUsd = 0;
        for (const item of env.items) {
          const live = item.live;
          if (live && live.price) {
            envSubtotal += (parseFloat(live.price.amount) || 0) * item.quantity;
          }
          if (live && live.priceUsd) {
            envSubtotalUsd += (parseFloat(live.priceUsd.amount) || 0) * item.quantity;
          }
        }
        env.subtotal = envSubtotal;
        env.subtotalUsd = envSubtotalUsd;
        projTotal += envSubtotal;
        projTotalUsd += envSubtotalUsd;
      }
      state.project.project.totalAmount = projTotal;
      state.project.project.totalAmountUsd = projTotalUsd;
    }

    /* ------------------------------------------------------------
       Templates
       ------------------------------------------------------------ */
    function cloneTpl(name) {
      const tpl = root.querySelector(`template[data-dsa-tpl="${name}"]`);
      if (!tpl) throw new Error(`dsa: template not found: ${name}`);
      return tpl.content.cloneNode(true);
    }
    function cloneTplFirst(name) { return cloneTpl(name).firstElementChild; }

    /* ------------------------------------------------------------
       Error
       ------------------------------------------------------------ */
    function renderError() {
      return `
        <div class="dsa-error">${esc(state.error)}</div>
        <button class="dsa-btn dsa-btn-outline" data-action="retry">Reintentar</button>
      `;
    }

    /* ------------------------------------------------------------
       List view — empty wrapper or cards grid
       ------------------------------------------------------------ */
    function renderListInto(host) {
      if (state.projects.length === 0) {
        host.innerHTML = `
          <div class="dsa-wrapper">
            <p class="dsa-wrapper-text">${esc(i18n["list.empty"])}</p>
          </div>
        `;
        return;
      }

      const grid = document.createElement("div");
      grid.className = "dsa-projects-grid";
      for (const p of state.projects) {
        const card = cloneTplFirst("project-card");
        card.dataset.id = p.id;
        card.querySelector('[data-field="name"]').textContent = p.name;
        const count = p.itemCount === 1
          ? i18n["list.count_one"]
          : i18n["list.count_other"].replace("{n}", p.itemCount);
        card.querySelector('[data-field="count"]').textContent = count;
        grid.appendChild(card);
      }
      host.replaceChildren(grid);
    }

    /* ------------------------------------------------------------
       Detail view
       ------------------------------------------------------------ */
    function renderDetail() {
      const p = state.project;
      if (!p) return "";
      const proj = p.project;
      const totalItems = p.environments.reduce((s, e) => s + e.items.length, 0);
      const currency = proj.currencyCode || state.currency;
      const total = proj.totalAmount || 0;

      const envsHtml = p.environments.length === 0
        ? ""
        : p.environments.map((env) => renderEnv(env, currency)).join("");

      const shareHtml = proj.shareUrl
        ? `<div class="dsa-share-row">
             <input class="dsa-field-input" readonly value="${esc(proj.shareUrl)}" data-action="select-share" />
             <button type="button" class="dsa-btn dsa-btn-outline" data-action="share-revoke">${esc(i18n["detail.share_revoke"])}</button>
           </div>`
        : `<p style="color: var(--dsa-neutral-500); font-size: 14px; margin: 8px 0 12px;">${esc(i18n["detail.share_intro"])}</p>
           <button type="button" class="dsa-btn dsa-btn-pill-sm" data-action="share-generate">${esc(i18n["detail.share_generate"])}</button>`;

      return `
        <div class="dsa-detail-header">
          <div class="dsa-detail-title-wrap">
            <button type="button" class="dsa-detail-back" data-action="back">${esc(i18n["detail.back"])}</button>
            <h1 class="dsa-detail-title">${esc(proj.name)}</h1>
          </div>
          <button type="button" class="dsa-btn dsa-btn-primary" data-action="open-create-env">
            <span>${esc(i18n["detail.new_env"])}</span>
            ${iconPlus()}
          </button>
        </div>

        <div class="dsa-stats">
          <div class="dsa-stat">
            <p class="dsa-stat-label">${esc(i18n["detail.ambientes"])}</p>
            <p class="dsa-stat-value">${p.environments.length}</p>
          </div>
          <div class="dsa-stat dsa-stat-highlight">
            <p class="dsa-stat-label">${esc(i18n["detail.productos"])}</p>
            <p class="dsa-stat-value">${totalItems}</p>
          </div>
          <div class="dsa-stat">
            <p class="dsa-stat-label">${esc(i18n["detail.total"])}</p>
            <p class="dsa-stat-value">${total > 0 ? formatPrice(total, currency) : "—"}</p>
            ${proj.totalAmountUsd && proj.totalAmountUsd > 0
              ? `<p class="dsa-stat-secondary">${formatPrice(proj.totalAmountUsd, "USD", 2)}</p>`
              : ""}
          </div>
          <div class="dsa-stat">
            <p class="dsa-stat-label">${esc(i18n["detail.updated"])}</p>
            <p class="dsa-stat-value" style="font-size:14px;">${esc(formatRelative(proj.updatedAt))}</p>
          </div>
        </div>

        <form class="dsa-card" data-action="rename">
          <div class="dsa-editor-row">
            <label class="dsa-field">
              <span class="dsa-field-label">${esc(i18n["detail.name_label"])}</span>
              <input name="name" class="dsa-field-input" value="${esc(proj.name)}" maxlength="120" required />
            </label>
            <button type="submit" class="dsa-btn dsa-btn-pill-sm" data-dsa-rename-save disabled>${esc(i18n["detail.save"])}</button>
          </div>
          <div class="dsa-editor-actions">
            <button type="button" class="dsa-btn dsa-btn-outline" data-action="duplicate">${esc(i18n["detail.duplicate"])}</button>
            <button type="button" class="dsa-btn dsa-btn-outline" data-action="${proj.archived ? "unarchive" : "archive"}">
              ${esc(proj.archived ? i18n["detail.unarchive"] : i18n["detail.archive"])}
            </button>
            <button type="button" class="dsa-btn dsa-btn-danger" data-action="delete">${esc(i18n["detail.delete"])}</button>
          </div>
        </form>

        <div class="dsa-card dsa-share">
          <strong style="font-family: var(--dsa-font-body); font-weight: 700; font-size: 14px;">${esc(i18n["detail.share_title"])}</strong>
          ${shareHtml}
        </div>

        ${envsHtml}

        ${renderFilesCard()}

        ${totalItems > 0 ? `
          <div class="dsa-sticky-total">
            <div class="dsa-sticky-total-left">
              <span class="dsa-sticky-total-label">${esc(i18n["summary.label"].replace("{n}", totalItems))}</span>
              <span class="dsa-sticky-total-amount">
                ${formatPrice(total, currency)}
                ${proj.totalAmountUsd && proj.totalAmountUsd > 0
                  ? `<span class="dsa-sticky-total-usd">${formatPrice(proj.totalAmountUsd, "USD", 2)}</span>`
                  : ""}
              </span>
            </div>
            <button class="dsa-btn dsa-btn-primary" data-action="cart-project">
              ${esc(i18n["summary.cart_all"])}
            </button>
          </div>
        ` : ""}
      `;
    }

    function renderFilesCard() {
      const files = (state.project && state.project.files) || [];
      const uploading = state.uploadingName
        ? `<p class="dsa-files-uploading">${esc(i18n["files.uploading"].replace("{name}", state.uploadingName))}</p>`
        : "";
      const listHtml = files.length === 0
        ? `<p class="dsa-files-empty">${esc(i18n["files.empty"])}</p>`
        : `<div class="dsa-files-grid" data-dsa-files-grid></div>`;
      return `
        <div class="dsa-card dsa-files-card">
          <div class="dsa-files-header">
            <div>
              <strong class="dsa-files-title">${esc(i18n["files.title"])}</strong>
              <p class="dsa-files-subtitle">${esc(i18n["files.subtitle"])}</p>
            </div>
            <label class="dsa-btn dsa-btn-outline dsa-files-upload-btn">
              <span>${esc(i18n["files.upload"])}</span>
              <input type="file" accept="image/*,application/pdf" hidden data-action="file-input" />
            </label>
          </div>
          ${uploading}
          ${listHtml}
        </div>
      `;
    }

    function paintFilesGrid() {
      const host = app.querySelector("[data-dsa-files-grid]");
      if (!host) return;
      const files = (state.project && state.project.files) || [];
      host.replaceChildren();
      for (const f of files) {
        const card = cloneTplFirst("file-card");
        card.dataset.fileId = f.id;
        const link = card.querySelector('[data-field="link"]');
        link.href = f.url;
        const isImage = (f.mimeType || "").startsWith("image/");
        const thumb = card.querySelector('[data-field="thumb"]');
        const icon = card.querySelector('[data-field="icon"]');
        if (isImage) {
          thumb.src = f.url;
          thumb.alt = f.fileName;
          thumb.hidden = false;
          icon.remove();
        } else {
          thumb.remove();
          icon.textContent = "PDF";
        }
        card.querySelector('[data-field="name"]').textContent = f.fileName;
        card.querySelector('[data-field="meta"]').textContent = formatFileMeta(f);
        const del = card.querySelector('[data-action="file-delete"]');
        del.dataset.id = f.id;
        host.appendChild(card);
      }
    }

    function formatFileMeta(file) {
      const size = formatFileSize(file.sizeBytes || 0);
      return size;
    }

    function formatFileSize(bytes) {
      if (!bytes) return "";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

    const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    const MAX_BYTES = 10 * 1024 * 1024;

    async function onFilePicked(input) {
      const file = input.files && input.files[0];
      input.value = ""; // allow re-picking the same file
      if (!file) return;
      if (!ALLOWED_MIME.includes(file.type)) { alert(i18n["files.error_type"]); return; }
      if (file.size > MAX_BYTES) { alert(i18n["files.error_size"]); return; }

      const projId = state.project.project.id;
      state.uploadingName = file.name;
      render();
      try {
        const staged = await api("POST", `/projects/${projId}/files`, {
          intent: "staged-upload",
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        });
        await uploadToStagedTarget(staged.target, file);
        const created = await api("POST", `/projects/${projId}/files`, {
          intent: "create",
          resourceUrl: staged.target.resourceUrl,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        });
        if (!state.project.files) state.project.files = [];
        state.project.files.unshift(created.file);
      } catch (e) {
        alert(e.message || i18n["files.error_upload"]);
      } finally {
        state.uploadingName = null;
        render();
      }
    }

    async function uploadToStagedTarget(target, file) {
      const form = new FormData();
      for (const p of target.parameters) form.append(p.name, p.value);
      form.append("file", file);
      const res = await fetch(target.url, { method: "POST", body: form });
      if (!res.ok && res.status !== 201 && res.status !== 204) {
        throw new Error(i18n["files.error_upload"]);
      }
    }

    async function onFileDelete(fileId) {
      if (!confirm(i18n["files.confirm_delete"])) return;
      const files = state.project.files || [];
      const idx = files.findIndex((f) => f.id === fileId);
      if (idx === -1) return;
      const removed = files[idx];
      files.splice(idx, 1);
      render();
      try {
        await api("DELETE", `/projects/${state.project.project.id}/files/${fileId}`);
      } catch (e) {
        files.splice(idx, 0, removed);
        render();
        alert(e.message);
      }
    }

    function renderEnv(env, currency) {
      const subtotal = env.subtotal || 0;
      const subtotalUsd = env.subtotalUsd;
      const subtotalHtml = subtotal > 0
        ? `<p class="dsa-env-subtotal">${formatPrice(subtotal, currency)}${
            subtotalUsd && subtotalUsd > 0
              ? `<span class="dsa-env-subtotal-usd">${formatPrice(subtotalUsd, "USD", 2)}</span>`
              : ""
          }</p>`
        : "";
      return `
        <article class="dsa-environment" data-env-id="${esc(env.id)}">
          <header class="dsa-env-header">
            <div>
              <h3 class="dsa-env-name">${esc(env.name)}</h3>
              ${subtotalHtml}
            </div>
            <button type="button" class="dsa-link dsa-link-danger" data-action="env-delete" data-id="${esc(env.id)}">
              ${iconTrash()}
              <span>${esc(i18n["env.delete"])}</span>
            </button>
          </header>

          <form class="dsa-env-rename-row" data-action="env-rename" data-id="${esc(env.id)}">
            <label class="dsa-field">
              <span class="dsa-field-label">${esc(i18n["env.name_label"])}</span>
              <input name="name" class="dsa-field-input" value="${esc(env.name)}" maxlength="80" required />
            </label>
            <button type="submit" class="dsa-btn dsa-btn-pill-sm" data-dsa-env-rename-save disabled>${esc(i18n["env.rename"])}</button>
          </form>

          <div class="dsa-env-toolbar">
            <button type="button" class="dsa-btn dsa-btn-outline" data-action="search-open" data-env-id="${esc(env.id)}">
              ${esc(i18n["env.add_product"])}
            </button>
            ${env.items.length > 0 ? `
              <button type="button" class="dsa-btn dsa-btn-primary" data-action="cart-env" data-env-id="${esc(env.id)}">
                ${esc(i18n["env.cart"])}
              </button>
            ` : ""}
          </div>

          ${env.items.length === 0
            ? `<p style="color: var(--dsa-neutral-500); font-size: 14px;">${esc(i18n["env.no_items"])}</p>`
            : `<div class="dsa-items">${env.items.map((it) => renderItem(it)).join("")}</div>`
          }

          ${renderPegamentoSuggestions(env)}
        </article>
      `;
    }

    /**
     * Adhesive rows the server worked out for this environment: one per glue,
     * with the bags needed for the pooled area. Purely a suggestion — nothing
     * is added until the customer asks for it.
     */
    function renderPegamentoSuggestions(env) {
      const list = env.pegamentoSuggestions || [];
      if (list.length === 0) return "";
      return `
        <div class="dsa-suggestions">
          <p class="dsa-suggestions-title">${esc(i18n["suggest.title"])}</p>
          ${list.map((s) => {
            const title = s.variantTitle
              ? `${s.productTitle} — ${s.variantTitle}`
              : s.productTitle;
            const priceText = formatPrice(parseFloat(s.price.amount) * s.quantity, s.price.currencyCode);
            const usdText = s.priceUsd
              ? formatPrice(parseFloat(s.priceUsd.amount) * s.quantity, s.priceUsd.currencyCode, 2)
              : null;
            return `
              <div class="dsa-suggestion" data-variant-id="${esc(s.variantId)}">
                ${s.imageUrl
                  ? `<img class="dsa-suggestion-img" src="${esc(s.imageUrl)}" alt="" loading="lazy" />`
                  : `<div class="dsa-suggestion-img"></div>`
                }
                <div class="dsa-suggestion-info">
                  <p class="dsa-suggestion-title">${esc(title)}</p>
                  ${(s.forProducts || []).length > 0
                    ? `<p class="dsa-suggestion-for">${esc(fillTemplate(i18n["suggest.for"], {
                        products: s.forProducts.join(" · "),
                      }))}</p>`
                    : ""
                  }
                  <p class="dsa-suggestion-meta">${esc(fillTemplate(i18n["suggest.detail"], {
                    qty: String(s.quantity),
                    m2: formatNumber(s.coversM2),
                    rend: formatNumber(s.rendimientoM2),
                  }))}</p>
                  <p class="dsa-suggestion-price">
                    ${esc(priceText)}
                    ${usdText ? `<span class="dsa-item-price-usd">${esc(usdText)}</span>` : ""}
                  </p>
                </div>
                <button type="button" class="dsa-btn dsa-btn-pill-sm"
                        data-action="suggest-add"
                        data-env-id="${esc(env.id)}"
                        data-variant-id="${esc(s.variantId)}">
                  ${esc(i18n["suggest.add"])}
                </button>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    /**
     * Adhesive suggestions are computed server-side from the pooled area of an
     * environment, so any change to the items makes them stale. Item edits are
     * optimistic and never refetch, which would otherwise leave the customer
     * having to reload the page to see the glue they now need.
     *
     * Debounced: several quick edits collapse into one request. Failures are
     * swallowed — a missing suggestion is not worth an error in the customer's
     * face, and the next edit retries.
     */
    let suggestRefreshTimer = null;
    function refreshPegamentoSuggestions() {
      if (suggestRefreshTimer) clearTimeout(suggestRefreshTimer);
      suggestRefreshTimer = setTimeout(() => {
        suggestRefreshTimer = null;
        // `proj()` is a local helper elsewhere in this file, so read the state
        // directly here.
        const current = state.project && state.project.project;
        if (!current || state.view !== "detail") return;
        api("GET", `/projects/${current.id}`).then((data) => {
          const still = state.project && state.project.project;
          if (!still || still.id !== current.id) return;
          const fresh = new Map(
            (data.environments || []).map((e) => [e.id, e.pegamentoSuggestions || []]),
          );
          let changed = false;
          for (const env of state.project.environments) {
            const next = fresh.get(env.id);
            if (!next) continue;
            if (JSON.stringify(next) !== JSON.stringify(env.pegamentoSuggestions || [])) {
              env.pegamentoSuggestions = next;
              changed = true;
            }
          }
          if (changed) render();
        }).catch(() => {});
      }, 500);
    }

    /**
     * For items sold by area the quantity already IS the m², so the hint next
     * to it is how many boxes that area works out to.
     */
    function boxesLabel(quantity, rendimientoM2) {
      const qty = Number(quantity) || 0;
      if (qty < 1) return "";
      return fillTemplate(i18n["item.boxes"], {
        n: String(Math.ceil(qty / rendimientoM2 - 1e-9)),
      });
    }

    function renderItem(item) {
      const live = item.live;
      const soldByM2 = live && normalizeUnit(live.usageUnit) === "m2";
      const rendimiento = soldByM2 && live.rendimientoM2 != null ? live.rendimientoM2 : null;
      const priceText = live ? formatPrice(parseFloat(live.price.amount), live.price.currencyCode) : null;
      const usdText = live && live.priceUsd
        ? formatPrice(parseFloat(live.priceUsd.amount), live.priceUsd.currencyCode, 2)
        : null;
      return `
        <div class="dsa-item" data-item-id="${esc(item.id)}">
          ${live && live.imageUrl
            ? `<img class="dsa-item-img" src="${esc(live.imageUrl)}" alt="${esc(live.imageAlt || "")}" loading="lazy" />`
            : `<div class="dsa-item-img"></div>`
          }
          <div class="dsa-item-info">
            ${live ? `
              <p class="dsa-item-title">${esc(live.productTitle)}</p>
              ${live.variantTitle ? `<p class="dsa-item-variant">${esc(live.variantTitle)}</p>` : ""}
              <p class="dsa-item-price">
                ${esc(priceText || "")}
                ${usdText ? `<span class="dsa-item-price-usd">${esc(usdText)}</span>` : ""}
              </p>
              ${!live.available ? `<p class="dsa-item-unavailable">${esc(i18n["item.oos"])}</p>` : ""}
            ` : `
              <p class="dsa-item-unavailable">${esc(i18n["item.unavailable"])}</p>
            `}
          </div>
          <div class="dsa-item-remove">
            <button type="button" class="dsa-link dsa-link-danger" data-action="item-delete" data-id="${esc(item.id)}">
              ${esc(i18n["item.remove"])}
            </button>
          </div>
          <div class="dsa-item-qty">
            <span class="dsa-item-qty-label">${esc(soldByM2 ? i18n["item.qty_m2"] : i18n["item.qty"])}</span>
            <input type="number" class="dsa-item-qty-input" min="1" max="9999"
                   value="${item.quantity}"
                   data-action="item-qty-input" data-id="${esc(item.id)}" />
            ${rendimiento != null
              ? `<span class="dsa-item-coverage" data-dsa-coverage="${esc(item.id)}">${esc(boxesLabel(item.quantity, rendimiento))}</span>`
              : ""
            }
          </div>
          <div class="dsa-item-save">
            <button type="button" class="dsa-btn dsa-btn-pill-sm"
                    data-action="item-qty-save" data-id="${esc(item.id)}"
                    data-dsa-item-save disabled>${esc(i18n["item.save"])}</button>
          </div>
        </div>
      `;
    }

    /* ------------------------------------------------------------
       Search panel — absolute, covers root area (no overlay)
       ------------------------------------------------------------ */
    function renderSearchInto(host) {
      host.innerHTML = `
        <section class="dsa-search-panel">
          <div class="dsa-container">
            <div class="dsa-search-panel-header">
              <button type="button" class="dsa-detail-back" data-action="search-close">${esc(i18n["search.back"])}</button>
              <h1 class="dsa-search-panel-title">${esc(i18n["search.title"])}</h1>
            </div>
            <div class="dsa-search-bar">
              <input
                type="search"
                class="dsa-field-input"
                data-action="search-input"
                placeholder="${esc(i18n["search.placeholder"])}"
                autocomplete="off"
                spellcheck="false"
                value="${esc(state.search.query)}"
              />
              <div class="dsa-search-bar-actions">
                <button type="button" data-action="search-clear" aria-label="Limpiar" hidden>${iconClear()}</button>
                <button type="button" aria-label="Buscar" tabindex="-1">${iconSearch()}</button>
              </div>
            </div>
            <div class="dsa-search-results"></div>
          </div>
        </section>
      `;
      updateSearchClearVisibility();
      updateSearchResultsDom();
      const input = host.querySelector('[data-action="search-input"]');
      if (input) setTimeout(() => { input.focus(); }, 50);
    }

    let searchTimer = null;
    let searchAbort = null;

    async function runLiveSearch(rawQuery) {
      const q = rawQuery.trim();
      state.search.query = rawQuery;
      updateSearchClearVisibility();
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
          const data = await res.json().catch(() => ({}));
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

    function updateSearchClearVisibility() {
      const btn = app.querySelector('[data-action="search-clear"]');
      if (btn) btn.hidden = state.search.query.trim().length === 0;
    }

    function updateSearchResultsDom() {
      const container = app.querySelector(".dsa-search-results");
      if (!container) return;

      const q = state.search.query.trim();
      let msg = null;
      if (state.search.busy) msg = i18n["search.busy"];
      else if (q.length === 0) msg = i18n["search.prompt"];
      else if (q.length < 2) msg = i18n["search.too_short"];
      else if (state.search.results.length === 0) msg = i18n["search.empty"];

      container.replaceChildren();
      if (msg !== null) {
        const p = document.createElement("p");
        p.className = "dsa-search-msg";
        p.textContent = msg;
        container.appendChild(p);
        return;
      }

      for (const product of state.search.results) {
        for (const variant of product.variants) {
          const row = cloneTplFirst("search-result-row");
          row.dataset.productId = product.productId;
          row.dataset.variantId = variant.variantId;
          row.dataset.productHandle = product.productHandle || "";

          const title = variant.variantTitle === "Default Title"
            ? product.productTitle
            : `${product.productTitle} — ${variant.variantTitle}`;
          row.querySelector('[data-field="title"]').textContent = title;

          const priceParts = [formatPrice(parseFloat(variant.price.amount), variant.price.currencyCode)];
          if (variant.priceUsd) priceParts.push(formatPrice(parseFloat(variant.priceUsd.amount), variant.priceUsd.currencyCode, 2));
          if (!variant.available) priceParts.push(i18n["item.oos"]);
          row.querySelector('[data-field="price"]').textContent = priceParts.join(" · ");

          const img = row.querySelector('[data-field="img"]');
          const ph  = row.querySelector('[data-field="img-placeholder"]');
          if (product.imageUrl) { img.src = product.imageUrl; img.hidden = false; ph.hidden = true; }

          // Rows are also repainted from runLiveSearch, which does not re-run
          // attachEvents, so the button has to be wired here. When the panel is
          // repainted by render() instead, attachEvents binds it a second time
          // — stopImmediatePropagation keeps that duplicate from firing, since
          // the two paths pass different elements (row here, button there).
          const addBtn = row.querySelector('[data-action="search-add"]');
          if (addBtn) addBtn.addEventListener("click", (e) => {
            e.stopImmediatePropagation();
            handleClick("search-add", row, e);
          });

          container.appendChild(row);
        }
      }
    }

    /* ------------------------------------------------------------
       Modals — generic
       ------------------------------------------------------------ */
    let activeModal = null;

    /**
     * True when a modal is genuinely on screen.
     *
     * `activeModal` is cleared by the dialog's "close" event. If anything throws
     * between assigning it and the dialog actually opening — or if the element
     * is torn out of the DOM without closing — the variable stays pointing at a
     * dialog nobody can see, and every later open is discarded in silence. That
     * is the "clicking does nothing until I reload the page" symptom: nothing
     * short of a reload cleared it. Treat a detached or closed dialog as gone.
     */
    function modalIsOpen() {
      if (!activeModal) return false;
      if (activeModal.isConnected && activeModal.open) return true;
      // Drop the leftover node too: a dialog that never opened stays in the DOM
      // and would shadow the real one in later queries.
      activeModal.remove();
      activeModal = null;
      return false;
    }

    function openModal(tplName, onSubmit) {
      if (modalIsOpen()) return;
      const dialog = cloneTplFirst(tplName);
      if (!dialog) return;
      root.appendChild(dialog);
      activeModal = dialog;

      const closeBtn = dialog.querySelector('[data-action="modal-close"]');
      if (closeBtn) closeBtn.addEventListener("click", (e) => { e.preventDefault(); closeModal(); });
      dialog.addEventListener("click", (e) => { if (e.target === dialog) closeModal(); });
      dialog.addEventListener("close", () => {
        if (activeModal === dialog) { dialog.remove(); activeModal = null; }
      });

      const form = dialog.querySelector('form');
      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const submit = form.querySelector('button[type="submit"]');
          if (submit) submit.disabled = true;
          onSubmit(form).catch((err) => {
            alert(err.message || String(err));
            if (submit) submit.disabled = false;
          });
        });
      }

      dialog.showModal();
      const input = dialog.querySelector('input[name="name"]');
      if (input) setTimeout(() => input.focus(), 0);
    }

    function closeModal() {
      if (!activeModal) return;
      activeModal.close();
    }

    /**
     * Ask how much to add before creating the item.
     *
     * Products sold by area (ds-forma.usage_unit = m2) are asked for square
     * metres — that number IS the quantity — plus an optional waste margin.
     * Everything else gets a plain units prompt. When a rendimiento is known
     * it is shown as context, and used to hint how many boxes that area is.
     */
    function openQtyModal(opts, onConfirm) {
      if (modalIsOpen()) return;
      const dialog = cloneTplFirst("qty-modal");
      if (!dialog) return;
      root.appendChild(dialog);
      activeModal = dialog;

      const closeBtn = dialog.querySelector('[data-action="modal-close"]');
      if (closeBtn) closeBtn.addEventListener("click", (e) => { e.preventDefault(); closeModal(); });
      dialog.addEventListener("click", (e) => { if (e.target === dialog) closeModal(); });
      dialog.addEventListener("close", () => {
        if (activeModal === dialog) { dialog.remove(); activeModal = null; }
      });

      const rendimientoM2 = opts.rendimientoM2;
      const soldByM2 = normalizeUnit(opts.usageUnit) === "m2";
      const form = dialog.querySelector("form");
      const qtyInput = form.elements.quantity;
      const wasteInput = form.elements.waste;
      const wasteRow = dialog.querySelector('[data-field="waste-row"]');
      const summaryEl = dialog.querySelector('[data-field="summary"]');
      const productEl = dialog.querySelector('[data-field="product"]');
      const rendimientoEl = dialog.querySelector('[data-field="rendimiento"]');

      if (productEl) productEl.textContent = opts.productLabel || "";

      if (rendimientoM2 != null) {
        rendimientoEl.textContent =
          fillTemplate(i18n["qty.rendimiento"], { value: formatNumber(rendimientoM2) });
        rendimientoEl.hidden = false;
      }

      if (soldByM2) {
        dialog.querySelector('[data-field="qty-label"]').textContent = i18n["qty.m2_label"];
        // Area can be fractional on the way in; it is rounded up on submit.
        qtyInput.step = "0.01";
        qtyInput.inputMode = "decimal";

        if (wastePct > 0) {
          dialog.querySelector('[data-field="waste-label"]').textContent =
            fillTemplate(i18n["qty.waste"], { pct: String(wastePct) });
          wasteRow.hidden = false;
        }
        qtyInput.addEventListener("input", updateSummary);
        wasteInput.addEventListener("change", updateSummary);
      }

      // Rounded up: Shopify cart lines are whole numbers, so a request for
      // 10,5 m² becomes 11 m².
      function finalQuantity() {
        const raw = positiveNumber(qtyInput.value);
        if (raw == null) return null;
        const withWaste = soldByM2 && wasteInput.checked
          ? raw * (1 + wastePct / 100)
          : raw;
        // Epsilon guards float noise so 11 * 1.0 stays 11 and not 12.
        return Math.min(9999, Math.max(1, Math.ceil(withWaste - 1e-9)));
      }

      function updateSummary() {
        const qty = finalQuantity();
        if (qty == null) { summaryEl.hidden = true; return; }
        let text = fillTemplate(i18n["qty.summary_m2"], { qty: String(qty) });
        if (rendimientoM2 != null) {
          const boxes = Math.ceil(qty / rendimientoM2 - 1e-9);
          text += fillTemplate(i18n["qty.boxes"], { n: String(boxes) });
        }
        summaryEl.textContent = text;
        summaryEl.hidden = false;
      }

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const raw = positiveNumber(qtyInput.value);
        const quantity = finalQuantity();
        if (quantity == null) return;
        closeModal();
        onConfirm({
          quantity,
          // What the customer actually asked for, before the waste margin.
          targetM2: soldByM2 ? raw : null,
          wastePctUsed: soldByM2 && wasteInput.checked ? wastePct : null,
        });
      });

      dialog.showModal();
      setTimeout(() => { qtyInput.focus(); qtyInput.select(); }, 0);
    }

    async function submitCreateProject(form) {
      const name = String(formData(form).name || "").trim();
      if (!name) return;
      const r = await api("POST", "/projects", { name });
      closeModal();
      await openProject(r.project.id);
    }

    async function submitCreateEnv(form) {
      const name = String(formData(form).name || "").trim();
      if (!name) return;
      const projId = state.project.project.id;
      const tempEnv = {
        id: tempId(), name,
        sortOrder: state.project.environments.length,
        items: [],
      };
      state.project.environments.push(tempEnv);
      closeModal();
      render();
      try {
        const r = await api("POST", `/projects/${projId}/environments`, { intent: "create", name });
        tempEnv.id = r.environment.id;
        tempEnv.sortOrder = r.environment.sortOrder;
      } catch (e) {
        state.project.environments = state.project.environments.filter((e) => e !== tempEnv);
        render(); alert(e.message);
      }
    }

    /* ------------------------------------------------------------
       Root events (header CTA outside .dsa-app)
       ------------------------------------------------------------ */
    function bindRootEvents() {
      const createBtn = root.querySelector('[data-action="open-create"]');
      if (createBtn) {
        createBtn.addEventListener("click", (e) => {
          e.preventDefault();
          openModal("new-project-modal", submitCreateProject);
        });
      }
    }

    /* ------------------------------------------------------------
       Inner-view events
       ------------------------------------------------------------ */
    function attachEvents() {
      app.querySelectorAll("[data-action]").forEach(el => {
        const action = el.dataset.action;
        if (el.tagName === "FORM") {
          el.addEventListener("submit", (e) => {
            e.preventDefault();
            handleSubmit(action, el);
          });
          // Track dirty state so the save button enables only on changes
          el.addEventListener("input", () => updateFormDirty(el, action));
        } else if (el.tagName === "INPUT" && action === "item-qty-input") {
          el.addEventListener("input", () => onItemQtyInputChange(el.dataset.id, Number(el.value)));
        } else if (el.tagName === "INPUT" && action === "select-share") {
          el.addEventListener("focus", (e) => e.target.select());
        } else if (el.tagName === "INPUT" && action === "search-input") {
          el.addEventListener("input", (e) => runLiveSearch(e.target.value));
        } else if (el.tagName === "INPUT" && action === "file-input") {
          el.addEventListener("change", () => onFilePicked(el));
        } else {
          el.addEventListener("click", (e) => handleClick(action, el, e));
        }
      });
    }

    function updateFormDirty(form, action) {
      if (action === "rename") {
        const input = form.querySelector('input[name="name"]');
        const btn = form.querySelector('[data-dsa-rename-save]');
        if (input && btn) btn.disabled = input.value.trim() === state.project.project.name;
      } else if (action === "env-rename") {
        const input = form.querySelector('input[name="name"]');
        const btn = form.querySelector('[data-dsa-env-rename-save]');
        if (input && btn) {
          const env = state.project.environments.find((e) => e.id === form.dataset.id);
          btn.disabled = !env || input.value.trim() === env.name;
        }
      }
    }

    function onItemQtyInputChange(itemId, qty) {
      let item = null;
      for (const env of state.project.environments) {
        item = env.items.find((i) => i.id === itemId);
        if (item) break;
      }
      if (!item) return;
      state.pendingQty[itemId] = qty;
      const saveBtn = app.querySelector(`[data-action="item-qty-save"][data-id="${cssId(itemId)}"]`);
      if (saveBtn) saveBtn.disabled = !Number.isInteger(qty) || qty < 1 || qty === item.quantity;

      // Keep the box equivalent in step with what is being typed, even before
      // the change is saved.
      const soldByM2 = item.live && normalizeUnit(item.live.usageUnit) === "m2";
      const rendimiento = soldByM2 && item.live.rendimientoM2 != null ? item.live.rendimientoM2 : null;
      if (rendimiento == null) return;
      const coverageEl = app.querySelector(`[data-dsa-coverage="${cssId(itemId)}"]`);
      if (coverageEl) {
        coverageEl.textContent = Number.isInteger(qty) && qty >= 1
          ? boxesLabel(qty, rendimiento)
          : "";
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
          setView("list"); state.project = null; render();
          api("GET", "/projects").then((d) => {
            state.projects = d.projects ?? [];
            render();
          }).catch(() => {});
          return;
        }

        case "open-create-env":
          openModal("new-env-modal", submitCreateEnv); return;

        case "duplicate": {
          try {
            const r = await api("POST", `/projects/${proj().id}`, { intent: "duplicate" });
            await openProject(r.project.id);
          } catch (e) { alert(e.message); }
          return;
        }

        case "archive":
          setView("list"); state.project = null; render();
          api("POST", `/projects/${proj().id}`, { intent: "archive" })
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
          if (!confirm(i18n["confirm.delete_project"])) return;
          const id = proj().id;
          setView("list"); state.project = null;
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

        case "env-delete": {
          if (!confirm(i18n["confirm.delete_env"])) return;
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
          setView("search");
          state.search = { query: "", results: [], busy: false, envId: el.dataset.envId };
          render(); return;

        case "search-close":
          setView("detail"); render(); return;

        case "search-clear": {
          const input = app.querySelector('[data-action="search-input"]');
          if (input) { input.value = ""; input.focus(); }
          runLiveSearch("");
          return;
        }

        case "search-add": {
          // The product data lives on the row, but attachEvents hands us the
          // button. Walk up so the handler works with either element instead of
          // silently adding nothing when it gets the button.
          const row = el.dataset.variantId ? el : el.closest("[data-variant-id]");
          if (!row) return;
          const productId = row.dataset.productId;
          const variantId = row.dataset.variantId;
          const productHandle = row.dataset.productHandle || null;

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
                  price: v.price, priceUsd: v.priceUsd,
                  available: v.available,
                  imageUrl: p.imageUrl, imageAlt: null,
                  rendimientoM2: v.rendimientoM2 ?? null,
                  usageUnit: v.usageUnit ?? null,
                };
              }
              break;
            }
          }

          const env = state.project.environments.find((e) => e.id === state.search.envId);
          if (!env) return;

          const productLabel = liveData
            ? (liveData.variantTitle
                ? `${liveData.productTitle} — ${liveData.variantTitle}`
                : liveData.productTitle)
            : "";

          openQtyModal(
            {
              rendimientoM2: liveData ? liveData.rendimientoM2 : null,
              usageUnit: liveData ? liveData.usageUnit : null,
              productLabel,
            },
            ({ quantity, targetM2, wastePctUsed }) => {
              const tempItem = {
                id: tempId(), variantId, quantity,
                targetM2, wastePct: wastePctUsed,
                note: null, live: liveData,
              };
              env.items.push(tempItem);
              setView("detail"); render();

              api("POST", `/projects/${proj().id}/items`, {
                intent: "add",
                environmentId: env.id,
                productId, variantId, productHandle,
                quantity, targetM2, wastePct: wastePctUsed,
              }).then((r) => {
                tempItem.id = r.item.id;
                refreshPegamentoSuggestions();
              }).catch((e) => {
                const i = env.items.indexOf(tempItem);
                if (i !== -1) env.items.splice(i, 1);
                render(); alert(e.message || i18n["qty.error"]);
              });
            },
          );
          return;
        }

        case "suggest-add": {
          const envId = el.dataset.envId;
          const variantId = el.dataset.variantId;
          const env = state.project.environments.find((e) => e.id === envId);
          if (!env) return;
          const sugg = (env.pegamentoSuggestions || []).find((s) => s.variantId === variantId);
          if (!sugg) return;

          const tempItem = {
            id: tempId(), variantId,
            quantity: sugg.quantity,
            targetM2: null, wastePct: null, note: null,
            live: {
              variantId, productId: sugg.productId,
              productTitle: sugg.productTitle, productHandle: sugg.productHandle,
              variantTitle: sugg.variantTitle,
              price: sugg.price, priceUsd: sugg.priceUsd,
              available: sugg.available,
              imageUrl: sugg.imageUrl, imageAlt: null,
              // The adhesive itself is sold by the bag, not by area.
              rendimientoM2: null, usageUnit: null,
            },
          };
          env.items.push(tempItem);
          // Drop the row straight away: the glue is in the environment now.
          env.pegamentoSuggestions = (env.pegamentoSuggestions || [])
            .filter((s) => s.variantId !== variantId);
          render();

          api("POST", `/projects/${proj().id}/items`, {
            intent: "add",
            environmentId: envId,
            productId: sugg.productId,
            variantId,
            productHandle: sugg.productHandle,
            quantity: sugg.quantity,
          }).then((r) => {
            tempItem.id = r.item.id;
            refreshPegamentoSuggestions();
          }).catch((e) => {
            const i = env.items.indexOf(tempItem);
            if (i !== -1) env.items.splice(i, 1);
            env.pegamentoSuggestions.push(sugg);
            render(); alert(e.message || i18n["qty.error"]);
          });
          return;
        }

        case "item-delete": {
          if (!confirm(i18n["confirm.delete_item"])) return;
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
          }).then(() => {
            // Removing a floor shrinks the area; removing the glue brings its
            // suggestion back.
            refreshPegamentoSuggestions();
          }).catch((e) => {
            containerEnv.items.splice(removedIdx, 0, removedItem);
            render(); alert(e.message);
          });
          return;
        }

        case "item-qty-save": {
          const itemId = el.dataset.id;
          const qty = state.pendingQty[itemId];
          if (!Number.isInteger(qty) || qty < 1) return;
          let target = null, oldQty = 0;
          for (const env of state.project.environments) {
            target = env.items.find((i) => i.id === itemId);
            if (target) { oldQty = target.quantity; target.quantity = qty; break; }
          }
          if (!target) return;
          delete state.pendingQty[itemId];
          el.disabled = true;
          api("POST", `/projects/${proj().id}/items`, {
            intent: "update", itemId, quantity: qty,
          }).then(() => {
            // refresh subtotal display
            render();
            // The bag count follows the area, so it has to be recomputed too.
            refreshPegamentoSuggestions();
          }).catch((e) => {
            target.quantity = oldQty;
            render(); alert(e.message);
          });
          return;
        }

        case "file-delete":
          await onFileDelete(el.dataset.id); return;

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
        case "rename": {
          const name = String(data.name || "").trim();
          if (!name || name === proj().name) return;
          const oldName = proj().name;
          state.project.project.name = name; render();
          api("POST", `/projects/${proj().id}`, { intent: "rename", name })
            .catch((e) => { state.project.project.name = oldName; render(); alert(e.message); });
          return;
        }

        case "env-rename": {
          const envId = form.dataset.id;
          const name = String(data.name || "").trim();
          const env = state.project.environments.find((e) => e.id === envId);
          if (!env || !name || name === env.name) return;
          const oldName = env.name;
          env.name = name; render();
          api("POST", `/projects/${proj().id}/environments`, {
            intent: "rename", environmentId: envId, name,
          }).catch((e) => { env.name = oldName; render(); alert(e.message); });
          return;
        }
      }
    }

    async function openProject(id) {
      const data = await api("GET", `/projects/${id}`);
      state.project = data;
      state.pendingQty = {};
      state.uploadingName = null;
      setView("detail");
      render();
    }

    /* ------------------------------------------------------------
       Helpers
       ------------------------------------------------------------ */
    function formData(form) {
      const obj = {};
      new FormData(form).forEach((v, k) => { obj[k] = v; });
      return obj;
    }

    function esc(s) {
      if (s == null) return "";
      return String(s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function cssId(s) { return String(s).replace(/(["\\])/g, "\\$1"); }

    function fillTemplate(tpl, vars) {
      return String(tpl || "").replace(/\{(\w+)\}/g, (m, k) =>
        Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m,
      );
    }

    function positiveNumber(raw) {
      if (raw == null) return null;
      // Accept both "2.88" and the Spanish "2,88" a customer may type.
      const n = parseFloat(String(raw).trim().replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : null;
    }

    function normalizeUnit(raw) {
      if (raw == null) return null;
      const v = String(raw).trim().toLowerCase().replace(/²/g, "2");
      return v.length > 0 ? v : null;
    }

    function formatNumber(value) {
      try {
        return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
      } catch (_) { return String(Math.round(value * 100) / 100); }
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
      } catch (_) { return `${cur} ${num.toFixed(fd)}`; }
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

    /* Tiny inline icon helpers used by the JS-rendered detail view.
       Snippet renders happen at server side; JS-emitted markup needs to
       inline SVG to avoid a fetch round-trip. */
    function iconPlus() {
      return `<svg class="dsa-icon dsa-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    }
    function iconTrash() {
      return `<svg class="dsa-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 7 20 7"></polyline><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"></path></svg>`;
    }
    function iconSearch() {
      return `<svg class="dsa-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="20" y1="20" x2="16" y2="16"></line></svg>`;
    }
    function iconClear() {
      return `<svg class="dsa-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>`;
    }
  }
})();
