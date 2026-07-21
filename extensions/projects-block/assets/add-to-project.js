/* eslint-disable */
(function () {
  "use strict";

  document.querySelectorAll(".dsa-atp[data-product-id]:not([data-dsa-init])").forEach(initBlock);

  function initBlock(root) {
    root.dataset.dsaInit = "1";

    const productId = root.dataset.productId;
    const variantId = root.dataset.variantId;
    const productHandle = root.dataset.productHandle;
    const projectsUrl = root.dataset.redirectUrl || "/pages/mis-proyectos";

    const i18n = {
      added: root.dataset.i18nAdded,
      errorLoad: root.dataset.i18nErrorLoad,
      errorLoadProject: root.dataset.i18nErrorLoadProject,
      errorAdd: root.dataset.i18nErrorAdd,
      emptyProjects: root.dataset.i18nEmptyProjects,
      emptyEnvs: root.dataset.i18nEmptyEnvs,
    };

    let drawer = null;
    let selectedId = null;
    let activeModal = null;

    root.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;
      if (target.dataset.action === "open") openDrawer();
    });

    async function openDrawer() {
      if (drawer) return;
      drawer = cloneTplFirst("atp-modal");
      root.appendChild(drawer);
      selectedId = null;

      const closeBtn = drawer.querySelector('[data-action="close"]');
      if (closeBtn) closeBtn.addEventListener("click", (e) => { e.preventDefault(); closeDrawer(); });
      drawer.addEventListener("click", (e) => { if (e.target === drawer) closeDrawer(); });
      drawer.addEventListener("close", () => {
        if (drawer) { drawer.remove(); drawer = null; }
      });

      const create = drawer.querySelector("[data-action='open-create']");
      if (create) create.addEventListener("click", () => openCreateProjectModal());

      drawer.showModal();
      await loadProjects();
    }

    async function loadProjects(selectId) {
      showLoading();
      try {
        const data = await api("GET", "/projects");
        const projects = (data.projects || []).filter((p) => !p.archived);
        if (projects.length === 0) {
          showEmpty(i18n.emptyProjects);
          return;
        }
        renderProjects(projects, selectId);
      } catch (err) {
        showError(err.message || i18n.errorLoad);
      }
    }

    function closeDrawer() {
      if (!drawer) return;
      drawer.close();
    }

    function renderProjects(projects, selectId) {
      const body = bodyEl();
      body.replaceChildren();
      for (const p of projects) {
        const card = cloneTplFirst("atp-project");
        card.dataset.id = p.id;
        card.querySelector("[data-field='name']").textContent = p.name;
        card.querySelector("[data-field='meta']").textContent = envCountLabel(p.environmentCount);
        card.querySelector("[data-action='pick-project']")
          .addEventListener("click", () => selectProject(card, p.id));
        card.querySelector("[data-action='open-create-env']")
          .addEventListener("click", () => openCreateEnvModal(p));
        body.appendChild(card);
      }
      if (projects.length === 0) return;
      const pick = (selectId && projects.find((p) => p.id === selectId)) || projects[0];
      const pickCard = Array.from(body.children).find((c) => c.dataset.id === pick.id);
      selectProject(pickCard, pick.id);
    }

    async function selectProject(card, projectId) {
      if (selectedId === projectId) return;
      selectedId = projectId;

      for (const other of bodyEl().children) {
        other.classList.toggle("is-selected", other === card);
        if (other !== card) {
          const envs = other.querySelector("[data-field='envs']");
          const detail = other.querySelector("[data-field='detail']");
          const createEnv = other.querySelector("[data-action='open-create-env']");
          if (envs) envs.hidden = true;
          if (detail) detail.hidden = true;
          if (createEnv) createEnv.hidden = true;
        }
      }

      const envsEl = card.querySelector("[data-field='envs']");
      envsEl.hidden = false;
      card.querySelector("[data-action='open-create-env']").hidden = false;
      envsEl.replaceChildren(cloneTplFirst("atp-loading"));
      try {
        const data = await api("GET", `/projects/${projectId}`);
        if (selectedId !== projectId) return;
        const envs = data.environments || [];
        if (envs.length === 0) {
          const node = cloneTplFirst("atp-empty");
          node.textContent = i18n.emptyEnvs;
          envsEl.replaceChildren(node);
        } else {
          envsEl.replaceChildren();
          for (const env of envs) envsEl.appendChild(envRow(projectId, env));
        }
        const detail = card.querySelector("[data-field='detail']");
        detail.href = `${projectsUrl}${projectsUrl.includes("?") ? "&" : "?"}project=${encodeURIComponent(projectId)}`;
        detail.hidden = false;
      } catch (err) {
        if (selectedId !== projectId) return;
        const node = cloneTplFirst("atp-error");
        node.textContent = err.message || i18n.errorLoadProject;
        envsEl.replaceChildren(node);
      }
    }

    function envRow(projectId, env) {
      const row = cloneTplFirst("atp-env");
      row.querySelector("[data-field='name']").textContent = env.name;
      row.querySelector("[data-field='meta']").textContent =
        `${env.items.length} producto${env.items.length === 1 ? "" : "s"}`;
      const hasUsd = env.subtotalUsd != null;
      row.querySelector("[data-field='ars']").textContent =
        `${formatPrice(env.subtotal)} ARS${hasUsd ? " - " : ""}`;
      if (hasUsd) {
        row.querySelector("[data-field='usd']").textContent = `${formatPrice(env.subtotalUsd)} USD`;
      }
      row.querySelector("[data-action='add-env']")
        .addEventListener("click", (e) => addToEnv(projectId, env.id, e.currentTarget));
      return row;
    }

    function openFormModal(tplName, onSubmit) {
      if (activeModal) return;
      activeModal = cloneTplFirst(tplName);
      root.appendChild(activeModal);

      const closeBtn = activeModal.querySelector("[data-action='modal-close']");
      if (closeBtn) closeBtn.addEventListener("click", (e) => { e.preventDefault(); closeActiveModal(); });
      activeModal.addEventListener("click", (e) => { if (e.target === activeModal) closeActiveModal(); });
      activeModal.addEventListener("close", () => {
        if (activeModal) { activeModal.remove(); activeModal = null; }
      });

      const form = activeModal.querySelector("form");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = form.elements.name.value.trim();
        if (!name) return;
        const submit = form.querySelector("button[type='submit']");
        submit.disabled = true;
        try {
          await onSubmit(name);
          closeActiveModal();
        } catch (err) {
          submit.disabled = false;
          alert(err.message || i18n.errorLoad);
        }
      });

      activeModal.showModal();
      const input = activeModal.querySelector("input[name='name']");
      if (input) setTimeout(() => input.focus(), 0);
    }

    function openCreateEnvModal(project) {
      openFormModal("atp-new-env-modal", async (name) => {
        await api("POST", `/projects/${project.id}/environments`, { intent: "create", name });
        project.environmentCount += 1;
        refreshProjectCard(project);
      });
    }

    function openCreateProjectModal() {
      openFormModal("atp-new-project-modal", async (name) => {
        const r = await api("POST", "/projects", { name });
        loadProjects(r.project.id);
      });
    }

    function closeActiveModal() {
      if (activeModal) activeModal.close();
    }

    function refreshProjectCard(project) {
      const card = Array.from(bodyEl().children).find((c) => c.dataset.id === project.id);
      if (!card) return;
      card.querySelector("[data-field='meta']").textContent = envCountLabel(project.environmentCount);
      selectedId = null;
      selectProject(card, project.id);
    }

    function envCountLabel(n) {
      return `${n} ambiente${n === 1 ? "" : "s"}`;
    }

    async function addToEnv(projectId, environmentId, btn) {
      btn.disabled = true;
      try {
        await api("POST", `/projects/${projectId}/items`, {
          intent: "add",
          environmentId,
          productId,
          variantId,
          productHandle,
          quantity: 1,
        });
        bodyEl().replaceChildren(textNode("p", "dsa-atp-success", i18n.added));
        setTimeout(closeDrawer, 1500);
      } catch (err) {
        btn.disabled = false;
        showError(err.message || i18n.errorAdd);
      }
    }

    function formatPrice(amount) {
      const num = Number(amount) || 0;
      try {
        return `$${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(num)}`;
      } catch (_) {
        return `$${num.toFixed(0)}`;
      }
    }

    function showLoading() {
      bodyEl().replaceChildren(cloneTplFirst("atp-loading"));
    }
    function showError(msg) {
      const node = cloneTplFirst("atp-error");
      node.textContent = msg;
      bodyEl().replaceChildren(node);
    }
    function showEmpty(msg) {
      const node = cloneTplFirst("atp-empty");
      node.textContent = msg;
      bodyEl().replaceChildren(node);
    }
    function bodyEl() {
      return drawer.querySelector("[data-field='body']");
    }
    function textNode(tag, cls, text) {
      const el = document.createElement(tag);
      el.className = cls;
      el.textContent = text;
      return el;
    }

    function cloneTpl(name) {
      const tpl = root.querySelector(`template[data-dsa-tpl="${name}"]`);
      if (!tpl) throw new Error(`dsa-atp: template not found: ${name}`);
      return tpl.content.cloneNode(true);
    }
    function cloneTplFirst(name) {
      return cloneTpl(name).firstElementChild;
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
        throw new Error((data && data.error) || "");
      }
      return data;
    }
  }
})();
