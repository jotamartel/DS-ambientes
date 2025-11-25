import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getProjectByShareToken } from "../services/project.server";
import prisma from "../db.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { token } = params;

  if (!token) {
    throw new Response("Token no proporcionado", { status: 400 });
  }

  const project = await getProjectByShareToken(token);

  if (!project) {
    throw new Response("Proyecto no encontrado", { status: 404 });
  }

  // Get shop info for branding
  const session = await prisma.session.findFirst({
    where: { shop: project.shop },
  });

  return json({
    project,
    shopName: project.shop.replace(".myshopify.com", ""),
  });
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);
}

function calculateListSubtotal(items: Array<{ unitPrice: string | number; quantity: number }>): number {
  return items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
}

function calculateProjectTotal(
  lists: Array<{ items: Array<{ unitPrice: string | number; quantity: number }> }>
): number {
  return lists.reduce((sum, list) => sum + calculateListSubtotal(list.items), 0);
}

export default function PublicShare() {
  const { project, shopName } = useLoaderData<typeof loader>();
  const projectTotal = calculateProjectTotal(project.lists);

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{project.name} - Presupuesto</title>
        <style dangerouslySetInnerHTML={{
          __html: `
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
              background-color: #f6f6f7;
              color: #1a1a1a;
              line-height: 1.5;
            }

            .container {
              max-width: 900px;
              margin: 0 auto;
              padding: 20px;
            }

            .header {
              background: white;
              padding: 30px;
              border-radius: 12px;
              margin-bottom: 20px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }

            .header h1 {
              font-size: 28px;
              font-weight: 600;
              margin-bottom: 8px;
            }

            .header .subtitle {
              color: #6b7280;
              font-size: 14px;
            }

            .client-info {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
            }

            .client-info p {
              color: #6b7280;
              font-size: 14px;
            }

            .list-card {
              background: white;
              border-radius: 12px;
              margin-bottom: 20px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              overflow: hidden;
            }

            .list-header {
              padding: 20px;
              border-bottom: 1px solid #e5e7eb;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }

            .list-header h2 {
              font-size: 18px;
              font-weight: 600;
            }

            .list-header .badge {
              background: #e0e7ff;
              color: #4338ca;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 500;
            }

            .items-table {
              width: 100%;
              border-collapse: collapse;
            }

            .items-table th {
              background: #f9fafb;
              padding: 12px 20px;
              text-align: left;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              color: #6b7280;
            }

            .items-table th:last-child,
            .items-table td:last-child {
              text-align: right;
            }

            .items-table td {
              padding: 16px 20px;
              border-bottom: 1px solid #f3f4f6;
            }

            .items-table tr:last-child td {
              border-bottom: none;
            }

            .product-cell {
              display: flex;
              gap: 12px;
              align-items: center;
            }

            .product-image {
              width: 50px;
              height: 50px;
              border-radius: 8px;
              object-fit: cover;
              background: #f3f4f6;
            }

            .product-placeholder {
              width: 50px;
              height: 50px;
              border-radius: 8px;
              background: #f3f4f6;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #9ca3af;
            }

            .product-info h3 {
              font-size: 14px;
              font-weight: 500;
              margin-bottom: 2px;
            }

            .product-info .variant {
              font-size: 12px;
              color: #6b7280;
            }

            .product-info .comment {
              font-size: 12px;
              color: #059669;
              background: #ecfdf5;
              padding: 4px 8px;
              border-radius: 4px;
              margin-top: 4px;
              display: inline-block;
            }

            .list-subtotal {
              padding: 16px 20px;
              background: #f9fafb;
              display: flex;
              justify-content: flex-end;
              gap: 40px;
            }

            .list-subtotal span {
              font-weight: 600;
            }

            .total-card {
              background: #1a1a1a;
              color: white;
              padding: 30px;
              border-radius: 12px;
              margin-bottom: 20px;
            }

            .total-card .row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 12px;
            }

            .total-card .row:last-child {
              margin-bottom: 0;
              padding-top: 12px;
              border-top: 1px solid #333;
            }

            .total-card .label {
              color: #9ca3af;
            }

            .total-card .value {
              font-weight: 600;
            }

            .total-card .total-value {
              font-size: 24px;
              font-weight: 700;
            }

            .contact-card {
              background: white;
              padding: 30px;
              border-radius: 12px;
              text-align: center;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }

            .contact-card h3 {
              font-size: 18px;
              margin-bottom: 12px;
            }

            .contact-card p {
              color: #6b7280;
              margin-bottom: 20px;
            }

            .contact-button {
              display: inline-block;
              background: #25D366;
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 500;
              transition: background 0.2s;
            }

            .contact-button:hover {
              background: #128C7E;
            }

            .footer {
              text-align: center;
              padding: 30px;
              color: #9ca3af;
              font-size: 12px;
            }

            @media (max-width: 640px) {
              .container {
                padding: 12px;
              }

              .header {
                padding: 20px;
              }

              .header h1 {
                font-size: 22px;
              }

              .list-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
              }

              .items-table th,
              .items-table td {
                padding: 12px;
              }

              .product-image,
              .product-placeholder {
                width: 40px;
                height: 40px;
              }

              .hide-mobile {
                display: none;
              }
            }
          `
        }} />
      </head>
      <body>
        <div className="container">
          <header className="header">
            <h1>{project.name}</h1>
            <p className="subtitle">
              Presupuesto generado el {new Date().toLocaleDateString("es-AR")}
            </p>

            {(project.clientName || project.clientEmail) && (
              <div className="client-info">
                {project.clientName && <p><strong>Cliente:</strong> {project.clientName}</p>}
                {project.clientEmail && <p><strong>Email:</strong> {project.clientEmail}</p>}
                {project.clientPhone && <p><strong>Teléfono:</strong> {project.clientPhone}</p>}
              </div>
            )}
          </header>

          {project.lists.map((list) => {
            const subtotal = calculateListSubtotal(list.items);

            return (
              <div key={list.id} className="list-card">
                <div className="list-header">
                  <h2>{list.name}</h2>
                  <span className="badge">{list.items.length} productos</span>
                </div>

                {list.items.length > 0 && (
                  <>
                    <table className="items-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th className="hide-mobile">Cantidad</th>
                          <th className="hide-mobile">Precio</th>
                          <th>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <div className="product-cell">
                                {item.productImage ? (
                                  <img
                                    src={item.productImage}
                                    alt={item.productTitle}
                                    className="product-image"
                                  />
                                ) : (
                                  <div className="product-placeholder">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                                    </svg>
                                  </div>
                                )}
                                <div className="product-info">
                                  <h3>{item.productTitle}</h3>
                                  {item.variantTitle && (
                                    <p className="variant">{item.variantTitle}</p>
                                  )}
                                  {item.comment && (
                                    <span className="comment">📝 {item.comment}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="hide-mobile">{item.quantity}</td>
                            <td className="hide-mobile">{formatCurrency(Number(item.unitPrice))}</td>
                            <td>{formatCurrency(Number(item.unitPrice) * item.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="list-subtotal">
                      <span>Subtotal {list.name}:</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          <div className="total-card">
            <div className="row">
              <span className="label">Ambientes</span>
              <span className="value">{project.lists.length}</span>
            </div>
            <div className="row">
              <span className="label">Total de productos</span>
              <span className="value">
                {project.lists.reduce((sum, list) => sum + list.items.length, 0)}
              </span>
            </div>
            <div className="row">
              <span className="label">Total</span>
              <span className="total-value">{formatCurrency(projectTotal)}</span>
            </div>
          </div>

          <div className="contact-card">
            <h3>¿Tenés consultas?</h3>
            <p>Contactanos para resolver cualquier duda sobre este presupuesto.</p>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hola! Tengo consultas sobre el presupuesto: ${project.name}`)}`}
              className="contact-button"
              target="_blank"
              rel="noopener noreferrer"
            >
              Contactar por WhatsApp
            </a>
          </div>

          <footer className="footer">
            <p>Presupuesto generado por {shopName}</p>
            <p>Los precios pueden variar sin previo aviso</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
