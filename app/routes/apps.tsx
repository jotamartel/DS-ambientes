import type { LinksFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import customerStyles from "~/customer-ui/styles.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: customerStyles },
];

export default function AppsParent() {
  return <Outlet />;
}
