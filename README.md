# DS Ambientes — Standalone Vendor App

Web app independiente para que vendedores de De Stefano armen **proyectos de productos por ambientes** y compartan un link con el cliente para checkout. Single-tenant: apunta a un único store de Shopify (`pkyzzu-96.myshopify.com`) vía Storefront API.

## Surfaces

| Quién | Cómo entra | Para qué |
|---|---|---|
| **Vendedor** | `/login` con contraseña compartida | Crea proyectos, agrega ambientes y productos, genera share link |
| **Cliente final** | Share link `/share/<token>` | Ve el proyecto en read-only y "Agregar todo al carrito" → checkout en el store |

No hay Shopify embedded admin. No hay App Proxy. No hay OAuth. Es un sitio Remix corriente que habla con Shopify por **Storefront API** (productos + cart create).

## Stack

- Remix v2 + Vite + TypeScript
- Cookie session (firmada con `SESSION_SECRET`) para auth de vendedores
- Polaris 12 para la UI del vendedor + CSS propio mobile-first para la página pública del share
- Storefront API (GraphQL `2024-04`) — búsqueda de productos + datos live + Cart create
- Prisma 5 + PostgreSQL (Neon)
- Zod en validación

## Modelo de datos

```
Project       id, shop, customerId?, name, archived, shareToken?,
              clientName?, clientEmail?, clientPhone?, notes?
Environment   id, projectId, name, sortOrder
ProjectItem   id, environmentId, productId, variantId, quantity, note?
```

`customerId` quedó nullable por compatibilidad — en este modo standalone, todos los proyectos son del shop. El campo se mantiene para una eventual migración a Customer Account Extensions.

## Estructura

```
app/
├── customer-ui/          Layout y CSS de la página pública del share
├── services/             Service layer (project, environment, item, types, scope)
├── shopify-integration/  Storefront client, products, cart
├── routes/
│   ├── _index.tsx                       redirect login/projects
│   ├── login.tsx                        vendor login
│   ├── logout.tsx                       vendor logout
│   ├── projects.tsx                     parent layout (Polaris + frame)
│   ├── projects._index.tsx              list
│   ├── projects.new.tsx                 create
│   ├── projects.$id.tsx                 detail + project actions
│   ├── projects.$id.environments.tsx    env mutations
│   ├── projects.$id.items.tsx           item mutations
│   ├── projects.$id.search.tsx          product search (Storefront)
│   └── share.$token.tsx                 public share + add-to-cart
├── session.server.ts     cookie session helpers
├── db.server.ts          Prisma client
├── root.tsx, entry.server.tsx
prisma/
├── schema.prisma
├── migrations/...
└── seed.ts
```

## Setup

### 1. Dependencias y DB

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

`DATABASE_URL` en `.env` (ya está apuntando a Neon).

### 2. Storefront API token desde el store real

1. Entrá al admin del store: `https://admin.shopify.com/store/pkyzzu-96`
2. **Settings → Apps and sales channels → Develop apps**
3. **Create an app** → nombre `ds-ambientes-storefront` (o el que quieras)
4. Click la app → tab **API credentials** → **Storefront API integration → Configure scopes**
5. Marcá:
   - `unauthenticated_read_product_listings`
   - `unauthenticated_write_checkouts`
6. Save → **Install app** (botón arriba a la derecha)
7. Copiá el **Storefront API access token** que aparece
8. Pegalo en `.env` como `SHOPIFY_STOREFRONT_TOKEN`

### 3. Variables de entorno

`.env` necesita:

```
SHOP=pkyzzu-96.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=<el del paso 2>
VENDOR_PASSWORD=<elegí una>
SESSION_SECRET=<32 bytes hex; node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
PUBLIC_BASE_URL=http://localhost:3000
DATABASE_URL=<Postgres>
```

### 4. Dev

```bash
npm run dev
```

Abre `http://localhost:3000`:
- **`/login`** → ingresás con `VENDOR_PASSWORD`.
- **`/projects`** → dashboard, crear/editar proyectos.
- En el detalle, "Generar enlace" da el share URL público.
- **`/share/<token>`** → vista pública, add-to-cart.

### 5. Production deploy (Vercel)

`vercel.json` ya está configurado. Setear en Vercel los env vars:

- `DATABASE_URL`, `SHOP`, `SHOPIFY_STOREFRONT_TOKEN`, `VENDOR_PASSWORD`, `SESSION_SECRET`
- `PUBLIC_BASE_URL` = el dominio de Vercel (sin trailing slash)

`npm run vercel-build` corre `prisma generate && remix vite:build`.

## Seguridad

- **Vendor login**: única contraseña compartida (POC). Para producción real, mover a JWT/usuarios reales o IDP corporativo.
- **Session cookie**: `httpOnly`, `secure` en prod, firmada con `SESSION_SECRET`, 30 días.
- **Share tokens**: 32 bytes random hex (`crypto.randomBytes(32)`), índice único en Postgres. Proyectos archivados ocultan su share.
- **Validación**: zod en cada action. GIDs Shopify validados con regex.
- **Storefront token**: público por diseño (puede ir en JS de cliente). De todos modos, mantenerlo solo server-side reduce abuse.

## Pendientes

- Drag-and-drop real para reorder (hoy: botones ↑/↓ — y de hecho los descomentamos en este modo standalone, hay que reagregarlos cuando se quiera).
- Export PDF del proyecto.
- Email del share link.
- Hooks de analytics.
- Tests automatizados.
- Migrar a Customer Account Extensions cuando se quiera el flujo customer-self-serve.
