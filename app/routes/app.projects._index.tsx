import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, useNavigate } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  InlineStack,
  Button,
  Badge,
  Box,
  Filters,
  ChoiceList,
  TextField,
  EmptyState,
  Pagination,
  ResourceList,
  ResourceItem,
  Avatar,
} from "@shopify/polaris";
import { PlusIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getProjects } from "../services/project.server";
import { formatCurrency, calculateProjectTotal } from "../services/shopify.api.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  const result = await getProjects(shop, { status, search, page, limit: 20 });

  return json(result);
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

export default function ProjectsList() {
  const { projects, total, page, totalPages } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [queryValue, setQueryValue] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState<string[]>(
    searchParams.get("status") ? [searchParams.get("status")!] : []
  );

  const handleStatusChange = useCallback(
    (value: string[]) => {
      setStatusFilter(value);
      const params = new URLSearchParams(searchParams);
      if (value.length > 0) {
        params.set("status", value[0]);
      } else {
        params.delete("status");
      }
      params.set("page", "1");
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setQueryValue(value);
    },
    []
  );

  const handleSearchSubmit = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    if (queryValue) {
      params.set("search", queryValue);
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    setSearchParams(params);
  }, [queryValue, searchParams, setSearchParams]);

  const handleClearAll = useCallback(() => {
    setQueryValue("");
    setStatusFilter([]);
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams);
      params.set("page", newPage.toString());
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const filters = [
    {
      key: "status",
      label: "Estado",
      filter: (
        <ChoiceList
          title="Estado"
          titleHidden
          choices={[
            { label: "Borrador", value: "draft" },
            { label: "Activo", value: "active" },
            { label: "Completado", value: "completed" },
            { label: "Cancelado", value: "cancelled" },
          ]}
          selected={statusFilter}
          onChange={handleStatusChange}
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = statusFilter.map((status) => ({
    key: "status",
    label: `Estado: ${status === "draft" ? "Borrador" : status === "active" ? "Activo" : status === "completed" ? "Completado" : "Cancelado"}`,
    onRemove: () => handleStatusChange([]),
  }));

  return (
    <Page
      title="Proyectos"
      primaryAction={{
        content: "Nuevo Proyecto",
        icon: PlusIcon,
        url: "/app/projects/new",
      }}
    >
      <Card>
        <BlockStack gap="400">
          <Filters
            queryValue={queryValue}
            queryPlaceholder="Buscar por nombre o cliente..."
            filters={filters}
            appliedFilters={appliedFilters}
            onQueryChange={handleSearchChange}
            onQueryClear={() => {
              setQueryValue("");
              const params = new URLSearchParams(searchParams);
              params.delete("search");
              setSearchParams(params);
            }}
            onClearAll={handleClearAll}
          >
            <Box paddingInlineStart="200">
              <Button onClick={handleSearchSubmit}>Buscar</Button>
            </Box>
          </Filters>

          {projects.length === 0 ? (
            <EmptyState
              heading="No se encontraron proyectos"
              action={{
                content: "Crear proyecto",
                url: "/app/projects/new",
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                {queryValue || statusFilter.length > 0
                  ? "Intenta con otros filtros de búsqueda"
                  : "Crea tu primer proyecto para comenzar"}
              </p>
            </EmptyState>
          ) : (
            <>
              <ResourceList
                resourceName={{ singular: "proyecto", plural: "proyectos" }}
                items={projects}
                renderItem={(project) => {
                  const total = calculateProjectTotal(project.lists);
                  const itemCount = project.lists.reduce(
                    (sum, list) => sum + list.items.length,
                    0
                  );

                  return (
                    <ResourceItem
                      id={project.id}
                      url={`/app/projects/${project.id}`}
                      media={
                        <Avatar
                          customer
                          size="md"
                          name={project.clientName || project.name}
                        />
                      }
                      accessibilityLabel={`Ver proyecto ${project.name}`}
                    >
                      <InlineStack align="space-between" blockAlign="start" wrap={false}>
                        <BlockStack gap="100">
                          <InlineStack gap="200" blockAlign="center">
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              {project.name}
                            </Text>
                            <StatusBadge status={project.status} />
                          </InlineStack>
                          <Text as="p" variant="bodySm" tone="subdued">
                            {project.clientName || "Sin cliente"} •{" "}
                            {project.lists.length} ambiente{project.lists.length !== 1 ? "s" : ""} •{" "}
                            {itemCount} producto{itemCount !== 1 ? "s" : ""}
                          </Text>
                          {project.assignedTo && (
                            <Text as="p" variant="bodySm" tone="subdued">
                              Vendedor: {project.assignedTo}
                            </Text>
                          )}
                        </BlockStack>
                        <BlockStack gap="100" inlineAlign="end">
                          <Text as="p" variant="bodyMd" fontWeight="semibold">
                            {formatCurrency(total)}
                          </Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            {new Date(project.updatedAt).toLocaleDateString("es-AR")}
                          </Text>
                        </BlockStack>
                      </InlineStack>
                    </ResourceItem>
                  );
                }}
              />

              {totalPages > 1 && (
                <Box paddingBlockStart="400">
                  <InlineStack align="center">
                    <Pagination
                      hasPrevious={page > 1}
                      onPrevious={() => handlePageChange(page - 1)}
                      hasNext={page < totalPages}
                      onNext={() => handlePageChange(page + 1)}
                    />
                  </InlineStack>
                </Box>
              )}
            </>
          )}
        </BlockStack>
      </Card>
    </Page>
  );
}
