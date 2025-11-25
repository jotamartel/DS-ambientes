import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Box,
  Modal,
  TextField,
  FormLayout,
  Banner,
  Divider,
  IndexTable,
  Thumbnail,
  Icon,
  ButtonGroup,
  EmptyState,
} from "@shopify/polaris";
import { ResourcePicker } from "@shopify/app-bridge-react";
import {
  PlusIcon,
  DeleteIcon,
  EditIcon,
  ImageIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../../shopify.server";
import prisma from "../../db.server";
import {
  updateList,
  addItemToList,
  updateListItem,
  deleteListItem,
} from "../../services/project.server";
import {
  getProductVariant,
  formatCurrency,
  calculateListSubtotal,
} from "../../services/shopify.api.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const list = await prisma.list.findUnique({
    where: { id: params.listId },
    include: {
      project: true,
      items: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!list || list.project.shop !== shop) {
    throw new Response("Lista no encontrada", { status: 404 });
  }

  return json({ list, project: list.project });
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const action = formData.get("_action") as string;

  try {
    switch (action) {
      case "updateList": {
        const name = formData.get("name") as string;
        if (!name) {
          return json({ error: "El nombre es requerido" }, { status: 400 });
        }
        await updateList(params.listId!, shop, { name });
        return json({ success: true });
      }

      case "addProducts": {
        const productsJson = formData.get("products") as string;
        const products = JSON.parse(productsJson);

        for (const product of products) {
          for (const variant of product.variants) {
            // Get variant details from Shopify
            const variantData = await getProductVariant(admin, variant.id);

            if (variantData) {
              await addItemToList(params.listId!, shop, {
                shopifyProductId: variantData.product.id,
                shopifyVariantId: variantData.id,
                productTitle: variantData.product.title,
                variantTitle: variantData.title !== "Default Title" ? variantData.title : undefined,
                productImage: variantData.image?.url || variantData.product.featuredImage?.url,
                quantity: 1,
                unitPrice: parseFloat(variantData.price),
              });
            }
          }
        }

        return json({ success: true });
      }

      case "updateItem": {
        const itemId = formData.get("itemId") as string;
        const quantity = parseInt(formData.get("quantity") as string, 10);
        const comment = formData.get("comment") as string;

        await updateListItem(itemId, shop, {
          quantity: quantity || 1,
          comment: comment || null,
        });

        return json({ success: true });
      }

      case "deleteItem": {
        const itemId = formData.get("itemId") as string;
        await deleteListItem(itemId, shop);
        return json({ success: true });
      }

      default:
        return json({ error: "Acción no válida" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in action:", error);
    return json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
};

export default function ListDetail() {
  const { list, project } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const [resourcePickerOpen, setResourcePickerOpen] = useState(false);
  const [editListModalOpen, setEditListModalOpen] = useState(false);
  const [editItemModalOpen, setEditItemModalOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const [listName, setListName] = useState(list.name);
  const [editingItem, setEditingItem] = useState<{
    id: string;
    quantity: number;
    comment: string;
  } | null>(null);

  const subtotal = calculateListSubtotal(list.items);

  const handleProductSelect = useCallback(
    (selectPayload: { selection: Array<{ id: string; variants: Array<{ id: string }> }> }) => {
      const formData = new FormData();
      formData.append("_action", "addProducts");
      formData.append("products", JSON.stringify(selectPayload.selection));
      fetcher.submit(formData, { method: "post" });
      setResourcePickerOpen(false);
    },
    [fetcher]
  );

  const handleUpdateList = useCallback(() => {
    if (!listName.trim()) return;
    const formData = new FormData();
    formData.append("_action", "updateList");
    formData.append("name", listName);
    fetcher.submit(formData, { method: "post" });
    setEditListModalOpen(false);
  }, [listName, fetcher]);

  const handleEditItem = useCallback((item: typeof list.items[0]) => {
    setEditingItem({
      id: item.id,
      quantity: item.quantity,
      comment: item.comment || "",
    });
    setEditItemModalOpen(true);
  }, []);

  const handleUpdateItem = useCallback(() => {
    if (!editingItem) return;
    const formData = new FormData();
    formData.append("_action", "updateItem");
    formData.append("itemId", editingItem.id);
    formData.append("quantity", editingItem.quantity.toString());
    formData.append("comment", editingItem.comment);
    fetcher.submit(formData, { method: "post" });
    setEditItemModalOpen(false);
    setEditingItem(null);
  }, [editingItem, fetcher]);

  const handleDeleteItem = useCallback((itemId: string) => {
    const formData = new FormData();
    formData.append("_action", "deleteItem");
    formData.append("itemId", itemId);
    fetcher.submit(formData, { method: "post" });
    setDeleteItemId(null);
  }, [fetcher]);

  return (
    <Page
      title={list.name}
      subtitle={`Proyecto: ${project.name}`}
      backAction={{ content: "Proyecto", url: `/app/projects/${project.id}` }}
      primaryAction={{
        content: "Agregar Productos",
        icon: PlusIcon,
        onAction: () => setResourcePickerOpen(true),
      }}
      secondaryActions={[
        {
          content: "Editar nombre",
          icon: EditIcon,
          onAction: () => setEditListModalOpen(true),
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              {list.items.length === 0 ? (
                <EmptyState
                  heading="No hay productos en esta lista"
                  action={{
                    content: "Agregar productos",
                    onAction: () => setResourcePickerOpen(true),
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Agrega productos de tu catálogo para comenzar a armar el presupuesto.</p>
                </EmptyState>
              ) : (
                <>
                  <IndexTable
                    resourceName={{ singular: "producto", plural: "productos" }}
                    itemCount={list.items.length}
                    headings={[
                      { title: "Producto" },
                      { title: "Cantidad", alignment: "center" },
                      { title: "Precio unitario", alignment: "end" },
                      { title: "Subtotal", alignment: "end" },
                      { title: "Acciones", alignment: "end" },
                    ]}
                    selectable={false}
                  >
                    {list.items.map((item, index) => (
                      <IndexTable.Row key={item.id} id={item.id} position={index}>
                        <IndexTable.Cell>
                          <InlineStack gap="300" blockAlign="center">
                            {item.productImage ? (
                              <Thumbnail
                                source={item.productImage}
                                alt={item.productTitle}
                                size="small"
                              />
                            ) : (
                              <Box
                                background="bg-surface-secondary"
                                padding="200"
                                borderRadius="100"
                              >
                                <Icon source={ImageIcon} tone="subdued" />
                              </Box>
                            )}
                            <BlockStack gap="050">
                              <Text as="span" variant="bodyMd" fontWeight="medium">
                                {item.productTitle}
                              </Text>
                              {item.variantTitle && (
                                <Text as="span" variant="bodySm" tone="subdued">
                                  {item.variantTitle}
                                </Text>
                              )}
                              {item.comment && (
                                <Box
                                  background="bg-surface-info"
                                  padding="100"
                                  borderRadius="100"
                                >
                                  <Text as="span" variant="bodySm">
                                    📝 {item.comment}
                                  </Text>
                                </Box>
                              )}
                            </BlockStack>
                          </InlineStack>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" alignment="center">
                            {item.quantity}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" alignment="end">
                            {formatCurrency(Number(item.unitPrice))}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" alignment="end" fontWeight="semibold">
                            {formatCurrency(Number(item.unitPrice) * item.quantity)}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <InlineStack gap="100" align="end">
                            <Button
                              size="slim"
                              icon={EditIcon}
                              onClick={() => handleEditItem(item)}
                              accessibilityLabel="Editar"
                            />
                            <Button
                              size="slim"
                              icon={DeleteIcon}
                              tone="critical"
                              onClick={() => setDeleteItemId(item.id)}
                              accessibilityLabel="Eliminar"
                            />
                          </InlineStack>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>

                  <Divider />

                  <InlineStack align="end">
                    <BlockStack gap="100" inlineAlign="end">
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {list.items.length} producto{list.items.length !== 1 ? "s" : ""}
                      </Text>
                      <Text as="p" variant="headingLg">
                        Total: {formatCurrency(subtotal)}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Información
              </Text>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd" tone="subdued">
                    Ambiente
                  </Text>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {list.name}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd" tone="subdued">
                    Productos
                  </Text>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {list.items.length}
                  </Text>
                </InlineStack>
                <Divider />
                <InlineStack align="space-between">
                  <Text as="span" variant="headingSm">
                    Subtotal
                  </Text>
                  <Text as="span" variant="headingMd">
                    {formatCurrency(subtotal)}
                  </Text>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>

          <Box paddingBlockStart="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Notas de productos
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Puedes agregar comentarios a cada producto para recordar detalles importantes,
                  como "este piso para el baño de María" o "verificar stock antes de ordenar".
                </Text>
              </BlockStack>
            </Card>
          </Box>
        </Layout.Section>
      </Layout>

      {/* Resource Picker */}
      <ResourcePicker
        resourceType="Product"
        open={resourcePickerOpen}
        onCancel={() => setResourcePickerOpen(false)}
        onSelection={handleProductSelect}
        showVariants={true}
        selectMultiple={true}
      />

      {/* Edit List Modal */}
      <Modal
        open={editListModalOpen}
        onClose={() => setEditListModalOpen(false)}
        title="Editar Ambiente"
        primaryAction={{
          content: "Guardar",
          onAction: handleUpdateList,
          disabled: !listName.trim(),
        }}
        secondaryActions={[
          {
            content: "Cancelar",
            onAction: () => {
              setListName(list.name);
              setEditListModalOpen(false);
            },
          },
        ]}
      >
        <Modal.Section>
          <TextField
            label="Nombre del Ambiente"
            value={listName}
            onChange={setListName}
            autoComplete="off"
          />
        </Modal.Section>
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        open={editItemModalOpen}
        onClose={() => {
          setEditItemModalOpen(false);
          setEditingItem(null);
        }}
        title="Editar Producto"
        primaryAction={{
          content: "Guardar",
          onAction: handleUpdateItem,
        }}
        secondaryActions={[
          {
            content: "Cancelar",
            onAction: () => {
              setEditItemModalOpen(false);
              setEditingItem(null);
            },
          },
        ]}
      >
        <Modal.Section>
          {editingItem && (
            <FormLayout>
              <TextField
                label="Cantidad"
                type="number"
                value={editingItem.quantity.toString()}
                onChange={(value) =>
                  setEditingItem((prev) =>
                    prev ? { ...prev, quantity: parseInt(value, 10) || 1 } : null
                  )
                }
                min={1}
                autoComplete="off"
              />
              <TextField
                label="Comentario / Nota"
                value={editingItem.comment}
                onChange={(value) =>
                  setEditingItem((prev) => (prev ? { ...prev, comment: value } : null))
                }
                multiline={2}
                autoComplete="off"
                placeholder="Ej: Este piso para el baño de María"
                helpText="Agrega notas para recordar detalles importantes sobre este producto"
              />
            </FormLayout>
          )}
        </Modal.Section>
      </Modal>

      {/* Delete Item Modal */}
      <Modal
        open={deleteItemId !== null}
        onClose={() => setDeleteItemId(null)}
        title="Eliminar Producto"
        primaryAction={{
          content: "Eliminar",
          destructive: true,
          onAction: () => deleteItemId && handleDeleteItem(deleteItemId),
        }}
        secondaryActions={[
          {
            content: "Cancelar",
            onAction: () => setDeleteItemId(null),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            ¿Estás seguro de que deseas eliminar este producto de la lista?
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
