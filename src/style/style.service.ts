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
  'Enhance this nail salon photograph for Instagram while preserving the original composition and full anatomy. ' +
  'CRITICAL: Do not crop, remove, or alter any part of the body — wrists, arms, and all visible body parts must remain fully intact exactly as in the original image. ' +
  'Do not reposition or isolate the hands. Keep them naturally connected to the body. ' +
  'Do not change the size, proportions, or structure of the hands in any way. ' +
  'CRITICAL: preserve the exact nail art, polish colour, and nail shape with zero modifications. ' +
  'Only enhance the surrounding environment — do not replace or remove the original scene. ' +
  'Professional beauty photography. Gentle depth of field with soft background blur. ';

/**
 * Hardcoded v1 styles. Stored in-memory for now — will migrate to MongoDB
 * via the Style schema once we need admin editing or A/B testing.
 */
const V1_STYLES: StylePreset[] = [
  {
    styleId: 'marble',
    name: 'Marble Luxe',
    description: 'Hands on marble, gold accents, soft light',
    promptTemplate:
      `${BASE_PROMPT}` +
      'Add a luxurious marble surface beneath the existing hands without moving them, with subtle gold accents integrated naturally into the scene. ' +
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
    description: 'Professional studio flat-lay, beauty products',
    promptTemplate:
      `${BASE_PROMPT}` +
      'Enhance the scene into a professional studio setting without moving the hands: add a clean white or dark surface beneath them. ' +
      'Background should be softly out-of-focus and minimal. ' +
      'Lighting: controlled, even diffused studio lighting from above/front with soft shadows. ' +
      'Keep composition intact, no cropping. ' +
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
    description: 'Textured plaster wall, soft neutral tones',
    promptTemplate:
      `${BASE_PROMPT}` +
      'Enhance the environment with a matte plaster or stone surface beneath the hands and a soft limewash wall background in warm neutral tones, without moving the subject. ' +
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
    description: 'Light wood grain, natural feel',
    promptTemplate:
      `${BASE_PROMPT}` +
      'Enhance the scene with a light ash wood surface beneath the hands with visible natural grain, keeping the original positioning unchanged. ' +
      'Background: softly blurred natural wood panels. ' +
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
