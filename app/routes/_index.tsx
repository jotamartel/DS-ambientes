import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import customerStyles from "~/customer-ui/styles.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: customerStyles },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") ?? process.env.SHOP ?? null;
  const publicDomain = process.env.PUBLIC_SHOP_DOMAIN ?? shop;
  const storefrontUrl = publicDomain ? `https://${publicDomain}/pages/mis-proyectos` : null;
  const adminUrl = shop ? `https://${shop}/admin/themes` : null;
  return json({ shop, storefrontUrl, adminUrl });
}

export default function MerchantLanding() {
  const { storefrontUrl, adminUrl } = useLoaderData<typeof loader>();

  return (
    <div className="cu-container" style={{ maxWidth: 720 }}>
      <header className="cu-header">
        <p className="cu-eyebrow">DS Ambientes Projects</p>
        <div className="cu-header-row">
          <h1>App instalada correctamente</h1>
        </div>
      </header>

      <main className="cu-stack">
        <section className="cu-card cu-stack">
          <p className="cu-muted" style={{ fontSize: 15 }}>
            Esta app se ejecuta dentro del <strong>storefront</strong> (no en el
            admin de Shopify). Tus clientes, arquitectos y diseñadores arman sus
            proyectos por ambiente directamente desde tu tienda online.
          </p>
        </section>

        <section className="cu-card cu-stack">
          <strong className="cu-h3">Cómo funciona</strong>
          <ol style={{ paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
            <li>
              El bloque <em>"DS Ambientes — Proyectos"</em> ya está disponible en el
              theme editor. Lo agregás a la página que prefieras (por ejemplo, una
              página custom <code>/pages/mis-proyectos</code>).
            </li>
            <li>
              Cuando un cliente logueado visita esa página, ve solo sus propios
              proyectos: lista, detalle, búsqueda de productos, totales en ARS y USD,
              y un link público para compartir con su arquitecto/diseñador.
            </li>
            <li>
              Cualquiera con el link público puede ver el proyecto en modo lectura y
              "Agregar todo al carrito" para terminar la compra.
            </li>
          </ol>
        </section>

        <section className="cu-card cu-stack">
          <strong className="cu-h3">Atajos</strong>
          <div className="cu-row" style={{ gap: 8, flexWrap: "wrap" }}>
            {storefrontUrl ? (
              <a href={storefrontUrl} className="cu-btn cu-btn-primary" target="_blank" rel="noreferrer">
                Ver storefront →
              </a>
            ) : null}
            {adminUrl ? (
              <a href={adminUrl} className="cu-btn" target="_blank" rel="noreferrer">
                Customize theme
              </a>
            ) : null}
          </div>
        </section>

        <section className="cu-card cu-stack">
          <strong className="cu-h3">¿Algo no funciona?</strong>
          <p className="cu-muted">
            Si el bloque no aparece en el theme editor, revisá que la app esté
            activada en <em>Configuración → Apps y canales de venta</em>. Si los
            precios USD no se ven, validá que el metafield de variante esté
            habilitado para Storefront API en <em>Configuración → Datos personalizados</em>.
          </p>
        </section>
      </main>
    </div>
  );
}
