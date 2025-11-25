import prisma from "~/db.server";
import type { Project, List, ListItem, Prisma } from "@prisma/client";
import crypto from "crypto";

export type ProjectWithLists = Project & {
  lists: (List & {
    items: ListItem[];
  })[];
};

// ============ PROJECTS ============

export async function getProjects(
  shop: string,
  options?: {
    status?: string;
    search?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
  }
) {
  const { status, search, assignedTo, page = 1, limit = 20 } = options || {};

  const where: Prisma.ProjectWhereInput = {
    shop,
    ...(status && { status }),
    ...(assignedTo && { assignedTo }),
    ...(search && {
      OR: [
        { name: { contains: search } },
        { clientName: { contains: search } },
        { clientEmail: { contains: search } },
      ],
    }),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        lists: {
          include: {
            items: true,
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.project.count({ where }),
  ]);

  return {
    projects,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getProject(id: string, shop: string): Promise<ProjectWithLists | null> {
  return prisma.project.findFirst({
    where: { id, shop },
    include: {
      lists: {
        include: {
          items: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function getProjectByShareToken(shareToken: string): Promise<ProjectWithLists | null> {
  return prisma.project.findUnique({
    where: { shareToken },
    include: {
      lists: {
        include: {
          items: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function createProject(
  shop: string,
  data: {
    name: string;
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    assignedTo?: string;
    notes?: string;
  }
) {
  return prisma.project.create({
    data: {
      shop,
      ...data,
      status: "draft",
    },
    include: {
      lists: true,
    },
  });
}

export async function updateProject(
  id: string,
  shop: string,
  data: Partial<{
    name: string;
    clientName: string | null;
    clientEmail: string | null;
    clientPhone: string | null;
    status: string;
    assignedTo: string | null;
    notes: string | null;
  }>
) {
  return prisma.project.update({
    where: { id },
    data,
    include: {
      lists: {
        include: {
          items: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function deleteProject(id: string, shop: string) {
  // Verify ownership before delete
  const project = await prisma.project.findFirst({
    where: { id, shop },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return prisma.project.delete({
    where: { id },
  });
}

export async function generateShareToken(id: string, shop: string) {
  const token = crypto.randomBytes(32).toString("hex");

  return prisma.project.update({
    where: { id },
    data: { shareToken: token },
  });
}

export async function removeShareToken(id: string, shop: string) {
  return prisma.project.update({
    where: { id },
    data: { shareToken: null },
  });
}

// ============ LISTS ============

export async function createList(
  projectId: string,
  shop: string,
  data: { name: string }
) {
  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, shop },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Get max order
  const maxOrder = await prisma.list.aggregate({
    where: { projectId },
    _max: { order: true },
  });

  return prisma.list.create({
    data: {
      projectId,
      name: data.name,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: {
      items: true,
    },
  });
}

export async function updateList(
  listId: string,
  shop: string,
  data: { name?: string; order?: number }
) {
  // Verify ownership through project
  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: { project: true },
  });

  if (!list || list.project.shop !== shop) {
    throw new Error("List not found");
  }

  return prisma.list.update({
    where: { id: listId },
    data,
    include: {
      items: true,
    },
  });
}

export async function deleteList(listId: string, shop: string) {
  // Verify ownership through project
  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: { project: true },
  });

  if (!list || list.project.shop !== shop) {
    throw new Error("List not found");
  }

  return prisma.list.delete({
    where: { id: listId },
  });
}

export async function duplicateList(listId: string, shop: string) {
  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: { project: true, items: true },
  });

  if (!list || list.project.shop !== shop) {
    throw new Error("List not found");
  }

  // Get max order
  const maxOrder = await prisma.list.aggregate({
    where: { projectId: list.projectId },
    _max: { order: true },
  });

  // Create new list with copied items
  return prisma.list.create({
    data: {
      projectId: list.projectId,
      name: `${list.name} (copia)`,
      order: (maxOrder._max.order ?? 0) + 1,
      items: {
        create: list.items.map((item) => ({
          shopifyProductId: item.shopifyProductId,
          shopifyVariantId: item.shopifyVariantId,
          productTitle: item.productTitle,
          variantTitle: item.variantTitle,
          productImage: item.productImage,
          quantity: item.quantity,
          comment: item.comment,
          unitPrice: item.unitPrice,
        })),
      },
    },
    include: {
      items: true,
    },
  });
}

export async function reorderLists(
  projectId: string,
  shop: string,
  listOrder: string[]
) {
  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, shop },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Update order for each list
  const updates = listOrder.map((listId, index) =>
    prisma.list.update({
      where: { id: listId },
      data: { order: index },
    })
  );

  return prisma.$transaction(updates);
}

// ============ LIST ITEMS ============

export async function addItemToList(
  listId: string,
  shop: string,
  data: {
    shopifyProductId: string;
    shopifyVariantId: string;
    productTitle: string;
    variantTitle?: string;
    productImage?: string;
    quantity: number;
    unitPrice: number;
    comment?: string;
  }
) {
  // Verify ownership through project
  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: { project: true },
  });

  if (!list || list.project.shop !== shop) {
    throw new Error("List not found");
  }

  return prisma.listItem.create({
    data: {
      listId,
      shopifyProductId: data.shopifyProductId,
      shopifyVariantId: data.shopifyVariantId,
      productTitle: data.productTitle,
      variantTitle: data.variantTitle,
      productImage: data.productImage,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      comment: data.comment,
    },
  });
}

export async function updateListItem(
  itemId: string,
  shop: string,
  data: {
    quantity?: number;
    comment?: string | null;
    unitPrice?: number;
  }
) {
  // Verify ownership through project
  const item = await prisma.listItem.findUnique({
    where: { id: itemId },
    include: { list: { include: { project: true } } },
  });

  if (!item || item.list.project.shop !== shop) {
    throw new Error("Item not found");
  }

  return prisma.listItem.update({
    where: { id: itemId },
    data,
  });
}

export async function deleteListItem(itemId: string, shop: string) {
  // Verify ownership through project
  const item = await prisma.listItem.findUnique({
    where: { id: itemId },
    include: { list: { include: { project: true } } },
  });

  if (!item || item.list.project.shop !== shop) {
    throw new Error("Item not found");
  }

  return prisma.listItem.delete({
    where: { id: itemId },
  });
}

// ============ STATISTICS ============

export async function getProjectStats(shop: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [activeCount, completedThisMonth, allProjects] = await Promise.all([
    prisma.project.count({
      where: { shop, status: "active" },
    }),
    prisma.project.count({
      where: {
        shop,
        status: "completed",
        updatedAt: { gte: startOfMonth },
      },
    }),
    prisma.project.findMany({
      where: { shop, status: { in: ["draft", "active"] } },
      include: {
        lists: {
          include: {
            items: true,
          },
        },
      },
    }),
  ]);

  // Calculate total value of active quotations
  let totalValue = 0;
  for (const project of allProjects) {
    for (const list of project.lists) {
      for (const item of list.items) {
        totalValue += Number(item.unitPrice) * item.quantity;
      }
    }
  }

  return {
    activeProjects: activeCount,
    completedThisMonth,
    totalQuotationValue: totalValue,
  };
}
