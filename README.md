# DS Ambientes - Shopify App

Sistema de gestión de órdenes por proyectos y ambientes para De Stefano.

## Descripción

Esta aplicación de Shopify permite a los vendedores crear y gestionar múltiples listas de compra (carritos) organizadas por proyecto o ambiente, con funcionalidades avanzadas de cotización y compartición.

### Características Principales

- **Gestión de Proyectos**: Crear, editar y gestionar proyectos con información de cliente
- **Ambientes/Listas**: Organizar productos por ambiente (Baño, Cocina, Living, etc.)
- **Comentarios por Ítem**: Agregar notas específicas a cada producto
- **Compartir Presupuestos**: Generar enlaces públicos para compartir con clientes
- **Conversión a Órdenes**: Convertir proyectos en Draft Orders de Shopify
- **Dashboard**: Vista general con estadísticas y acceso rápido

## Stack Tecnológico

- **Framework**: Shopify Remix App
- **Base de datos**: Prisma con SQLite (desarrollo) / PostgreSQL (producción)
- **UI**: Shopify Polaris
- **API**: Shopify Admin GraphQL API

## Requisitos Previos

- Node.js 18.20+ o 20.10+
- npm o yarn
- Cuenta de Partner de Shopify
- Tienda de desarrollo de Shopify

## Instalación

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd DS-ambientes
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copiar el archivo de ejemplo y configurar las variables:

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:

```env
SHOPIFY_API_KEY=tu_api_key
SHOPIFY_API_SECRET=tu_api_secret
SCOPES=read_products,write_draft_orders,read_customers
DATABASE_URL="file:./dev.db"
```

### 4. Inicializar la base de datos

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Conectar con Shopify

```bash
npm run config:link
```

### 6. Iniciar el servidor de desarrollo

```bash
npm run dev
```

## Estructura del Proyecto

```
app/
├── routes/
│   ├── app._index.tsx              # Dashboard principal
│   ├── app.projects._index.tsx     # Lista de proyectos
│   ├── app.projects.new.tsx        # Crear proyecto
│   ├── app.projects.$id.tsx        # Detalle de proyecto
│   ├── app.projects.$id.lists.$listId.tsx  # Gestión de lista
│   ├── app.projects.$id.convert.tsx # Convertir a orden
│   ├── app.api.projects.tsx        # API de proyectos
│   ├── app.api.lists.tsx           # API de listas
│   ├── app.api.products.tsx        # API de productos
│   └── share.$token.tsx            # Vista pública compartida
├── services/
│   ├── project.server.ts           # Lógica de proyectos
│   └── shopify.api.server.ts       # Integración con Shopify
├── shopify.server.ts               # Configuración de Shopify
└── db.server.ts                    # Cliente de Prisma
```

## Uso

### Crear un Proyecto

1. Desde el Dashboard, clic en "Nuevo Proyecto"
2. Completar nombre del proyecto y datos del cliente
3. El proyecto se crea en estado "Borrador"

### Agregar Ambientes

1. Abrir el proyecto
2. Clic en "Agregar Ambiente"
3. Nombrar el ambiente (ej: "Baño Principal")

### Agregar Productos

1. Entrar al ambiente
2. Clic en "Agregar Productos"
3. Seleccionar productos del catálogo de Shopify
4. Los productos se agregan con precio actual

### Agregar Comentarios

1. En la lista de productos, clic en editar
2. Agregar cantidad y comentario
3. Los comentarios aparecen en el presupuesto y la orden

### Compartir Presupuesto

1. En el proyecto, clic en "Compartir"
2. Generar enlace público
3. Copiar y enviar al cliente

### Convertir a Orden

1. Clic en "Convertir a Orden"
2. Seleccionar los ambientes a incluir
3. Se crea un Draft Order en Shopify

## Modelo de Datos

### Project
- `id`: Identificador único
- `shop`: Tienda de Shopify
- `name`: Nombre del proyecto
- `clientName`, `clientEmail`, `clientPhone`: Datos del cliente
- `status`: Estado (draft, active, completed, cancelled)
- `assignedTo`: Vendedor asignado
- `shareToken`: Token para compartir

### List
- `id`: Identificador único
- `projectId`: Proyecto padre
- `name`: Nombre del ambiente
- `order`: Orden de visualización

### ListItem
- `id`: Identificador único
- `listId`: Lista padre
- `shopifyProductId`, `shopifyVariantId`: Referencias a Shopify
- `productTitle`, `variantTitle`, `productImage`: Datos cacheados
- `quantity`: Cantidad
- `unitPrice`: Precio unitario
- `comment`: Comentario/nota

## Scopes de Shopify

La app requiere los siguientes permisos:

- `read_products`: Leer productos y variantes
- `write_draft_orders`: Crear órdenes borrador
- `read_customers`: Leer información de clientes

## Desarrollo

### Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Generar cliente Prisma
npm run prisma generate

# Crear migración
npm run prisma migrate dev --name <nombre>

# Ver base de datos
npx prisma studio

# Deploy
npm run deploy
```

### Agregar Webhooks

La app está configurada para recibir webhooks de:
- `PRODUCTS_UPDATE`: Actualiza precios cacheados
- `APP_UNINSTALLED`: Limpia datos de la tienda

## Producción

Para desplegar en producción:

1. Cambiar `DATABASE_URL` a PostgreSQL
2. Ejecutar migraciones: `npx prisma migrate deploy`
3. Desplegar con `npm run deploy`

## Soporte

Para reportar problemas o sugerencias, contactar al equipo de desarrollo.

## Licencia

Propietario - De Stefano
