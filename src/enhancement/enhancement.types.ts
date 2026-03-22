export interface EnhancementJobData {
  enhancementId: string;
  originalImageUrl: string;
  backgroundImageUrl?: string;
  styleId: string;
  resolution: 'standard' | 'hd';
  prompt: string;
  deviceUUID: string;
}

export interface BackgroundExtractJobData {
  sourceImageUrl: string;
  sourceImageKey: string;
  deviceId: string;
  deviceUUID: string;
  backgroundName: string;
}
