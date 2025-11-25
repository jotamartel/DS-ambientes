import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useFetcher, useNavigate } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  Box,
  Modal,
  TextField,
  FormLayout,
  Banner,
  Divider,
  Select,
  ButtonGroup,
  Tooltip,
  Icon,
  IndexTable,
  Thumbnail,
  EmptyState,
} from "@shopify/polaris";
import {
  PlusIcon,
  DeleteIcon,
  EditIcon,
  ShareIcon,
  ExportIcon,
  CartIcon,
  DuplicateIcon,
  ImageIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import {
  getProject,
  updateProject,
  deleteProject,
  createList,
  deleteList,
  duplicateList,
  generateShareToken,
  removeShareToken,
} from "../services/project.server";
import {
  formatCurrency,
  calculateListSubtotal,
  calculateProjectTotal,
} from "../services/shopify.api.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const project = await getProject(params.id!, shop);

  if (!project) {
    throw new Response("Proyecto no encontrado", { status: 404 });
  }

  const appUrl = process.env.SHOPIFY_APP_URL || "";

  return json({ project, shop, appUrl });
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const action = formData.get("_action") as string;

  try {
    switch (action) {
      case "updateProject": {
        const name = formData.get("name") as string;
        const clientName = formData.get("clientName") as string;
        const clientEmail = formData.get("clientEmail") as string;
        const clientPhone = formData.get("clientPhone") as string;
        const status = formData.get("status") as string;
        const assignedTo = formData.get("assignedTo") as string;
        const notes = formData.get("notes") as string;

        await updateProject(params.id!, shop, {
          name,
          clientName: clientName || null,
          clientEmail: clientEmail || null,
          clientPhone: clientPhone || null,
          status,
          assignedTo: assignedTo || null,
          notes: notes || null,
        });

        return json({ success: true });
      }

      case "deleteProject": {
        await deleteProject(params.id!, shop);
        return redirect("/app/projects");
      }

      case "createList": {
        const listName = formData.get("listName") as string;
        if (!listName) {
          return json({ error: "El nombre de la lista es requerido" }, { status: 400 });
        }
        await createList(params.id!, shop, { name: listName });
        return json({ success: true });
      }

      case "deleteList": {
        const listId = formData.get("listId") as string;
        await deleteList(listId, shop);
        return json({ success: true });
      }

      case "duplicateList": {
        const listId = formData.get("listId") as string;
        await duplicateList(listId, shop);
        return json({ success: true });
      }

      case "generateShareLink": {
        await generateShareToken(params.id!, shop);
        return json({ success: true });
      }

      case "removeShareLink": {
        await removeShareToken(params.id!, shop);
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

export default function ProjectDetail() {
  const { project, appUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [newListModalOpen, setNewListModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [deleteListId, setDeleteListId] = useState<string | null>(null);

  // Form states
  const [editForm, setEditForm] = useState({
    name: project.name,
    clientName: project.clientName || "",
    clientEmail: project.clientEmail || "",
    clientPhone: project.clientPhone || "",
    status: project.status,
    assignedTo: project.assignedTo || "",
    notes: project.notes || "",
  });
  const [newListName, setNewListName] = useState("");

  const projectTotal = calculateProjectTotal(project.lists);
  const shareUrl = project.shareToken ? `${appUrl}/share/${project.shareToken}` : null;

  const handleEditSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append("_action", "updateProject");
    Object.entries(editForm).forEach(([key, value]) => {
      formData.append(key, value);
    });
    fetcher.submit(formData, { method: "post" });
    setEditModalOpen(false);
  }, [editForm, fetcher]);

  const handleCreateList = useCallback(() => {
    if (!newListName.trim()) return;
    const formData = new FormData();
    formData.append("_action", "createList");
    formData.append("listName", newListName);
    fetcher.submit(formData, { method: "post" });
    setNewListName("");
    setNewListModalOpen(false);
  }, [newListName, fetcher]);

  const handleDeleteList = useCallback((listId: string) => {
    const formData = new FormData();
    formData.append("_action", "deleteList");
    formData.append("listId", listId);
    fetcher.submit(formData, { method: "post" });
    setDeleteListId(null);
  }, [fetcher]);

  const handleDuplicateList = useCallback((listId: string) => {
    const formData = new FormData();
    formData.append("_action", "duplicateList");
    formData.append("listId", listId);
    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);

  const handleGenerateShareLink = useCallback(() => {
    const formData = new FormData();
    formData.append("_action", "generateShareLink");
    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);

  const handleRemoveShareLink = useCallback(() => {
    const formData = new FormData();
    formData.append("_action", "removeShareLink");
    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);

  const copyShareLink = useCallback(() => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
    }
  }, [shareUrl]);

  return (
    <Page
      title={project.name}
      titleMetadata={<StatusBadge status={project.status} />}
      backAction={{ content: "Proyectos", url: "/app/projects" }}
      secondaryActions={[
        {
          content: "Editar",
          icon: EditIcon,
          onAction: () => setEditModalOpen(true),
        },
        {
          content: "Compartir",
          icon: ShareIcon,
          onAction: () => setShareModalOpen(true),
        },
        {
          content: "Eliminar",
          icon: DeleteIcon,
          destructive: true,
          onAction: () => setDeleteModalOpen(true),
        },
      ]}
      primaryAction={{
        content: "Convertir a Orden",
        icon: CartIcon,
        url: `/app/projects/${project.id}/convert`,
        disabled: project.lists.every((l) => l.items.length === 0),
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {actionData && "error" in actionData && (
              <Banner tone="critical">{actionData.error}</Banner>
            )}

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Ambientes / Listas
                  </Text>
                  <Button icon={PlusIcon} onClick={() => setNewListModalOpen(true)}>
                    Agregar Ambiente
                  </Button>
                </InlineStack>

                {project.lists.length === 0 ? (
                  <EmptyState
                    heading="No hay ambientes"
                    action={{
                      content: "Agregar ambiente",
                      onAction: () => setNewListModalOpen(true),
                    }}
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Agrega ambientes como "Baño", "Cocina", "Living" para organizar los productos.</p>
                  </EmptyState>
                ) : (
                  <BlockStack gap="400">
                    {project.lists.map((list) => {
                      const subtotal = calculateListSubtotal(list.items);

                      return (
                        <Card key={list.id}>
                          <BlockStack gap="300">
                            <InlineStack align="space-between" blockAlign="center">
                              <InlineStack gap="200" blockAlign="center">
                                <Text as="h3" variant="headingSm">
                                  {list.name}
                                </Text>
                                <Badge>{list.items.length} productos</Badge>
                              </InlineStack>
                              <ButtonGroup>
                                <Button
                                  size="slim"
                                  url={`/app/projects/${project.id}/lists/${list.id}`}
                                >
                                  Gestionar
                                </Button>
                                <Button
                                  size="slim"
                                  icon={DuplicateIcon}
                                  onClick={() => handleDuplicateList(list.id)}
                                  accessibilityLabel="Duplicar lista"
                                />
                                <Button
                                  size="slim"
                                  icon={DeleteIcon}
                                  tone="critical"
                                  onClick={() => setDeleteListId(list.id)}
                                  accessibilityLabel="Eliminar lista"
                                />
                              </ButtonGroup>
                            </InlineStack>

                            {list.items.length > 0 ? (
                              <>
                                <IndexTable
                                  resourceName={{ singular: "producto", plural: "productos" }}
                                  itemCount={list.items.length}
                                  headings={[
                                    { title: "Producto" },
                                    { title: "Cantidad" },
                                    { title: "Precio" },
                                    { title: "Subtotal" },
                                  ]}
                                  selectable={false}
                                >
                                  {list.items.slice(0, 3).map((item, index) => (
                                    <IndexTable.Row key={item.id} id={item.id} position={index}>
                                      <IndexTable.Cell>
                                        <InlineStack gap="200" blockAlign="center">
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
                                            {item.variantTitle && item.variantTitle !== "Default Title" && (
                                              <Text as="span" variant="bodySm" tone="subdued">
                                                {item.variantTitle}
                                              </Text>
                                            )}
                                            {item.comment && (
                                              <Text as="span" variant="bodySm" tone="subdued">
                                                Nota: {item.comment}
                                              </Text>
                                            )}
                                          </BlockStack>
                                        </InlineStack>
                                      </IndexTable.Cell>
                                      <IndexTable.Cell>{item.quantity}</IndexTable.Cell>
                                      <IndexTable.Cell>
                                        {formatCurrency(Number(item.unitPrice))}
                                      </IndexTable.Cell>
                                      <IndexTable.Cell>
                                        {formatCurrency(Number(item.unitPrice) * item.quantity)}
                                      </IndexTable.Cell>
                                    </IndexTable.Row>
                                  ))}
                                </IndexTable>
                                {list.items.length > 3 && (
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    + {list.items.length - 3} productos más
                                  </Text>
                                )}
                                <Divider />
                                <InlineStack align="end">
                                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                                    Subtotal: {formatCurrency(subtotal)}
                                  </Text>
                                </InlineStack>
                              </>
                            ) : (
                              <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                                <InlineStack align="center">
                                  <Button url={`/app/projects/${project.id}/lists/${list.id}`}>
                                    Agregar productos
                                  </Button>
                                </InlineStack>
                              </Box>
                            )}
                          </BlockStack>
                        </Card>
                      );
                    })}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Resumen
                </Text>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">
                      Ambientes
                    </Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {project.lists.length}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">
                      Total Productos
                    </Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {project.lists.reduce((sum, l) => sum + l.items.length, 0)}
                    </Text>
                  </InlineStack>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" variant="headingSm">
                      Total
                    </Text>
                    <Text as="span" variant="headingLg">
                      {formatCurrency(projectTotal)}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Cliente
                </Text>
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd">
                    {project.clientName || "Sin nombre"}
                  </Text>
                  {project.clientEmail && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      {project.clientEmail}
                    </Text>
                  )}
                  {project.clientPhone && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      {project.clientPhone}
                    </Text>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>

            {project.assignedTo && (
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Vendedor
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {project.assignedTo}
                  </Text>
                </BlockStack>
              </Card>
            )}

            {project.notes && (
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Notas
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {project.notes}
                  </Text>
                </BlockStack>
              </Card>
            )}

            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Fechas
                </Text>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Creado: {new Date(project.createdAt).toLocaleDateString("es-AR")}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Actualizado: {new Date(project.updatedAt).toLocaleDateString("es-AR")}
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* Edit Project Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Editar Proyecto"
        primaryAction={{
          content: "Guardar",
          onAction: handleEditSubmit,
        }}
        secondaryActions={[
          {
            content: "Cancelar",
            onAction: () => setEditModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Nombre del Proyecto"
              value={editForm.name}
              onChange={(value) => setEditForm((prev) => ({ ...prev, name: value }))}
              autoComplete="off"
            />
            <FormLayout.Group>
              <TextField
                label="Nombre del Cliente"
                value={editForm.clientName}
                onChange={(value) => setEditForm((prev) => ({ ...prev, clientName: value }))}
                autoComplete="name"
              />
              <TextField
                label="Email del Cliente"
                type="email"
                value={editForm.clientEmail}
                onChange={(value) => setEditForm((prev) => ({ ...prev, clientEmail: value }))}
                autoComplete="email"
              />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField
                label="Teléfono del Cliente"
                type="tel"
                value={editForm.clientPhone}
                onChange={(value) => setEditForm((prev) => ({ ...prev, clientPhone: value }))}
                autoComplete="tel"
              />
              <TextField
                label="Vendedor Asignado"
                value={editForm.assignedTo}
                onChange={(value) => setEditForm((prev) => ({ ...prev, assignedTo: value }))}
                autoComplete="off"
              />
            </FormLayout.Group>
            <Select
              label="Estado"
              options={[
                { label: "Borrador", value: "draft" },
                { label: "Activo", value: "active" },
                { label: "Completado", value: "completed" },
                { label: "Cancelado", value: "cancelled" },
              ]}
              value={editForm.status}
              onChange={(value) => setEditForm((prev) => ({ ...prev, status: value }))}
            />
            <TextField
              label="Notas"
              value={editForm.notes}
              onChange={(value) => setEditForm((prev) => ({ ...prev, notes: value }))}
              multiline={3}
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Delete Project Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Eliminar Proyecto"
        primaryAction={{
          content: "Eliminar",
          destructive: true,
          onAction: () => {
            const formData = new FormData();
            formData.append("_action", "deleteProject");
            fetcher.submit(formData, { method: "post" });
          },
        }}
        secondaryActions={[
          {
            content: "Cancelar",
            onAction: () => setDeleteModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            ¿Estás seguro de que deseas eliminar el proyecto "{project.name}"?
            Esta acción no se puede deshacer y se eliminarán todas las listas y productos asociados.
          </Text>
        </Modal.Section>
      </Modal>

      {/* New List Modal */}
      <Modal
        open={newListModalOpen}
        onClose={() => setNewListModalOpen(false)}
        title="Agregar Ambiente"
        primaryAction={{
          content: "Crear",
          onAction: handleCreateList,
          disabled: !newListName.trim(),
        }}
        secondaryActions={[
          {
            content: "Cancelar",
            onAction: () => {
              setNewListName("");
              setNewListModalOpen(false);
            },
          },
        ]}
      >
        <Modal.Section>
          <TextField
            label="Nombre del Ambiente"
            value={newListName}
            onChange={setNewListName}
            autoComplete="off"
            placeholder="Ej: Baño Principal, Cocina, Living"
            helpText="El nombre del espacio o área del proyecto"
          />
        </Modal.Section>
      </Modal>

      {/* Delete List Modal */}
      <Modal
        open={deleteListId !== null}
        onClose={() => setDeleteListId(null)}
        title="Eliminar Ambiente"
        primaryAction={{
          content: "Eliminar",
          destructive: true,
          onAction: () => deleteListId && handleDeleteList(deleteListId),
        }}
        secondaryActions={[
          {
            content: "Cancelar",
            onAction: () => setDeleteListId(null),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            ¿Estás seguro de que deseas eliminar este ambiente?
            Todos los productos asociados serán eliminados.
          </Text>
        </Modal.Section>
      </Modal>

      {/* Share Modal */}
      <Modal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Compartir Proyecto"
      >
        <Modal.Section>
          <BlockStack gap="400">
            {shareUrl ? (
              <>
                <Text as="p" variant="bodyMd">
                  Comparte este enlace con tu cliente para que pueda ver el presupuesto:
                </Text>
                <TextField
                  label="Enlace de compartir"
                  value={shareUrl}
                  readOnly
                  autoComplete="off"
                  connectedRight={
                    <Button onClick={copyShareLink}>Copiar</Button>
                  }
                />
                <Button tone="critical" onClick={handleRemoveShareLink}>
                  Desactivar enlace
                </Button>
              </>
            ) : (
              <>
                <Text as="p" variant="bodyMd">
                  Genera un enlace público para compartir este proyecto con tu cliente.
                  El cliente podrá ver el presupuesto sin necesidad de iniciar sesión.
                </Text>
                <Button variant="primary" onClick={handleGenerateShareLink}>
                  Generar enlace
                </Button>
              </>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
