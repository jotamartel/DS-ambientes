# Arquitectura

## Diagrama General

```
┌─────────────────────────────────────────────────────────────┐
│                    STOREFRONT (Theme ISS)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │ PDP Button  │  │ Mis         │  │ Project Detail   │    │
│  │ "Agregar a  │  │ Proyectos   │  │ + Ambientes      │    │
│  │ Proyecto"   │  │ Page        │  │ + Add to Cart    │    │
│  └─────────────┘  └─────────────┘  └──────────────────┘    │
│         │                │                  │               │
│         └────────────────┼──────────────────┘               │
│                          ▼                                  │
│                   JavaScript API                            │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼ App Proxy (/apps/proyectos/*)
┌──────────────────────────────────────────────────────────────┐
│                    BACKEND (Vercel)                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐    ┌────────────────┐                   │
│  │ Remix App      │    │ API Routes     │                   │
│  │                │    │                │                   │
│  │ - Auth         │    │ GET  /projects │                   │
│  │ - Services     │    │ POST /projects │                   │
│  │ - Prisma       │    │ PUT  /projects │                   │
│  └────────────────┘    │ DELETE /project│                   │
│          │             │ POST /items    │                   │
│          ▼             │ ...            │                   │
│  ┌────────────────┐    └────────────────┘                   │
│  │ PostgreSQL     │                                         │
│  │ (Neon/Supabase)│                                         │
│  └────────────────┘                                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. Theme App Extension
Bloques de Liquid + JS que se inyectan en el theme.

```
extensions/
└── theme-extension/
    ├── blocks/
    │   ├── add-to-project-button.liquid  # Botón para PDP
    │   ├── my-projects-page.liquid       # Página completa
    │   └── project-detail.liquid         # Detalle de proyecto
    ├── snippets/
    │   ├── project-modal.liquid          # Modal selector
    │   └── login-prompt.liquid           # Prompt de login
    └── assets/
        ├── ds-ambientes.js               # Lógica JS
        └── ds-ambientes.css              # Estilos
```

### 2. App Proxy
Redirige requests del storefront al backend.

| Storefront URL | Backend URL |
|----------------|-------------|
| `/apps/proyectos/api/projects` | `https://app.vercel.app/api/proxy/projects` |
| `/apps/proyectos/api/projects/:id` | `https://app.vercel.app/api/proxy/projects/:id` |

Configuración en `shopify.app.toml`:
```toml
[app_proxy]
url = "https://ds-ambientes.vercel.app/api/proxy"
subpath = "proyectos"
prefix = "apps"
```

### 3. Backend (Remix)
Ya implementado, necesita:
- Nuevas rutas para App Proxy
- Autenticación por Customer Token
- CORS para storefront

### 4. Base de Datos
PostgreSQL en Neon o Supabase (gratis para desarrollo).

## Autenticación

### En el Storefront
```liquid
{% if customer %}
  <!-- Usuario logueado -->
  <div data-customer-id="{{ customer.id }}" data-customer-email="{{ customer.email }}">
{% else %}
  <!-- No logueado - botón deshabilitado -->
{% endif %}
```

### En el Backend
El App Proxy pasa headers con info del customer:
- `X-Shopify-Customer-Id`
- `X-Shopify-Customer-Email`

## Seguridad

1. **Verificación de firma** - Todas las requests del proxy vienen firmadas
2. **Customer scoping** - Un cliente solo ve sus proyectos
3. **Transfer validation** - Solo el owner puede transferir
4. **HTTPS** - Todo el tráfico encriptado

## Infraestructura

| Componente | Servicio | Tier |
|------------|----------|------|
| Backend | Vercel | Free/Pro |
| Database | Neon | Free |
| CDN | Shopify | Incluido |
| Theme | ISS (custom) | N/A |
