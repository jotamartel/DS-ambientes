# Roadmap

## Fase 1: MVP (POC) 🎯

**Objetivo**: Validar el concepto con funcionalidad mínima.

**Duración estimada**: 2-3 semanas

### Tareas

- [ ] **1.1 Configurar App Proxy**
  - Agregar configuración en `shopify.app.toml`
  - Crear rutas `/api/proxy/*` en Remix
  - Implementar validación de firma Shopify

- [ ] **1.2 Actualizar Modelo de Datos**
  - Agregar `customerId`, `ownerEmail`, `sharedWith[]`
  - Migrar de SQLite a PostgreSQL
  - Crear migración

- [ ] **1.3 Crear Theme App Extension**
  - Estructura base de archivos
  - Bloque: Botón "Agregar a Proyecto" (PDP)
  - Modal: Selector de proyecto/ambiente

- [ ] **1.4 Implementar API del Storefront**
  - `GET /projects` - Listar proyectos
  - `POST /projects` - Crear proyecto
  - `POST /lists/:id/items` - Agregar item

- [ ] **1.5 Página "Mis Proyectos"**
  - Listado de proyectos
  - Vista de detalle con ambientes
  - Agregar al carrito (producto por producto)

- [ ] **1.6 Deploy**
  - Configurar Vercel
  - Configurar Neon (PostgreSQL)
  - Instalar en tienda de desarrollo

### Criterios de Aceptación MVP

1. ✅ Usuario puede crear proyecto desde PDP
2. ✅ Usuario puede agregar productos a ambientes
3. ✅ Usuario puede ver sus proyectos
4. ✅ Usuario puede agregar productos al carrito
5. ✅ Botón deshabilitado si no está logueado

---

## Fase 2: Compartir y Transferir 🔗

**Duración estimada**: 1-2 semanas

### Tareas

- [ ] **2.1 Generar Link Compartible**
  - Endpoint para generar token
  - Vista de proyecto compartido (requiere login)

- [ ] **2.2 Transferir Propiedad**
  - UI para transferir
  - Endpoint de transferencia
  - Notificación por email (básica)

- [ ] **2.3 Permisos de Edición**
  - Validar permisos en cada endpoint
  - UI diferenciada para owner vs shared

### Criterios de Aceptación

1. ✅ Vendedor puede compartir link
2. ✅ Cliente ve proyecto al loguearse
3. ✅ Vendedor puede transferir propiedad
4. ✅ Cliente puede editar proyecto transferido

---

## Fase 3: UX Mejorada 🎨

**Duración estimada**: 1-2 semanas

### Tareas

- [ ] **3.1 Agregar múltiples productos al carrito**
  - Checkboxes en items
  - "Agregar seleccionados"
  - "Agregar todo el ambiente"

- [ ] **3.2 Notas por producto**
  - UI para agregar/editar comentario
  - Mostrar en vista de proyecto

- [ ] **3.3 Sugerencias de ambientes**
  - Botones rápidos: Baño, Cocina, Living, etc.
  - Iconos por tipo de ambiente

- [ ] **3.4 Feedback visual**
  - Toast de confirmación
  - Estados de loading
  - Animaciones suaves

- [ ] **3.5 Responsive**
  - Mobile-first
  - Testear en dispositivos reales

---

## Fase 4: Integraciones 🔌

**Duración estimada**: 2-3 semanas

### Tareas

- [ ] **4.1 Email automático post-visita**
  - Integrar servicio de email (SendGrid, Mailgun)
  - Template de email con productos
  - Trigger al compartir/transferir

- [ ] **4.2 Verificar stock en tiempo real**
  - Mostrar disponibilidad en proyecto
  - Alerta si producto sin stock

- [ ] **4.3 Sincronizar precios**
  - Actualizar precios cuando cambian
  - Mostrar si el precio cambió

- [ ] **4.4 Analytics**
  - Eventos para tracking
  - Dashboard básico de métricas

---

## Fase 5: Funcionalidades Avanzadas 🚀

**Duración estimada**: TBD

### Ideas para el futuro

- [ ] **Duplicar proyecto** - Para arquitectos con proyectos similares
- [ ] **Exportar a PDF** - Presupuesto descargable
- [ ] **Historial de cambios** - Ver qué se agregó/quitó
- [ ] **Comentarios colaborativos** - Chat en el proyecto
- [ ] **Integración con CRM** - Sincronizar con HubSpot, etc.
- [ ] **App móvil** - Para vendedores en el local
- [ ] **QR en productos** - Escanear para agregar
- [ ] **Cotización formal** - Generar documento oficial
- [ ] **Recordatorios** - "¿Seguís interesado en este proyecto?"
- [ ] **Modo offline** - Para locales con mala conexión

---

## Métricas de Éxito

| Métrica | Objetivo MVP | Objetivo 6 meses |
|---------|--------------|------------------|
| Proyectos creados/mes | 50 | 500 |
| Productos por proyecto | 5 | 15 |
| Tasa de conversión proyecto→compra | 10% | 25% |
| NPS de vendedores | 7 | 9 |

---

## Dependencias y Riesgos

### Dependencias
- Acceso a tienda de producción de De Stefano
- Credenciales de Shopify Partners
- Base de datos PostgreSQL
- Dominio/SSL para producción

### Riesgos
| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Performance con muchos proyectos | Media | Alto | Paginación, índices |
| Complejidad del Theme Extension | Baja | Medio | Documentación, testing |
| Adopción por vendedores | Media | Alto | Capacitación, UX simple |
| Sincronización de precios | Baja | Medio | Webhooks, caché |

---

## Notas de Desarrollo

### Convenciones
- Prefijo `ds-` para clases CSS
- Español en UI, inglés en código
- Commits en español (contexto del cliente)

### Testing
- Unit tests para servicios críticos
- E2E para flujos principales
- Testing manual en tienda de desarrollo

### Deploy
- Vercel para backend
- Neon para PostgreSQL
- GitHub Actions para CI/CD (futuro)
