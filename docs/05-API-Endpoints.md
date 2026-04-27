# API Endpoints

## Base URL

- **Desarrollo**: `http://localhost:3000/api/proxy`
- **Producción**: `https://ds-ambientes.vercel.app/api/proxy`
- **Storefront (App Proxy)**: `/apps/proyectos/api`

## Autenticación

Todas las requests vienen a través del App Proxy de Shopify, que incluye:

```
Headers:
  X-Shopify-Shop-Domain: tienda.myshopify.com
  X-Shopify-Customer-Id: 123456789
  X-Shopify-Customer-Email: cliente@email.com
  X-Shopify-Signature: [firma HMAC]
```

El backend valida la firma para asegurar que la request viene de Shopify.

---

## Endpoints

### Proyectos

#### `GET /api/projects`
Lista los proyectos del cliente actual.

**Query Params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `status` | string | Filtrar por estado: `active`, `archived`, `completed` |
| `includeShared` | boolean | Incluir proyectos compartidos conmigo |

**Response:**
```json
{
  "projects": [
    {
      "id": "clx123...",
      "name": "Casa Mar del Plata",
      "description": "Remodelación completa",
      "status": "active",
      "projectType": "personal",
      "isOwner": true,
      "listsCount": 3,
      "itemsCount": 12,
      "totalValue": 450000,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-20T15:30:00Z"
    }
  ],
  "sharedWithMe": [
    {
      "id": "clx456...",
      "name": "Proyecto compartido",
      "ownerEmail": "vendedor@tienda.com",
      "isOwner": false,
      ...
    }
  ]
}
```

---

#### `POST /api/projects`
Crea un nuevo proyecto.

**Body:**
```json
{
  "name": "Casa Mar del Plata",
  "description": "Remodelación de baños y cocina",
  "projectType": "personal",
  "address": "Av. Colón 1234, Mar del Plata",
  "estimatedDate": "2024-06-01",
  "clientName": "María García",
  "clientEmail": "maria@email.com",
  "clientPhone": "+54 11 1234-5678"
}
```

**Response:**
```json
{
  "project": {
    "id": "clx789...",
    "name": "Casa Mar del Plata",
    ...
  }
}
```

---

#### `GET /api/projects/:id`
Obtiene un proyecto con sus listas e items.

**Response:**
```json
{
  "project": {
    "id": "clx123...",
    "name": "Casa Mar del Plata",
    "isOwner": true,
    "canEdit": true,
    "lists": [
      {
        "id": "lst001",
        "name": "Baño Principal",
        "order": 0,
        "items": [
          {
            "id": "itm001",
            "productTitle": "Porcelanato Gris 60x60",
            "variantTitle": "Caja x 1.44m²",
            "productImage": "https://...",
            "productHandle": "porcelanato-gris-60x60",
            "quantity": 2,
            "unitPrice": 20000,
            "comment": "Para el piso",
            "inStock": true
          }
        ],
        "subtotal": 180000
      }
    ],
    "total": 450000
  }
}
```

---

#### `PUT /api/projects/:id`
Actualiza un proyecto.

**Body:**
```json
{
  "name": "Casa MdP - Actualizado",
  "status": "completed",
  "notes": "Compra realizada 15/02"
}
```

---

#### `DELETE /api/projects/:id`
Elimina un proyecto (solo el owner).

---

#### `POST /api/projects/:id/transfer`
Transfiere la propiedad del proyecto.

**Body:**
```json
{
  "newOwnerEmail": "maria@email.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Proyecto transferido a maria@email.com"
}
```

---

#### `POST /api/projects/:id/share`
Genera o regenera el token de compartir.

**Response:**
```json
{
  "shareUrl": "https://tienda.com/apps/proyectos/shared/abc123xyz"
}
```

---

#### `DELETE /api/projects/:id/share`
Revoca el link de compartir.

---

### Listas (Ambientes)

#### `POST /api/projects/:projectId/lists`
Crea una nueva lista/ambiente.

**Body:**
```json
{
  "name": "Baño Principal"
}
```

---

#### `PUT /api/lists/:id`
Actualiza una lista.

**Body:**
```json
{
  "name": "Baño Suite",
  "order": 2
}
```

---

#### `DELETE /api/lists/:id`
Elimina una lista y todos sus items.

---

#### `POST /api/lists/:id/duplicate`
Duplica una lista con todos sus items.

---

### Items (Productos)

#### `POST /api/lists/:listId/items`
Agrega un producto a la lista.

**Body:**
```json
{
  "productId": "gid://shopify/Product/123",
  "variantId": "gid://shopify/ProductVariant/456",
  "quantity": 2,
  "comment": "Para el piso del baño"
}
```

El backend obtiene automáticamente:
- Título del producto
- Título de la variante
- Imagen
- Precio actual
- Handle del producto

---

#### `PUT /api/items/:id`
Actualiza cantidad o comentario.

**Body:**
```json
{
  "quantity": 3,
  "comment": "Actualizado: necesitamos más"
}
```

---

#### `DELETE /api/items/:id`
Elimina un item de la lista.

---

### Carrito

#### `POST /api/cart/add`
Agrega items al carrito de Shopify.

**Body:**
```json
{
  "items": [
    { "variantId": "gid://shopify/ProductVariant/123", "quantity": 2 },
    { "variantId": "gid://shopify/ProductVariant/456", "quantity": 1 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "cartUrl": "/cart",
  "itemsAdded": 3
}
```

> **Nota**: Este endpoint retorna los datos, pero el JS del frontend hace el `fetch` al Cart API de Shopify directamente.

---

### Vista Compartida

#### `GET /api/shared/:token`
Obtiene proyecto por token (requiere login).

**Response:**
```json
{
  "project": { ... },
  "canEdit": true,
  "isOwner": false
}
```

---

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| 400 | Bad Request - Datos inválidos |
| 401 | Unauthorized - No logueado |
| 403 | Forbidden - Sin permiso |
| 404 | Not Found - Recurso no existe |
| 500 | Server Error |

**Formato de error:**
```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "El proyecto no existe o no tenés acceso"
  }
}
```

---

## Rate Limiting

- 100 requests por minuto por customer
- 1000 requests por minuto por tienda

---

## Webhooks (Futuros)

| Evento | Descripción |
|--------|-------------|
| `project.created` | Proyecto creado |
| `project.transferred` | Proyecto transferido |
| `project.shared` | Proyecto compartido |
| `items.added` | Productos agregados |

Útiles para:
- Enviar emails automáticos
- Integraciones con CRM
- Analytics
