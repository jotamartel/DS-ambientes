import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

export interface ProductVariant {
  id: string;
  title: string;
  price: string;
  inventoryQuantity: number | null;
  image?: {
    url: string;
  } | null;
  product: {
    id: string;
    title: string;
    featuredImage?: {
      url: string;
    } | null;
  };
}

export interface ProductInfo {
  id: string;
  title: string;
  handle: string;
  featuredImage?: {
    url: string;
  } | null;
  variants: {
    nodes: Array<{
      id: string;
      title: string;
      price: string;
      inventoryQuantity: number | null;
    }>;
  };
}

const GET_PRODUCTS_QUERY = `#graphql
  query getProducts($first: Int!, $query: String) {
    products(first: $first, query: $query) {
      nodes {
        id
        title
        handle
        featuredImage {
          url
        }
        variants(first: 10) {
          nodes {
            id
            title
            price
            inventoryQuantity
          }
        }
      }
    }
  }
`;

const GET_PRODUCT_VARIANT_QUERY = `#graphql
  query getProductVariant($id: ID!) {
    productVariant(id: $id) {
      id
      title
      price
      inventoryQuantity
      image {
        url
      }
      product {
        id
        title
        featuredImage {
          url
        }
      }
    }
  }
`;

const GET_PRODUCT_VARIANTS_QUERY = `#graphql
  query getProductVariants($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        price
        inventoryQuantity
        image {
          url
        }
        product {
          id
          title
          featuredImage {
            url
          }
        }
      }
    }
  }
`;

const CREATE_DRAFT_ORDER_MUTATION = `#graphql
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        invoiceUrl
        totalPrice
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_SHOP_INFO_QUERY = `#graphql
  query getShopInfo {
    shop {
      name
      email
      primaryDomain {
        url
      }
      currencyCode
      contactEmail
    }
  }
`;

export async function searchProducts(
  admin: AdminApiContext["admin"],
  query: string,
  limit = 20
): Promise<ProductInfo[]> {
  const response = await admin.graphql(GET_PRODUCTS_QUERY, {
    variables: {
      first: limit,
      query: query || null,
    },
  });

  const data = await response.json();
  return data.data?.products?.nodes || [];
}

export async function getProductVariant(
  admin: AdminApiContext["admin"],
  variantId: string
): Promise<ProductVariant | null> {
  const response = await admin.graphql(GET_PRODUCT_VARIANT_QUERY, {
    variables: { id: variantId },
  });

  const data = await response.json();
  return data.data?.productVariant || null;
}

export async function getProductVariants(
  admin: AdminApiContext["admin"],
  variantIds: string[]
): Promise<ProductVariant[]> {
  if (variantIds.length === 0) return [];

  const response = await admin.graphql(GET_PRODUCT_VARIANTS_QUERY, {
    variables: { ids: variantIds },
  });

  const data = await response.json();
  return (data.data?.nodes || []).filter(Boolean);
}

export interface DraftOrderLineItem {
  variantId: string;
  quantity: number;
  customAttributes?: Array<{ key: string; value: string }>;
}

export interface DraftOrderInput {
  lineItems: DraftOrderLineItem[];
  note?: string;
  email?: string;
  tags?: string[];
  customAttributes?: Array<{ key: string; value: string }>;
}

export async function createDraftOrder(
  admin: AdminApiContext["admin"],
  input: DraftOrderInput
) {
  const response = await admin.graphql(CREATE_DRAFT_ORDER_MUTATION, {
    variables: { input },
  });

  const data = await response.json();

  if (data.data?.draftOrderCreate?.userErrors?.length > 0) {
    throw new Error(
      data.data.draftOrderCreate.userErrors
        .map((e: { message: string }) => e.message)
        .join(", ")
    );
  }

  return data.data?.draftOrderCreate?.draftOrder;
}

export async function getShopInfo(admin: AdminApiContext["admin"]) {
  const response = await admin.graphql(GET_SHOP_INFO_QUERY);
  const data = await response.json();
  return data.data?.shop;
}

// Format currency based on shop settings
export function formatCurrency(amount: number, currencyCode = "ARS"): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

// Calculate list subtotal
export function calculateListSubtotal(
  items: Array<{ unitPrice: number | string; quantity: number }>
): number {
  return items.reduce((sum, item) => {
    return sum + Number(item.unitPrice) * item.quantity;
  }, 0);
}

// Calculate project total
export function calculateProjectTotal(
  lists: Array<{
    items: Array<{ unitPrice: number | string; quantity: number }>;
  }>
): number {
  return lists.reduce((sum, list) => {
    return sum + calculateListSubtotal(list.items);
  }, 0);
}
