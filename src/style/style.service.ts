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
    styleId: 'minimal',
    name: 'Clean White',
    description: 'Pure white surface, bright even lighting',
    promptTemplate: `${BASE_PROMPT} Place the hands on a pure white surface. Lighting: bright, even studio lighting with minimal shadows. Style: minimalist, clean, modern.`,
    thumbnailUrl: '',
    sortOrder: 1,
    active: true,
    buildPrompt() {
      return this.promptTemplate;
    },
  },
  {
    styleId: 'floral',
    name: 'Soft Floral',
    description: 'Dried flowers, linen, warm tones',
    promptTemplate: `${BASE_PROMPT} Place the hands on a linen surface surrounded by dried flowers and eucalyptus. Lighting: warm golden hour light from the side. Style: organic, feminine, warm.`,
    thumbnailUrl: '',
    sortOrder: 2,
    active: true,
    buildPrompt() {
      return this.promptTemplate;
    },
  },
  {
    styleId: 'cosy',
    name: 'Warm & Cosy',
    description: 'Knit textures, candle warmth, autumn tones',
    promptTemplate: `${BASE_PROMPT} Place the hands resting on a chunky knit blanket with a candle nearby. Lighting: warm amber candlelight mixed with soft window light. Style: cosy, autumnal, inviting.`,
    thumbnailUrl: '',
    sortOrder: 3,
    active: true,
    buildPrompt() {
      return this.promptTemplate;
    },
  },
  {
    styleId: 'dark-moody',
    name: 'Dark Moody',
    description: 'Dark slate, dramatic shadows, editorial',
    promptTemplate: `${BASE_PROMPT} Place the hands on a dark slate or concrete surface. Lighting: dramatic directional light with deep shadows. Style: moody, editorial, high-fashion.`,
    thumbnailUrl: '',
    sortOrder: 4,
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
    sortOrder: 5,
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
    sortOrder: 6,
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
    sortOrder: 7,
    active: true,
    buildPrompt() {
      return this.promptTemplate;
    },
  },
  {
    styleId: 'stone',
    name: 'Stone Minimal',
    description: 'Raw stone texture, neutral aesthetic',
    promptTemplate: `${BASE_PROMPT} Place the hands on a raw travertine or limestone surface with subtle natural texture. Background softly blurred stone wall. Lighting: soft directional daylight to enhance texture. Style: minimal, earthy, editorial.`,
    thumbnailUrl: '',
    sortOrder: 8,
    active: true,
    buildPrompt() {
      return this.promptTemplate;
    },
  },
  {
    styleId: 'glass',
    name: 'Glossy Glass',
    description: 'Clean reflections, modern glossy surface',
    promptTemplate: `${BASE_PROMPT} Place the hands on a glossy glass surface with subtle reflections. Background of blurred glass panels. Lighting: bright soft studio lighting with gentle highlights. Style: sleek, modern, high-end beauty.`,
    thumbnailUrl: '',
    sortOrder: 9,
    active: true,
    buildPrompt() {
      return this.promptTemplate;
    },
  },
  {
    styleId: 'cream-boujee',
    name: 'Cream Luxury',
    description: 'Soft beige luxury aesthetic',
    promptTemplate: `${BASE_PROMPT} Place the hands on a smooth cream surface with a soft beige luxury interior background. Lighting: high-end diffused lighting, soft and flattering. Style: elegant, premium, influencer aesthetic.`,
    thumbnailUrl: '',
    sortOrder: 10,
    active: true,
    buildPrompt() {
      return this.promptTemplate;
    },
  },
  {
    styleId: 'spa',
    name: 'Spa Calm',
    description: 'Relaxing spa textures, neutral tones',
    promptTemplate: `${BASE_PROMPT} Place the hands on a neutral stone or folded towel surface with a soft blurred spa background. Lighting: calm soft lighting with slight warmth. Style: relaxing, clean, wellness aesthetic.`,
    thumbnailUrl: '',
    sortOrder: 11,
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
