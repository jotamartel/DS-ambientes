import {
  BotActivityDetected,
  CookieNotFound,
  InvalidOAuthError,
  InvalidSession,
} from "@shopify/shopify-api";

export function loginErrorMessage(loginResponse: Response) {
  if (loginResponse instanceof Response && loginResponse.status === 400) {
    return { shop: "Invalid shop domain" };
  }

  if (loginResponse instanceof Response) {
    return { shop: loginResponse.statusText };
  }

  if (loginResponse instanceof CookieNotFound) {
    return {
      shop:
        "No se pudo encontrar la cookie de sesión. Por favor, asegúrate de que las cookies estén habilitadas.",
    };
  }

  if (loginResponse instanceof InvalidOAuthError) {
    return { shop: "Error de autenticación OAuth. Por favor, intenta de nuevo." };
  }

  if (loginResponse instanceof InvalidSession) {
    return { shop: "Sesión inválida. Por favor, inicia sesión de nuevo." };
  }

  if (loginResponse instanceof BotActivityDetected) {
    return { shop: "Actividad sospechosa detectada. Por favor, intenta de nuevo." };
  }

  return {};
}
