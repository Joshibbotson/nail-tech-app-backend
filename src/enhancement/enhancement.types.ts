export interface EnhancementJobData {
  enhancementId: string;
  originalImageUrl: string;
  backgroundImageUrl?: string;
  styleId: string;
  prompt: string; // Fallback prompt if analysis fails
  deviceUUID: string;
}
