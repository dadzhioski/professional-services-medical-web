export const messages = {
  "systemStatus.heading": "System status",
  "systemStatus.service": "Service",
  "systemStatus.version": "Version",
  "systemStatus.status": "Status",
  "systemStatus.up": "UP",
  "systemStatus.unavailable": "Service status is currently unavailable. Please try again later.",
  "app.title": "Medical web",
  "app.description": "Medical web development foundation.",
  "navigation.skipToContent": "Skip to main content",
  "home.heading": "Medical web foundation",
  "home.description": "This development page provides the foundation for the medical web application.",
  "home.status": "Application foundation ready",
  "footer.notice": "Development page. No patient information is collected here.",
  "navigation.language": "Language",
  "profile.introduction": "Professional introduction",
  "profile.specialties": "Specialties",
  "profile.credentials": "Credentials",
  "profile.services": "Services",
  "profile.locations": "Practice locations",
  "notFound.heading": "Page not found",
  "notFound.description": "The requested page is not available.",
  "form.professionalName": "Professional name",
  "form.nameHint": "Enter the name displayed on your professional profile.",
  "form.nameRequired": "Enter a professional name.",
  "form.save": "Save",
  "preview.notice": "Synthetic presentation for testing only.",
} as const;

export type TranslationKey = keyof typeof messages;
export const locale = "en";
export function t(key: TranslationKey): string {
  return messages[key];
}
