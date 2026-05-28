/* eslint-disable */
(function () {
  "use strict";

  document.querySelectorAll(".dsa-atp[data-product-id]:not([data-dsa-init])").forEach(initBlock);

  function initBlock(root) {
    root.dataset.dsaInit = "1";

    const productId = root.dataset.productId;
    const variantId = root.dataset.variantId;
    const productHandle = root.dataset.productHandle;
    const redirectUrl = root.dataset.redirectUrl;

    const i18n = {
      loading: root.dataset.i18nLoading,
      pickProject: root.dataset.i18nPickProject,
      pickEnv: root.dataset.i18nPickEnv,
      done: root.dataset.i18nDone,
      added: root.dataset.i18nAdded,
      errorLoad: root.dataset.i18nErrorLoad,
      errorLoadProject: root.dataset.i18nErrorLoadProject,
      errorAdd: root.dataset.i18nErrorAdd,
      manageProjects: root.dataset.i18nManageProjects,
      emptyProjects: root.dataset.i18nEmptyProjects,
      emptyEnvs: root.dataset.i18nEmptyEnvs,
    };

    let modal = null;

    root.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;
      if (target.dataset.action === "open") openModal();
    });

    async function openModal() {
      if (modal) return;
      modal = cloneTplFirst("atp-modal");
      root.appendChild(modal);

      const closeBtn = modal.querySelector('[data-action="close"]');
      if (closeBtn) closeBtn.addEventListener("click", (e) => { e.preventDefault(); closeModal(); });
      modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
      modal.addEventListener("close", () => {
        if (modal) { modal.remove(); modal = null; }
      });

      const manage = modal.querySelector("[data-field='manage']");
      if (manage) {
        manage.href = redirectUrl || "/pages/mis-proyectos";
        manage.textContent = i18n.manageProjects;
      }

      modal.showModal();

      setTitle(i18n.loading);
      showLoading();
      try {
        const data = await api("GET", "/projects");
        const projects = (data.projects || []).filter((p) => !p.archived);
        if (projects.length === 0) {
          setTitle(i18n.pickProject);
          showEmpty(i18n.emptyProjects);
          return;
        }
        renderProjectList(projects);
      } catch (err) {
        showError(err.message || i18n.errorLoad);
      }
    }

    function closeModal() {
      if (!modal) return;
      modal.close();
    }

    function renderProjectList(projects) {
      setTitle(i18n.pickProject);
      const body = bodyEl();
      body.replaceChildren();
      for (const p of projects) {
        const item = cloneTplFirst("atp-list-item");
        item.querySelector("[data-field='name']").textContent = p.name;
        item.querySelector("[data-field='meta']").textContent =
          `${p.environmentCount} ambiente${p.environmentCount === 1 ? "" : "s"}`;
        item.addEventListener("click", () => onPickProject(p.id));
        body.appendChild(item);
      }
    }

    async function onPickProject(projectId) {
      showLoading();
      try {
        const data = await api("GET", `/projects/${projectId}`);
        const envs = data.environments || [];
        if (envs.length === 0) {
          setTitle(i18n.pickEnv);
          showEmpty(i18n.emptyEnvs);
          return;
        }
        renderEnvList(projectId, envs);
      } catch (err) {
        showError(err.message || i18n.errorLoadProject);
      }
    }

    function renderEnvList(projectId, envs) {
      setTitle(i18n.pickEnv);
      const body = bodyEl();
      body.replaceChildren();
      for (const e of envs) {
        const item = cloneTplFirst("atp-list-item");
        item.querySelector("[data-field='name']").textContent = e.name;
        item.querySelector("[data-field='meta']").textContent =
          `${e.items.length} producto${e.items.length === 1 ? "" : "s"}`;
        item.addEventListener("click", () => onPickEnv(projectId, e.id));
        body.appendChild(item);
      }
    }

    async function onPickEnv(projectId, environmentId) {
      showLoading();
      try {
        await api("POST", `/projects/${projectId}/items`, {
          intent: "add",
          environmentId,
          productId,
          variantId,
          productHandle,
          quantity: 1,
        });
        setTitle(i18n.done);
        bodyEl().replaceChildren(
          textNode("p", "dsa-atp-success", i18n.added),
        );
        setTimeout(closeModal, 1500);
      } catch (err) {
        showError(err.message || i18n.errorAdd);
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
    function setTitle(s) {
      modal.querySelector("[data-field='title']").textContent = s;
    }
    function bodyEl() {
      return modal.querySelector("[data-field='body']");
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
      const data = ct.includes("application/json") ? await res.json() : null;
      if (!res.ok) {
        throw new Error((data && data.error) || `HTTP ${res.status}`);
      }
      return data;
    }
  }
})();
