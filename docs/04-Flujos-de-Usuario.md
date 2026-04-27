# Flujos de Usuario

## Personas

### Cliente Final
María quiere remodelar su casa. Visita De Stefano para ver opciones.

### Vendedor en Local
Juan trabaja en el local de Mar del Plata. Atiende clientes y los asesora.

### Arquitecto
Carlos tiene un estudio y gestiona varios proyectos para sus clientes.

---

## Flujo 1: Cliente Navegando Solo

```
┌─────────────────────────────────────────────────────────────────┐
│ María navega el sitio, ve un piso que le gusta                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Ve botón "Agregar a Proyecto" (deshabilitado)                  │
│ Tooltip: "Iniciá sesión para guardar en proyectos"             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ María se loguea o crea cuenta                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Botón ahora activo, hace clic                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Modal: "Seleccionar Proyecto"                                  │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ + Crear nuevo proyecto                                  │    │
│ │ ─────────────────────────────────────────────────────── │    │
│ │ 🏠 Casa Mar del Plata                                   │    │
│ │ 🏢 Depto CABA                                           │    │
│ └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Selecciona proyecto → Modal: "Seleccionar Ambiente"            │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ + Crear nuevo ambiente                                  │    │
│ │ ─────────────────────────────────────────────────────── │    │
│ │ 🛁 Baño Principal                                       │    │
│ │ 🍳 Cocina                                               │    │
│ │ 🛋️ Living                                               │    │
│ └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Producto agregado. Toast: "Agregado a Baño Principal"          │
│ [Ver proyecto] [Seguir comprando]                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flujo 2: Vendedor en el Local

```
┌─────────────────────────────────────────────────────────────────┐
│ María llega al local, Juan (vendedor) la atiende               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Juan se loguea con su cuenta de vendedor                       │
│ (cuenta normal, sin privilegios especiales)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Juan crea proyecto: "María García - Casa MdP"                  │
│ Campos:                                                        │
│   - Nombre: María García - Casa MdP                            │
│   - Tipo: Personal                                             │
│   - Cliente: María García                                      │
│   - Email cliente: maria@email.com                             │
│   - Teléfono: +54 11 1234-5678                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Juan va mostrando productos físicamente                        │
│ Por cada uno que le gusta a María:                             │
│   → Busca en el sitio                                          │
│   → Agrega al proyecto                                         │
│   → Opcionalmente agrega nota: "Le encantó el color"           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ María se va. Juan tiene 2 opciones:                            │
│                                                                 │
│ Opción A: Transferir proyecto                                  │
│   → Juan transfiere ownership a maria@email.com                │
│   → María recibe email con link al proyecto                    │
│   → María se loguea y ve el proyecto en "Mis Proyectos"        │
│                                                                 │
│ Opción B: Compartir link                                       │
│   → Juan genera link de compartir                              │
│   → Manda por WhatsApp a María                                 │
│   → María se loguea para ver                                   │
│   → Puede pedir transferencia después                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flujo 3: Agregar al Carrito

```
┌─────────────────────────────────────────────────────────────────┐
│ María entra a "Mis Proyectos"                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Ve lista de proyectos con resumen:                             │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ 🏠 Casa Mar del Plata                                   │    │
│ │    3 ambientes • 12 productos • $450.000               │    │
│ │    [Ver proyecto]                                       │    │
│ └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Abre proyecto, ve ambientes:                                   │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ 🛁 Baño Principal (5 productos - $180.000)              │    │
│ │    [Expandir] [Agregar todo al carrito]                 │    │
│ ├─────────────────────────────────────────────────────────┤    │
│ │ 🍳 Cocina (4 productos - $150.000)                      │    │
│ │    [Expandir] [Agregar todo al carrito]                 │    │
│ ├─────────────────────────────────────────────────────────┤    │
│ │ 🛋️ Living (3 productos - $120.000)                      │    │
│ │    [Expandir] [Agregar todo al carrito]                 │    │
│ └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Expande "Baño Principal":                                      │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ ☑️ Porcelanato Gris 60x60    x2    $40.000  [+ carrito]│    │
│ │ ☑️ Pastina Gris              x1    $5.000   [+ carrito]│    │
│ │ ☑️ Guardas Decorativas       x3    $15.000  [+ carrito]│    │
│ │ ☐ Adhesivo (sin stock)       x1    $8.000   [Ver]     │    │
│ │ ☑️ Rejilla Acero Inox        x1    $12.000  [+ carrito]│    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ [Agregar seleccionados al carrito (4)]                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Toast: "4 productos agregados al carrito"                      │
│ [Ver carrito] [Seguir en el proyecto]                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flujo 4: Transferir Proyecto

```
┌─────────────────────────────────────────────────────────────────┐
│ Juan (vendedor) abre el proyecto                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Menú: ⚙️ Opciones del proyecto                                 │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ 📤 Compartir link                                       │    │
│ │ 👤 Transferir proyecto                                  │    │
│ │ ✏️ Editar datos                                         │    │
│ │ 🗑️ Eliminar proyecto                                    │    │
│ └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Clic en "Transferir proyecto"                                  │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ Transferir a:                                           │    │
│ │ [maria@email.com                               ]        │    │
│ │                                                         │    │
│ │ ⚠️ El nuevo dueño tendrá control total del proyecto    │    │
│ │                                                         │    │
│ │ [Cancelar]              [Transferir]                    │    │
│ └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Proyecto transferido                                           │
│ - María recibe email notificando                               │
│ - Juan ya no ve el proyecto en su lista                        │
│ - María lo ve en "Mis Proyectos"                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Diagrama de Estados del Proyecto

```
                    ┌──────────┐
                    │  Crear   │
                    └────┬─────┘
                         │
                         ▼
┌────────────────────────────────────────┐
│               ACTIVE                   │
│  - Visible en "Mis Proyectos"          │
│  - Editable                            │
│  - Puede agregar productos             │
└────────────────┬───────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌───────────────┐  ┌───────────────┐
│   ARCHIVED    │  │   COMPLETED   │
│               │  │               │
│ - Oculto por  │  │ - Compra      │
│   defecto     │  │   realizada   │
│ - Puede       │  │ - Solo        │
│   reactivar   │  │   lectura     │
└───────────────┘  └───────────────┘
```
