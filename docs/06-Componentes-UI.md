# Componentes UI

## Theme App Extension

### Estructura de Archivos

```
extensions/
└── theme-extension/
    ├── blocks/
    │   ├── add-to-project-button.liquid   # Botón en PDP
    │   ├── my-projects-page.liquid        # Página Mis Proyectos
    │   └── project-detail.liquid          # Detalle de proyecto
    │
    ├── snippets/
    │   ├── project-modal.liquid           # Modal selector
    │   ├── create-project-form.liquid     # Form crear proyecto
    │   ├── create-list-form.liquid        # Form crear ambiente
    │   ├── project-card.liquid            # Card de proyecto
    │   ├── list-accordion.liquid          # Acordeón de ambiente
    │   ├── item-row.liquid                # Fila de producto
    │   └── login-prompt.liquid            # Prompt de login
    │
    └── assets/
        ├── ds-ambientes.js                # JavaScript principal
        ├── ds-ambientes.css               # Estilos
        └── ds-ambientes-icons.svg         # Iconos SVG
```

---

## Componentes

### 1. Add to Project Button

**Ubicación**: PDP (Product Detail Page)

**Estados**:
- No logueado: Deshabilitado con tooltip
- Logueado: Activo
- Agregando: Loading
- Agregado: Feedback visual

```liquid
{% comment %} blocks/add-to-project-button.liquid {% endcomment %}

{% if customer %}
  <button 
    class="ds-add-to-project"
    data-product-id="{{ product.id }}"
    data-variant-id="{{ product.selected_or_first_available_variant.id }}"
    data-product-title="{{ product.title }}"
    data-variant-title="{{ product.selected_or_first_available_variant.title }}"
    data-product-image="{{ product.featured_image | img_url: 'medium' }}"
    data-product-handle="{{ product.handle }}"
    data-price="{{ product.selected_or_first_available_variant.price }}"
  >
    <span class="ds-icon">{% render 'ds-icon-folder' %}</span>
    <span class="ds-text">Agregar a Proyecto</span>
  </button>
{% else %}
  <button 
    class="ds-add-to-project ds-add-to-project--disabled"
    disabled
    title="Iniciá sesión para guardar en proyectos"
  >
    <span class="ds-icon">{% render 'ds-icon-folder' %}</span>
    <span class="ds-text">Agregar a Proyecto</span>
  </button>
{% endif %}
```

**Estilos sugeridos**:
```css
.ds-add-to-project {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--color-secondary, #f5f5f5);
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.ds-add-to-project:hover:not(:disabled) {
  background: var(--color-secondary-hover, #eee);
}

.ds-add-to-project--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ds-add-to-project--loading .ds-text {
  display: none;
}

.ds-add-to-project--loading::after {
  content: "Agregando...";
}
```

---

### 2. Project Modal

**Trigger**: Click en "Agregar a Proyecto"

**Pasos**:
1. Seleccionar proyecto (o crear nuevo)
2. Seleccionar ambiente (o crear nuevo)
3. Confirmar

```liquid
{% comment %} snippets/project-modal.liquid {% endcomment %}

<div class="ds-modal" id="ds-project-modal" hidden>
  <div class="ds-modal__overlay"></div>
  <div class="ds-modal__content">
    
    <!-- Header -->
    <div class="ds-modal__header">
      <h2 class="ds-modal__title">Agregar a Proyecto</h2>
      <button class="ds-modal__close" aria-label="Cerrar">&times;</button>
    </div>
    
    <!-- Step 1: Select Project -->
    <div class="ds-modal__step" data-step="project">
      <div class="ds-modal__body">
        <button class="ds-option ds-option--create" data-action="create-project">
          <span class="ds-option__icon">+</span>
          <span class="ds-option__text">Crear nuevo proyecto</span>
        </button>
        
        <div class="ds-divider">o elegí uno existente</div>
        
        <div class="ds-projects-list" id="ds-projects-list">
          <!-- Se llena dinámicamente -->
        </div>
      </div>
    </div>
    
    <!-- Step 2: Select List -->
    <div class="ds-modal__step" data-step="list" hidden>
      <div class="ds-modal__body">
        <button class="ds-back" data-action="back">← Volver</button>
        
        <h3 class="ds-modal__subtitle" id="ds-selected-project-name"></h3>
        
        <button class="ds-option ds-option--create" data-action="create-list">
          <span class="ds-option__icon">+</span>
          <span class="ds-option__text">Crear nuevo ambiente</span>
        </button>
        
        <div class="ds-lists-list" id="ds-lists-list">
          <!-- Se llena dinámicamente -->
        </div>
      </div>
    </div>
    
    <!-- Step 3: Confirm -->
    <div class="ds-modal__step" data-step="confirm" hidden>
      <div class="ds-modal__body ds-modal__body--center">
        <div class="ds-success-icon">✓</div>
        <p class="ds-success-text">
          Producto agregado a<br>
          <strong id="ds-confirm-list-name"></strong>
        </p>
        <div class="ds-modal__actions">
          <button class="ds-btn ds-btn--secondary" data-action="close">
            Seguir comprando
          </button>
          <a class="ds-btn ds-btn--primary" id="ds-view-project-link">
            Ver proyecto
          </a>
        </div>
      </div>
    </div>
    
    <!-- Create Project Form -->
    <div class="ds-modal__step" data-step="create-project" hidden>
      <div class="ds-modal__body">
        <button class="ds-back" data-action="back">← Volver</button>
        <h3>Nuevo Proyecto</h3>
        <form id="ds-create-project-form">
          <div class="ds-field">
            <label for="project-name">Nombre *</label>
            <input type="text" id="project-name" name="name" required 
                   placeholder="Ej: Casa Mar del Plata">
          </div>
          <div class="ds-field">
            <label for="project-type">Tipo</label>
            <select id="project-type" name="projectType">
              <option value="personal">Personal</option>
              <option value="arquitectura">Estudio de Arquitectura</option>
              <option value="comercial">Comercial</option>
            </select>
          </div>
          <button type="submit" class="ds-btn ds-btn--primary ds-btn--full">
            Crear proyecto
          </button>
        </form>
      </div>
    </div>
    
    <!-- Create List Form -->
    <div class="ds-modal__step" data-step="create-list" hidden>
      <div class="ds-modal__body">
        <button class="ds-back" data-action="back-to-lists">← Volver</button>
        <h3>Nuevo Ambiente</h3>
        <form id="ds-create-list-form">
          <div class="ds-field">
            <label for="list-name">Nombre *</label>
            <input type="text" id="list-name" name="name" required 
                   placeholder="Ej: Baño Principal">
          </div>
          <div class="ds-suggestions">
            <span>Sugerencias:</span>
            <button type="button" data-suggestion="Baño Principal">Baño Principal</button>
            <button type="button" data-suggestion="Cocina">Cocina</button>
            <button type="button" data-suggestion="Living">Living</button>
            <button type="button" data-suggestion="Dormitorio">Dormitorio</button>
            <button type="button" data-suggestion="Exterior">Exterior</button>
          </div>
          <button type="submit" class="ds-btn ds-btn--primary ds-btn--full">
            Crear ambiente
          </button>
        </form>
      </div>
    </div>
    
  </div>
</div>
```

---

### 3. My Projects Page

**Ubicación**: `/pages/mis-proyectos` o App Block en account

```liquid
{% comment %} blocks/my-projects-page.liquid {% endcomment %}

<div class="ds-my-projects" data-customer-id="{{ customer.id }}">
  
  {% if customer %}
    <!-- Header -->
    <div class="ds-page-header">
      <h1>Mis Proyectos</h1>
      <button class="ds-btn ds-btn--primary" id="ds-new-project">
        + Nuevo Proyecto
      </button>
    </div>
    
    <!-- Tabs -->
    <div class="ds-tabs">
      <button class="ds-tab ds-tab--active" data-tab="my-projects">
        Mis Proyectos
      </button>
      <button class="ds-tab" data-tab="shared-with-me">
        Compartidos conmigo
      </button>
    </div>
    
    <!-- Projects Grid -->
    <div class="ds-projects-grid" id="ds-projects-grid">
      <!-- Loading state -->
      <div class="ds-loading">
        <div class="ds-spinner"></div>
        <p>Cargando proyectos...</p>
      </div>
    </div>
    
    <!-- Empty State -->
    <div class="ds-empty-state" id="ds-empty-state" hidden>
      <div class="ds-empty-state__icon">📁</div>
      <h2>No tenés proyectos todavía</h2>
      <p>Creá tu primer proyecto para empezar a organizar tus materiales</p>
      <button class="ds-btn ds-btn--primary" id="ds-empty-new-project">
        Crear mi primer proyecto
      </button>
    </div>
    
  {% else %}
    <!-- Not logged in -->
    <div class="ds-not-logged">
      <div class="ds-not-logged__icon">🔒</div>
      <h2>Iniciá sesión para ver tus proyectos</h2>
      <p>Guardá productos organizados por ambiente y proyecto</p>
      <a href="/account/login" class="ds-btn ds-btn--primary">
        Iniciar sesión
      </a>
      <p class="ds-not-logged__register">
        ¿No tenés cuenta? <a href="/account/register">Registrate</a>
      </p>
    </div>
  {% endif %}
  
</div>
```

---

### 4. Project Card

```liquid
{% comment %} snippets/project-card.liquid {% endcomment %}

<article class="ds-project-card" data-project-id="{{ project.id }}">
  <div class="ds-project-card__header">
    <h3 class="ds-project-card__title">{{ project.name }}</h3>
    {% if project.isOwner %}
      <span class="ds-badge ds-badge--owner">Propietario</span>
    {% else %}
      <span class="ds-badge ds-badge--shared">Compartido</span>
    {% endif %}
  </div>
  
  <div class="ds-project-card__meta">
    <span>{{ project.listsCount }} ambientes</span>
    <span>•</span>
    <span>{{ project.itemsCount }} productos</span>
  </div>
  
  <div class="ds-project-card__total">
    {{ project.totalValue | money }}
  </div>
  
  <div class="ds-project-card__actions">
    <a href="/pages/proyecto?id={{ project.id }}" class="ds-btn ds-btn--secondary">
      Ver proyecto
    </a>
    {% if project.isOwner %}
      <button class="ds-btn ds-btn--icon" data-action="project-menu">
        ⋮
      </button>
    {% endif %}
  </div>
</article>
```

---

### 5. List Accordion (Ambiente)

```liquid
{% comment %} snippets/list-accordion.liquid {% endcomment %}

<details class="ds-list-accordion" data-list-id="{{ list.id }}">
  <summary class="ds-list-accordion__header">
    <span class="ds-list-accordion__icon">🏠</span>
    <span class="ds-list-accordion__name">{{ list.name }}</span>
    <span class="ds-list-accordion__count">{{ list.items | size }} productos</span>
    <span class="ds-list-accordion__subtotal">{{ list.subtotal | money }}</span>
    <span class="ds-list-accordion__arrow">▼</span>
  </summary>
  
  <div class="ds-list-accordion__content">
    <!-- Items Table -->
    <table class="ds-items-table">
      <thead>
        <tr>
          <th><input type="checkbox" class="ds-select-all"></th>
          <th>Producto</th>
          <th>Cantidad</th>
          <th>Precio</th>
          <th>Subtotal</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {% for item in list.items %}
          {% render 'item-row', item: item %}
        {% endfor %}
      </tbody>
    </table>
    
    <!-- Actions -->
    <div class="ds-list-accordion__actions">
      <button class="ds-btn ds-btn--secondary" data-action="add-selected-to-cart">
        Agregar seleccionados al carrito
      </button>
      <button class="ds-btn ds-btn--primary" data-action="add-all-to-cart">
        Agregar todo al carrito
      </button>
    </div>
  </div>
</details>
```

---

### 6. Item Row

```liquid
{% comment %} snippets/item-row.liquid {% endcomment %}

<tr class="ds-item-row" data-item-id="{{ item.id }}">
  <td>
    <input type="checkbox" class="ds-item-select" 
           data-variant-id="{{ item.shopifyVariantId }}"
           data-quantity="{{ item.quantity }}">
  </td>
  <td>
    <div class="ds-item-product">
      <img src="{{ item.productImage }}" alt="{{ item.productTitle }}" 
           class="ds-item-product__image">
      <div class="ds-item-product__info">
        <a href="/products/{{ item.productHandle }}" class="ds-item-product__title">
          {{ item.productTitle }}
        </a>
        {% if item.variantTitle and item.variantTitle != 'Default Title' %}
          <span class="ds-item-product__variant">{{ item.variantTitle }}</span>
        {% endif %}
        {% if item.comment %}
          <span class="ds-item-product__comment">📝 {{ item.comment }}</span>
        {% endif %}
      </div>
    </div>
  </td>
  <td>
    <input type="number" class="ds-item-quantity" 
           value="{{ item.quantity }}" min="1">
  </td>
  <td>{{ item.unitPrice | money }}</td>
  <td class="ds-item-subtotal">
    {{ item.unitPrice | times: item.quantity | money }}
  </td>
  <td>
    <button class="ds-btn ds-btn--icon ds-btn--danger" 
            data-action="remove-item" title="Eliminar">
      🗑️
    </button>
  </td>
</tr>
```

---

## JavaScript Principal

```javascript
// assets/ds-ambientes.js

class DSAmbientes {
  constructor() {
    this.apiBase = '/apps/proyectos/api';
    this.modal = document.getElementById('ds-project-modal');
    this.currentProduct = null;
    this.selectedProject = null;
    
    this.init();
  }
  
  init() {
    this.bindEvents();
    this.loadProjectsIfNeeded();
  }
  
  bindEvents() {
    // Add to project buttons
    document.querySelectorAll('.ds-add-to-project:not([disabled])').forEach(btn => {
      btn.addEventListener('click', (e) => this.openModal(e.target));
    });
    
    // Modal close
    this.modal?.querySelector('.ds-modal__close')?.addEventListener('click', () => {
      this.closeModal();
    });
    
    // ... más eventos
  }
  
  async openModal(button) {
    this.currentProduct = {
      productId: button.dataset.productId,
      variantId: button.dataset.variantId,
      title: button.dataset.productTitle,
      // ...
    };
    
    this.modal.hidden = false;
    await this.loadProjects();
  }
  
  async loadProjects() {
    const response = await fetch(`${this.apiBase}/projects`);
    const data = await response.json();
    this.renderProjects(data.projects);
  }
  
  async addToProject(listId) {
    const response = await fetch(`${this.apiBase}/lists/${listId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.currentProduct)
    });
    
    if (response.ok) {
      this.showConfirmation();
    }
  }
  
  // ... más métodos
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
  window.dsAmbientes = new DSAmbientes();
});
```

---

## Design Tokens

```css
:root {
  /* Colors */
  --ds-color-primary: #1a1a1a;
  --ds-color-secondary: #f5f5f5;
  --ds-color-accent: #0066cc;
  --ds-color-success: #28a745;
  --ds-color-danger: #dc3545;
  --ds-color-border: #e0e0e0;
  --ds-color-text: #333;
  --ds-color-text-muted: #666;
  
  /* Spacing */
  --ds-space-xs: 4px;
  --ds-space-sm: 8px;
  --ds-space-md: 16px;
  --ds-space-lg: 24px;
  --ds-space-xl: 32px;
  
  /* Border Radius */
  --ds-radius-sm: 4px;
  --ds-radius-md: 8px;
  --ds-radius-lg: 12px;
  
  /* Shadows */
  --ds-shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
  --ds-shadow-md: 0 4px 12px rgba(0,0,0,0.15);
  --ds-shadow-lg: 0 8px 24px rgba(0,0,0,0.2);
  
  /* Transitions */
  --ds-transition: 0.2s ease;
}
```
