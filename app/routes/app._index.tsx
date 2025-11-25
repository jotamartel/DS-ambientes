import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineStack,
  Button,
  Badge,
  Box,
  InlineGrid,
  Divider,
  EmptyState,
} from "@shopify/polaris";
import { PlusIcon, ExternalIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getProjects, getProjectStats } from "../services/project.server";
import { formatCurrency, calculateProjectTotal } from "../services/shopify.api.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [{ projects }, stats] = await Promise.all([
    getProjects(shop, { limit: 5 }),
    getProjectStats(shop),
  ]);

  return json({
    projects,
    stats,
    shop,
  });
};

function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { tone: "success" | "warning" | "info" | "critical"; label: string }> = {
    draft: { tone: "warning", label: "Borrador" },
    active: { tone: "info", label: "Activo" },
    completed: { tone: "success", label: "Completado" },
    cancelled: { tone: "critical", label: "Cancelado" },
  };

  const { tone, label } = statusMap[status] || { tone: "info" as const, label: status };

  return <Badge tone={tone}>{label}</Badge>;
}

function StatCard({ title, value, helpText }: { title: string; value: string | number; helpText?: string }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd" tone="subdued">
          {title}
        </Text>
        <Text as="p" variant="headingXl">
          {value}
        </Text>
        {helpText && (
          <Text as="p" variant="bodySm" tone="subdued">
            {helpText}
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}

export default function Dashboard() {
  const { projects, stats } = useLoaderData<typeof loader>();

  return (
    <Page>
      <BlockStack gap="500">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h1" variant="headingXl">
            DS Ambientes
          </Text>
          <Button variant="primary" icon={PlusIcon} url="/app/projects/new">
            Nuevo Proyecto
          </Button>
        </InlineStack>

        <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
          <StatCard
            title="Proyectos Activos"
            value={stats.activeProjects}
          />
          <StatCard
            title="Completados este mes"
            value={stats.completedThisMonth}
          />
          <StatCard
            title="Valor en cotizaciones"
            value={formatCurrency(stats.totalQuotationValue)}
            helpText="Proyectos activos y borradores"
          />
        </InlineGrid>

        <Divider />

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Proyectos Recientes
                  </Text>
                  <Button variant="plain" url="/app/projects">
                    Ver todos
                  </Button>
                </InlineStack>

                {projects.length === 0 ? (
                  <EmptyState
                    heading="No hay proyectos aún"
                    action={{
                      content: "Crear proyecto",
                      url: "/app/projects/new",
                    }}
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Crea tu primer proyecto para comenzar a organizar las cotizaciones por ambiente.</p>
                  </EmptyState>
                ) : (
                  <BlockStack gap="300">
                    {projects.map((project) => {
                      const total = calculateProjectTotal(project.lists);
                      const itemCount = project.lists.reduce(
                        (sum, list) => sum + list.items.length,
                        0
                      );

                      return (
                        <Box
                          key={project.id}
                          padding="400"
                          background="bg-surface-secondary"
                          borderRadius="200"
                        >
                          <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="100">
                              <InlineStack gap="200" blockAlign="center">
                                <Link
                                  to={`/app/projects/${project.id}`}
                                  style={{ textDecoration: "none", color: "inherit" }}
                                >
                                  <Text as="span" variant="headingMd" fontWeight="semibold">
                                    {project.name}
                                  </Text>
                                </Link>
                                <StatusBadge status={project.status} />
                              </InlineStack>
                              <Text as="p" variant="bodySm" tone="subdued">
                                {project.clientName || "Sin cliente"} •{" "}
                                {project.lists.length} ambiente{project.lists.length !== 1 ? "s" : ""} •{" "}
                                {itemCount} producto{itemCount !== 1 ? "s" : ""}
                              </Text>
                            </BlockStack>
                            <BlockStack gap="100" inlineAlign="end">
                              <Text as="p" variant="headingSm">
                                {formatCurrency(total)}
                              </Text>
                              <Text as="p" variant="bodySm" tone="subdued">
                                {new Date(project.updatedAt).toLocaleDateString("es-AR")}
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </Box>
                      );
                    })}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Acciones Rápidas
                </Text>
                <BlockStack gap="200">
                  <Button fullWidth url="/app/projects/new" icon={PlusIcon}>
                    Nuevo Proyecto
                  </Button>
                  <Button fullWidth url="/app/projects" variant="secondary">
                    Ver Proyectos
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>

            <Box paddingBlockStart="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Ayuda
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Esta app te permite crear cotizaciones organizadas por ambiente o proyecto para tus clientes.
                  </Text>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm">
                      <strong>1.</strong> Crea un proyecto para tu cliente
                    </Text>
                    <Text as="p" variant="bodySm">
                      <strong>2.</strong> Agrega ambientes (Baño, Cocina, etc.)
                    </Text>
                    <Text as="p" variant="bodySm">
                      <strong>3.</strong> Selecciona productos para cada ambiente
                    </Text>
                    <Text as="p" variant="bodySm">
                      <strong>4.</strong> Comparte el presupuesto con tu cliente
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            </Box>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
