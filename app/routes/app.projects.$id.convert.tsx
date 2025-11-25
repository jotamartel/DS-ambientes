import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Checkbox,
  Banner,
  Divider,
  Box,
} from "@shopify/polaris";
import { authenticate } from "../../shopify.server";
import { getProject, updateProject } from "../../services/project.server";
import {
  createDraftOrder,
  formatCurrency,
  calculateListSubtotal,
  calculateProjectTotal,
} from "../../services/shopify.api.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const project = await getProject(params.id!, shop);

  if (!project) {
    throw new Response("Proyecto no encontrado", { status: 404 });
  }

  // Filter lists that have items
  const listsWithItems = project.lists.filter((list) => list.items.length > 0);

  if (listsWithItems.length === 0) {
    return redirect(`/app/projects/${project.id}`);
  }

  return json({ project, listsWithItems });
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const selectedListIds = formData.getAll("selectedLists") as string[];

  if (selectedListIds.length === 0) {
    return json({ error: "Selecciona al menos una lista para convertir" }, { status: 400 });
  }

  try {
    const project = await getProject(params.id!, shop);

    if (!project) {
      return json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // Get selected lists and their items
    const selectedLists = project.lists.filter((list) =>
      selectedListIds.includes(list.id)
    );

    // Build line items for draft order
    const lineItems = selectedLists.flatMap((list) =>
      list.items.map((item) => ({
        variantId: item.shopifyVariantId,
        quantity: item.quantity,
        customAttributes: [
          { key: "Ambiente", value: list.name },
          ...(item.comment ? [{ key: "Nota", value: item.comment }] : []),
        ],
      }))
    );

    // Build notes
    const notes = [
      `Proyecto: ${project.name}`,
      project.clientName ? `Cliente: ${project.clientName}` : "",
      `Ambientes incluidos: ${selectedLists.map((l) => l.name).join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n");

    // Create draft order
    const draftOrder = await createDraftOrder(admin, {
      lineItems,
      note: notes,
      email: project.clientEmail || undefined,
      tags: [`proyecto:${project.name}`, "ds-ambientes"],
      customAttributes: [
        { key: "Proyecto ID", value: project.id },
        { key: "Proyecto", value: project.name },
      ],
    });

    // Update project status if all lists were converted
    if (selectedListIds.length === project.lists.filter((l) => l.items.length > 0).length) {
      await updateProject(project.id, shop, { status: "completed" });
    }

    return json({
      success: true,
      draftOrder: {
        id: draftOrder.id,
        name: draftOrder.name,
        invoiceUrl: draftOrder.invoiceUrl,
        totalPrice: draftOrder.totalPrice,
      },
    });
  } catch (error) {
    console.error("Error creating draft order:", error);
    return json(
      { error: error instanceof Error ? error.message : "Error al crear la orden" },
      { status: 500 }
    );
  }
};

export default function ConvertToOrder() {
  const { project, listsWithItems } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();

  const [selectedLists, setSelectedLists] = useState<string[]>(
    listsWithItems.map((l) => l.id)
  );

  const handleListToggle = useCallback((listId: string) => {
    setSelectedLists((prev) =>
      prev.includes(listId)
        ? prev.filter((id) => id !== listId)
        : [...prev, listId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedLists.length === listsWithItems.length) {
      setSelectedLists([]);
    } else {
      setSelectedLists(listsWithItems.map((l) => l.id));
    }
  }, [selectedLists, listsWithItems]);

  const selectedTotal = calculateProjectTotal(
    listsWithItems.filter((l) => selectedLists.includes(l.id))
  );

  const isSubmitting = fetcher.state === "submitting";
  const actionData = fetcher.data;

  if (actionData && "success" in actionData && actionData.success) {
    return (
      <Page
        title="Orden Creada"
        backAction={{ content: "Proyecto", url: `/app/projects/${project.id}` }}
      >
        <Card>
          <BlockStack gap="400">
            <Banner tone="success">
              <p>
                La orden borrador <strong>{actionData.draftOrder?.name}</strong> ha sido
                creada exitosamente.
              </p>
            </Banner>

            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                <strong>Total:</strong> {formatCurrency(parseFloat(actionData.draftOrder?.totalPrice || "0"))}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Puedes revisar y completar la orden desde el panel de administración de Shopify.
              </Text>
            </BlockStack>

            <InlineStack gap="300">
              <Button
                variant="primary"
                url={`https://${project.shop}/admin/draft_orders/${actionData.draftOrder?.id.split("/").pop()}`}
                external
              >
                Ver Orden en Shopify
              </Button>
              <Button url={`/app/projects/${project.id}`}>
                Volver al Proyecto
              </Button>
              <Button url="/app/projects">Ver Proyectos</Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="Convertir a Orden"
      subtitle={`Proyecto: ${project.name}`}
      backAction={{ content: "Proyecto", url: `/app/projects/${project.id}` }}
    >
      <Layout>
        <Layout.Section>
          <fetcher.Form method="post">
            <Card>
              <BlockStack gap="400">
                {actionData && "error" in actionData && (
                  <Banner tone="critical">{actionData.error}</Banner>
                )}

                <Text as="h2" variant="headingMd">
                  Selecciona los ambientes a incluir
                </Text>

                <Button
                  variant="plain"
                  onClick={handleSelectAll}
                >
                  {selectedLists.length === listsWithItems.length
                    ? "Deseleccionar todos"
                    : "Seleccionar todos"}
                </Button>

                <BlockStack gap="300">
                  {listsWithItems.map((list) => {
                    const subtotal = calculateListSubtotal(list.items);
                    const isSelected = selectedLists.includes(list.id);

                    return (
                      <Box
                        key={list.id}
                        padding="400"
                        background={isSelected ? "bg-surface-selected" : "bg-surface-secondary"}
                        borderRadius="200"
                        borderWidth="025"
                        borderColor={isSelected ? "border-success" : "border"}
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="300" blockAlign="center">
                            <Checkbox
                              label=""
                              checked={isSelected}
                              onChange={() => handleListToggle(list.id)}
                              name="selectedLists"
                              value={list.id}
                            />
                            <BlockStack gap="050">
                              <Text as="span" variant="bodyMd" fontWeight="semibold">
                                {list.name}
                              </Text>
                              <Text as="span" variant="bodySm" tone="subdued">
                                {list.items.length} producto{list.items.length !== 1 ? "s" : ""}
                              </Text>
                            </BlockStack>
                          </InlineStack>
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {formatCurrency(subtotal)}
                          </Text>
                        </InlineStack>
                      </Box>
                    );
                  })}
                </BlockStack>

                <Divider />

                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text as="p" variant="headingSm">
                      Total seleccionado
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {selectedLists.length} ambiente{selectedLists.length !== 1 ? "s" : ""}
                    </Text>
                  </BlockStack>
                  <Text as="p" variant="headingLg">
                    {formatCurrency(selectedTotal)}
                  </Text>
                </InlineStack>

                <Button
                  submit
                  variant="primary"
                  size="large"
                  disabled={selectedLists.length === 0 || isSubmitting}
                  loading={isSubmitting}
                  fullWidth
                >
                  Crear Orden Borrador
                </Button>
              </BlockStack>
            </Card>
          </fetcher.Form>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Información
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Al convertir a orden borrador:
              </Text>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm">
                  • Se creará un Draft Order en Shopify
                </Text>
                <Text as="p" variant="bodySm">
                  • Los comentarios de productos se incluirán como atributos
                </Text>
                <Text as="p" variant="bodySm">
                  • Se identificará el ambiente de cada producto
                </Text>
                <Text as="p" variant="bodySm">
                  • Podrás editar la orden antes de confirmarla
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          {project.clientEmail && (
            <Box paddingBlockStart="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Cliente
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {project.clientName || "Sin nombre"}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {project.clientEmail}
                  </Text>
                </BlockStack>
              </Card>
            </Box>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
