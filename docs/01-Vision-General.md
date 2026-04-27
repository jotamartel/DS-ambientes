# Visión General

## El Negocio

**De Stefano** es una empresa de pisos y revestimientos. Sus clientes típicamente:
- Vienen con arquitectos a elegir materiales
- Necesitan organizar compras por ambiente (baño, cocina, living)
- Visitan el local y un vendedor les muestra productos

## El Problema

1. No hay forma de guardar y organizar productos por proyecto/ambiente
2. El vendedor no puede compartir fácilmente lo que mostró
3. El cliente pierde el registro de lo que vio
4. No hay seguimiento post-visita

## La Solución

Una app integrada al storefront de Shopify que permite:

### Para el Cliente
- Crear proyectos (Casa Mar del Plata, Depto CABA, etc.)
- Organizar productos por ambiente (Baño Principal, Cocina, etc.)
- Agregar productos fácilmente al carrito
- Ver proyectos compartidos por vendedores

### Para el Vendedor
- Crear proyectos mientras muestra productos en el local
- Compartir el proyecto con el cliente vía link
- Transferir la propiedad del proyecto al cliente
- Hacer seguimiento de lo que el cliente vio

### Para el Estudio de Arquitectura
- Gestionar múltiples proyectos de diferentes clientes
- Organizar materiales por obra
- Compartir selecciones con sus clientes

## Decisiones de Producto

| Decisión | Resolución |
|----------|------------|
| ¿Dónde vive la app? | 100% en el storefront (no admin) |
| ¿Quién puede usar? | Cualquier usuario registrado |
| ¿Cómo comparte el vendedor? | Crea proyecto, transfiere propiedad |
| ¿El link compartido es público? | No, requiere login |
| ¿El cliente puede editar? | Sí, una vez transferido |
| ¿Cómo agrega al carrito? | Producto por producto (fácil) |
| ¿Multi-tienda? | Por ahora solo De Stefano, a futuro productizable |

## Valor Diferencial

1. **Organización visual** por proyecto y ambiente
2. **Colaboración** vendedor-cliente
3. **Persistencia** - el cliente no pierde lo que vio
4. **Conversión** - facilita la compra posterior
5. **Retargeting** - base para automatizaciones futuras
