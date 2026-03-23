import { Injectable } from '@nestjs/common';

export interface StylePreset {
  styleId: string;
  name: string;
  description: string;
  promptTemplate: string;
  thumbnailUrl: string;
  sortOrder: number;
  active: boolean;
  buildPrompt: () => string;
}

const BASE_PROMPT =
  'Enhance this nail salon photograph for Instagram while strictly preserving the original composition and full anatomy. ' +
  'CRITICAL: Do not crop, remove, replace, or regenerate any part of the body — wrists, arms, and all visible body parts must remain fully intact and continuous with the original image. ' +
  'Do not isolate, cut out, or reposition the hands. The subject must remain embedded in the original scene. ' +
  'Do not change the size, proportions, or structure of the hands in any way. ' +
  'CRITICAL: preserve the exact nail art, polish colour, and nail shape with zero modifications. ' +
  'CRITICAL: Do not replace, rebuild, or simplify the background. Retain all original background elements, shapes, and structure. ' +
  'Only apply subtle visual enhancement and stylistic transformation to the existing environment. ' +
  'Professional beauty photography. Gentle depth of field with soft, realistic background blur. ';

/**
 * Hardcoded v1 styles. Stored in-memory for now — will migrate to MongoDB
 */
const V1_STYLES: StylePreset[] = [
  {
    styleId: 'marble',
    name: 'Marble Luxe',
    description: 'Marble-inspired luxury styling',
    promptTemplate:
      `${BASE_PROMPT}` +
      'Subtly refine the existing surface and tones to resemble a luxurious marble aesthetic with soft white and grey veining, while preserving original shapes and perspective. ' +
      'Introduce delicate gold-toned accents through lighting and colour grading only (no new objects). ' +
      'Lighting: soft diffused natural light from above. ' +
      'Style: luxurious, clean, editorial.',
    thumbnailUrl: '',
    sortOrder: 0,
    active: true,
    buildPrompt() {
      return this.promptTemplate;
    },
  },
  {
    styleId: 'salon-pro',
    name: 'Salon Studio',
    description: 'Clean studio lighting and polish',
    promptTemplate:
      `${BASE_PROMPT}` +
      'Refine the existing environment to feel like a professional studio using lighting and tone adjustments only. ' +
      'Simplify visual noise through soft blur and contrast, without removing objects. ' +
      'Lighting: controlled, even diffused studio lighting from above/front with soft shadows. ' +
      'Style: clinical, polished, high-end salon photography.',
    thumbnailUrl: '',
    sortOrder: 1,
    active: true,
    buildPrompt() {
      return this.promptTemplate;
    },
  },
  {
    styleId: 'limewash',
    name: 'Limewash Neutral',
    description: 'Soft neutral plaster aesthetic',
    promptTemplate:
      `${BASE_PROMPT}` +
      'Gently transform the tones and texture of the existing background to resemble a soft limewash or plaster wall in warm neutral tones, without removing or replacing any elements. ' +
      'Maintain all original structure while applying a matte, organic finish. ' +
      'Lighting: soft diffused natural light with gentle shadows. ' +
      'Style: modern, organic, high-end minimal.',
    thumbnailUrl: '',
    sortOrder: 2,
    active: true,
    buildPrompt() {
      return this.promptTemplate;
    },
  },
  {
    styleId: 'oak',
    name: 'Natural Oak',
    description: 'Warm natural wood tones',
    promptTemplate:
      `${BASE_PROMPT}` +
      'Subtly adjust the surface and colour tones to resemble a light ash wood texture with natural grain, while preserving all original shapes and perspective. ' +
      'Apply warm, natural colour grading to evoke a soft wood-toned environment without introducing new elements. ' +
      'Lighting: warm natural daylight from the side with soft shadows. ' +
      'Style: natural, clean, lifestyle.',
    thumbnailUrl: '',
    sortOrder: 3,
    active: true,
    buildPrompt() {
      return this.promptTemplate;
    },
  },
];

@Injectable()
export class StyleService {
  findAll(): StylePreset[] {
    return V1_STYLES.filter((s) => s.active).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
  }

  findById(styleId: string): StylePreset | undefined {
    return V1_STYLES.find((s) => s.styleId === styleId && s.active);
  }
}
