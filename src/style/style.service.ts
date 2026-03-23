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
  'Enhance this nail salon photograph for Instagram. ' +
  //   'Smooth the skin subtly and naturally. ' +
  'Do not alter the physical properties of the hands at all.' +
  'Place the hands naturally in that environment. ' +
  'Do not remove any human body parts' +
  'Do not change the size of the hand or hands' +
  'CRITICAL: preserve the exact nail art, polish colour, and nail shape with zero modifications. ' +
  'Soft bokeh background. Professional beauty photography.';

/**
 * Hardcoded v1 styles. Stored in-memory for now — will migrate to MongoDB
 * via the Style schema once we need admin editing or A/B testing.
 */
const V1_STYLES: StylePreset[] = [
  {
    styleId: 'marble',
    name: 'Marble Luxe',
    description: 'Hands on marble, gold accents, soft light',
    promptTemplate: `${BASE_PROMPT} Place the hands on a marble tray with subtle gold accents. Lighting: soft diffused natural light from above. Style: luxurious, clean, editorial.`,
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
    promptTemplate: `${BASE_PROMPT} Dark/black out-of-focus background, high contrast lighting on hands, white surface beneath hands, professional studio-style feel, tight crop with minimal negative space, even diffused lighting from above/front, no visible clutter or props, clinical/polished vibe.`,
    thumbnailUrl: '',
    sortOrder: 1,
    active: true,
    buildPrompt() {
      return this.promptTemplate;
    },
  },

  // NEW STYLES

  {
    styleId: 'limewash',
    name: 'Limewash Neutral',
    description: 'Textured plaster wall, soft neutral tones',
    promptTemplate: `${BASE_PROMPT} Place the hands on a matte plaster or stone surface with a soft limewash wall background in warm neutral tones. Lighting: soft diffused natural light with gentle shadows. Style: modern, organic, high-end minimal.`,
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
    promptTemplate: `${BASE_PROMPT} Place the hands on a light ash wood surface with visible natural grain. Background softly blurred ash panels. Lighting: warm natural daylight from the side with soft shadows. Style: natural, clean, lifestyle.`,
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
