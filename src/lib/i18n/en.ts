const messages = {
  "app.title": "Medical web",
  "app.description": "Medical web development foundation.",
  "navigation.skipToContent": "Skip to main content",
  "home.heading": "Medical web foundation",
  "home.description": "This development page provides the foundation for the medical web application.",
  "home.status": "Application foundation ready",
  "footer.notice": "Development page. No patient information is collected here.",
} as const;

export type TranslationKey = keyof typeof messages;
export const locale = "en";
export function t(key: TranslationKey): string {
  return messages[key];
}
