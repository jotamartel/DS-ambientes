import { Links, Meta, Outlet } from "@remix-run/react";

// We intentionally render NO client-side bundle (no <Scripts>, no
// <ScrollRestoration>). This app is server-rendered only and behaves
// like a classic post-redirect-get website. Reason: Remix's client
// router fetches loader data via URLs that don't always survive
// Shopify's App Proxy cleanly, causing hydration mismatches and 404s.
// The trade-off is no SPA fluidity — every navigation is a full page
// reload — but it's bulletproof under the proxy.
export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
      </body>
    </html>
  );
}
