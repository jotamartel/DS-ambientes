# Modelo de Datos

## Diagrama ER

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     Project     │       │      List       │       │    ListItem     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id visudo         │       │ id              │       │ id              │
│ visudo            │       │ projectId    FK │───────│ listId       FK │
│ customerId     *│───────│ name            │       │ shopifyProductId│
│ ownerEmail       │       │ order           │       │ shopifyVariantId│
│ name             │       │ createdAt       │       │ productTitle    │
│ description      │       │ updatedAt       │       │ variantTitle    │
│ status           │       └─────────────────┘       │ productImage    │
│ projectType      │                                 │ quantity        │
│ estimatedDate    │                                 │ comment         │
│ address          │                                 │ unitPrice       │
│ sharedWith[]     │                                 │ createdAt       │
│ shareToken       │                                 │ updatedAt       │
│ createdAt        │                                 └─────────────────┘
│ updatedAt        │
└─────────────────┘
```

## Esquema Prisma

```prisma
model Project {
  id             String    @id @default(cuid())
  shop           String    // Tienda de Shopify
  customerId     String    // ID del customer owner
  ownerEmail     String    // Email del owner
  
  // Información del proyecto
  name           String    // "Casa Mar del Plata"
  description    String?   // Descripción opcional
  projectType    String?   // "personal", "arquitectura", "comercial"
  status         String    @default("active") // active, archived, completed
  
  // Datos adicionales sugeridos
  address        String?   // Dirección de la obra
  estimatedDate  DateTime? // Fecha estimada de compra/obra
  clientName     String?   // Nombre del cliente (si es proyecto de tercero)
  clientEmail    String?   // Email del cliente
  clientPhone    String?   // Teléfono del cliente
  notes          String?   // Notas generales
  
  // Compartir
  sharedWith     String[]  // Array de customer IDs con acceso
  shareToken     String?   @unique // Token para link compartible
  
  // Timestamps
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  
  // Relaciones
  lists          List[]
  
  @@index([shop])
  @@index([customerId])
  @@index([shareToken])
}

model List {
  id        String     @id @default(cuid())
  projectId String
  project   Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  name      String     // "Baño Principal", "Cocina"
  order     Int        @default(0)
  
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  items     ListItem[]

  @@index([projectId])
}

model ListItem {
  id               String   @id @default(cuid())
  listId           String
  list             List     @relation(fields: [listId], references: [id], onDelete: Cascade)
  
  // Producto de Shopify
  shopifyProductId String
  shopifyVariantId String
  
  // Datos cacheados del producto
  productTitle     String
  variantTitle     String?
  productImage     String?
  productHandle    String?  // Para generar links
  
  // Datos del item
  quantity         Int      @default(1)
  comment          String?  // "Este para el baño de servicio"
  unitPrice        Decimal  // Precio al momento de agregar
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([listId])
  @@index([shopifyProductId])
}
```

## Campos Sugeridos (Nuevos)

| Campo | Tipo | Descripción | Prioridad |
|-------|------|-------------|-----------|
| `projectType` | String | Tipo: personal, arquitectura, comercial | Media |
| `address` | String | Dirección de la obra | Media |
| `estimatedDate` | DateTime | Fecha estimada de compra | Baja |
| `clientName` | String | Nombre del cliente final (para vendedores/arquitectos) | Alta |
| `clientEmail` | String | Email del cliente final | Alta |
| `clientPhone` | String | Teléfono del cliente | Media |
| `sharedWith` | String[] | IDs de customers con acceso | Alta |
| `productHandle` | String | Handle del producto para links | Media |

## Estados del Proyecto

| Estado | Descripción |
|--------|-------------|
| `active` | Proyecto en uso activo |
| `archived` | Archivado pero visible |
| `completed` | Compra realizada |

## Permisos

| Acción | Owner | SharedWith | Otros |
|--------|-------|------------|-------|
| Ver proyecto | ✅ | ✅ | ❌ |
| Editar proyecto | ✅ | ✅ | ❌ |
| Eliminar proyecto | ✅ | ❌ | ❌ |
| Transferir ownership | ✅ | ❌ | ❌ |
| Agregar productos | ✅ | ✅ | ❌ |
| Compartir | ✅ | ❌ | ❌ |

## Notas de Migración

El schema actual necesita actualizarse:
1. Agregar `customerId` (owner del proyecto)
2. Agregar `ownerEmail`
3. Agregar `sharedWith[]`
4. Agregar campos opcionales sugeridos
5. Cambiar `assignedTo` por `sharedWith`
