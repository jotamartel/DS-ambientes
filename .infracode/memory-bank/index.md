# Module Index

## Integración Shopify
**Path:** app/shopify-integration
**Keywords:** shopify, app proxy, hmac, oauth, storefront api, admin api, graphql, storefront token, metafields, pegamento, rendimiento m2, usd, staged uploads, shopify files, cart permalink, actor, customerActor, fetchVariantsLive, searchProducts
Capa de integración con Shopify: OAuth de instalación, verificación HMAC del App Proxy y construcción del Actor, clientes Admin/Storefront GraphQL, datos de variantes en vivo (precio USD, rendimiento m², unidad de venta, pegamento), subida de archivos a Shopify Files y permalinks de carrito.

## Modelo de datos
**Path:** prisma
**Keywords:** prisma, schema, postgresql, migraciones, Session, Project, Environment, ProjectItem, ProjectFile, shareToken, targetM2, wastePct, productHandle, seed, cascade
Define el esquema PostgreSQL (Prisma) de sesiones Shopify, proyectos, ambientes, ítems y archivos, con su historial de migraciones y un seed de demo.

## Rutas y UI cliente
**Path:** app/routes
**Keywords:** remix routes, app proxy, apps/projects, api json, share token, intent, zod, errorResponse, parseJsonOrFormBody, customerActor, cart permalink, pegamento suggestions, ssr sin scripts, customer-ui, reloadDocument
Capa HTTP de la app servida vía Shopify App Proxy (/apps/projects): páginas SSR sin JS para clientes logueados (proyectos, ambientes, ítems, búsqueda, carrito), vista pública por share token y API JSON consumida por la theme extension.

## Scripts de mantenimiento
**Path:** scripts
**Keywords:** scripts, mantenimiento, backfill, productHandle, products.json, check-session, Session, tsx, prisma, db:backfill-handles
Scripts tsx de mantenimiento: backfill del handle de producto en ítems de proyecto y diagnóstico de sesiones Shopify guardadas.

## Servicios de dominio
**Path:** app/services
**Keywords:** servicios, dominio, prisma, postgres, proyecto, ambiente, environment, item, archivo, project file, actor, scope, ownership, ProjectsError, zod, share token, duplicar, reordenar, archivar, targetM2, wastePct
Capa de dominio que gestiona proyectos, ambientes, ítems y archivos de cada cliente sobre Prisma/Postgres, aplicando aislamiento por tienda y cliente (Actor), validación con zod y errores tipados ProjectsError.

## Theme extension
**Path:** extensions/projects-block
**Keywords:** theme extension, app block, liquid, projects.js, add-to-project, app proxy, /apps/projects/api, ambientes, metro cuadrado, rendimiento_m2, usage_unit, desperdicio, pegamento sugerido, archivos, staged upload, share link, carrito
Extensión de tema Shopify con los bloques 'Mis proyectos' y 'Agregar a proyecto' que permiten al cliente gestionar proyectos, ambientes, productos, archivos y carrito vía App Proxy.

