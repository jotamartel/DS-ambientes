# Desarrollo Local

Cómo levantar la app en local contra una tienda de prueba, usando la app de desarrollo `ds-ambientes-local`.

## Apps y tiendas

| | Producción | Desarrollo local |
|---|---|---|
| App (client_id) | `0fbf69f1998bfa24148bfdf913e7c006` | `cdf86debb584250a47bf2fda4a4f13f1` |
| Config | `shopify.app.toml` | `shopify.app.ds-ambientes-local.toml` |
| Hosting | Vercel (`ds-ambientes.vercel.app`) | Túnel cloudflared → `localhost:3000` |
| Tienda | `dsforma.com.ar` | `infra-vite-skeleton.myshopify.com` |

**Nunca correr `shopify app dev`/`deploy` sin `-c ds-ambientes-local`**: sin ese flag se usa la config de producción.

## Requisitos

- `cloudflared` (`brew install cloudflared`)
- Shopify CLI
- `.env` en la raíz (ver `.env.example`) con las credenciales de la app **local** (`cdf86...`)

## Pasos

### 1. Levantar el túnel (terminal 1, queda corriendo)

```bash
cloudflared tunnel --url http://localhost:3000
```

El output muestra la URL efímera, tipo `https://algo-algo-algo.trycloudflare.com`. Cambia en cada arranque.

### 2. Actualizar la URL del túnel

Reemplazar el dominio viejo por el nuevo en `shopify.app.ds-ambientes-local.toml` (aparece en `application_url`, `redirect_urls` y `app_proxy.url`) y en `SHOPIFY_APP_URL` del `.env`:

```bash
sed -i '' 's/VIEJA.trycloudflare.com/NUEVA.trycloudflare.com/g' shopify.app.ds-ambientes-local.toml .env
```

### 3. Levantar la app (terminal 2)

```bash
npm run dev
```

Vite escucha en `localhost:3000` y cloudflared le reenvía directo (`.trycloudflare.com` ya está en `allowedHosts` de `vite.config.ts`).

> **No usar `shopify app dev` para servir la app.** Este proyecto no tiene `shopify.web.toml`, así que el CLI no sabe qué proceso web levantar: su reverse proxy ocupa el puerto 3000 y responde `Invalid path` a todo.

### 4. Pushear config y extensión a Shopify

```bash
shopify app deploy -c ds-ambientes-local
```

Esto actualiza en Shopify el `application_url`, los redirects y la URL del app proxy (apuntándolos al túnel nuevo), y deploya la versión local de la extensión `projects-block`. Necesario en cada cambio de túnel y en cada cambio de assets de la extensión (la tienda sirve la versión deployada, no los archivos locales).

### 5. Probar

1. Loguearse como **customer** en `https://infra-vite-skeleton.myshopify.com` (sin login, la API devuelve 403 "Customer must be logged in" — es correcto).
2. Abrir `https://infra-vite-skeleton.myshopify.com/pages/mis-proyectos`.
3. Flujo: storefront → app proxy `/apps/projects` firmado por Shopify → túnel → app local → Neon.

## Troubleshooting

| Síntoma | Causa | Fix |
|---|---|---|
| `Invalid path /?hmac=...` | `shopify app dev` corriendo (su proxy ocupa el 3000) | Matarlo y usar `npm run dev` |
| Fetch va a `dsforma.com.ar` en la tienda skeleton | Extensión deployada vieja o `API_HOST` hardcodeado en los assets | `API_HOST = ""` + `shopify app deploy -c ds-ambientes-local` + hard refresh |
| 403 "Customer must be logged in" | Sin sesión de customer en la tienda | Loguearse como customer |
| 403 "Invalid app proxy signature" | `SHOPIFY_API_SECRET` del `.env` no es el de la app local | Copiar el secret de la app `cdf86...` del Partner Dashboard |
| 404/timeout en `/apps/projects` | App proxy en Shopify apunta al túnel viejo | Paso 4 |
| Prisma "Can't reach database server" | Cold start de Neon (se suspende por inactividad) | Reintentar; el `connect_timeout=15` del `DATABASE_URL` da margen |
| `No route matches URL "/favicon.ico"` | No hay ruta para el favicon | Ruido, ignorar |

## Bypasses de desarrollo

Todos viven en `app/shopify-integration/app-proxy.server.ts` y se controlan por env vars. **Nunca setearlos en producción.**

| Variable | Efecto | Estado actual |
|---|---|---|
| `APP_PROXY_BYPASS=1` | Saltea la validación HMAC del app proxy — permite pegarle al túnel/localhost directo sin pasar por Shopify | `0` en `.env` (apagado) |
| `DEV_CUSTOMER_ID` | Con el bypass activo, trata requests anónimas como ese customer ID | Inerte mientras el bypass esté apagado |

### Historial de bypasses hardcodeados (ya revertidos)

- `const bypass = true` en `app-proxy.server.ts:45` — quedó commiteado en `af67230`; con eso deployado, producción acepta requests sin firma y con `logged_in_customer_id` forjable. Revertido en working tree: **commitear y redeployar prod**.
- `API_HOST = "https://dsforma.com.ar"` en `extensions/projects-block/assets/projects.js` y `add-to-project.js` — forzaba la API de prod desde cualquier tienda. Revertido a `""` (same-origin). Solo era cambio local, nunca se commiteó.
