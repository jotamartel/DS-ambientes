import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useNavigation, Form } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  TextField,
  Button,
  FormLayout,
  Banner,
  Select,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { createProject } from "../services/project.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const clientName = formData.get("clientName") as string | null;
  const clientEmail = formData.get("clientEmail") as string | null;
  const clientPhone = formData.get("clientPhone") as string | null;
  const assignedTo = formData.get("assignedTo") as string | null;
  const notes = formData.get("notes") as string | null;

  if (!name || name.trim() === "") {
    return json({ error: "El nombre del proyecto es requerido" }, { status: 400 });
  }

  try {
    const project = await createProject(shop, {
      name: name.trim(),
      clientName: clientName?.trim() || undefined,
      clientEmail: clientEmail?.trim() || undefined,
      clientPhone: clientPhone?.trim() || undefined,
      assignedTo: assignedTo?.trim() || undefined,
      notes: notes?.trim() || undefined,
    });

    return redirect(`/app/projects/${project.id}`);
  } catch (error) {
    console.error("Error creating project:", error);
    return json({ error: "Error al crear el proyecto" }, { status: 500 });
  }
};

export default function NewProject() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Page
      title="Nuevo Proyecto"
      backAction={{ content: "Proyectos", url: "/app/projects" }}
    >
      <Card>
        <Form method="post">
          <BlockStack gap="400">
            {actionData?.error && (
              <Banner tone="critical">
                {actionData.error}
              </Banner>
            )}

            <FormLayout>
              <TextField
                label="Nombre del Proyecto"
                name="name"
                value={name}
                onChange={setName}
                autoComplete="off"
                placeholder="Ej: Casa familia García"
                requiredIndicator
                helpText="Un nombre descriptivo para identificar el proyecto"
              />

              <FormLayout.Group>
                <TextField
                  label="Nombre del Cliente"
                  name="clientName"
                  value={clientName}
                  onChange={setClientName}
                  autoComplete="name"
                  placeholder="Ej: Juan García"
                />

                <TextField
                  label="Email del Cliente"
                  name="clientEmail"
                  type="email"
                  value={clientEmail}
                  onChange={setClientEmail}
                  autoComplete="email"
                  placeholder="cliente@email.com"
                />
              </FormLayout.Group>

              <FormLayout.Group>
                <TextField
                  label="Teléfono del Cliente"
                  name="clientPhone"
                  type="tel"
                  value={clientPhone}
                  onChange={setClientPhone}
                  autoComplete="tel"
                  placeholder="+54 11 1234-5678"
                />

                <TextField
                  label="Vendedor Asignado"
                  name="assignedTo"
                  value={assignedTo}
                  onChange={setAssignedTo}
                  autoComplete="off"
                  placeholder="Nombre del vendedor"
                />
              </FormLayout.Group>

              <TextField
                label="Notas"
                name="notes"
                value={notes}
                onChange={setNotes}
                multiline={3}
                autoComplete="off"
                placeholder="Notas adicionales sobre el proyecto..."
              />
            </FormLayout>

            <Button submit variant="primary" loading={isSubmitting}>
              Crear Proyecto
            </Button>
          </BlockStack>
        </Form>
      </Card>
    </Page>
  );
}
