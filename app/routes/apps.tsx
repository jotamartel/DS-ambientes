import type { LinksFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import customerStyles from "~/customer-ui/styles.css?url";

export const links: LinksFunction = () => {
  const prefix =
    customerStyles.startsWith("/") && process.env.SHOPIFY_APP_URL
      ? process.env.SHOPIFY_APP_URL.replace(/\/$/, "")
      : "";
  return [{ rel: "stylesheet", href: prefix + customerStyles }];
};

export default function AppsParent() {
  return <Outlet />;
}
