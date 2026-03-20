// ═══════════════════════════════════════════════════════════════════
// Two-Pass Enhancement Pipeline (Simplified)
// ═══════════════════════════════════════════════════════════════════
//
// Pass 1: "Describe this image as JSON" → get exact state
// Pass 2: Modify only the scene fields → "Adjust the image to match this JSON"
//
// The model receives the SAME JSON it produced, with only the scene
// changed. Everything else stays identical = everything else is preserved.
// ═══════════════════════════════════════════════════════════════════

export interface NailAnalysis {
  hands: {
    count: number;
    position: string;
    skinTone: string;
    visibleArea: string;
    jewellery: string[];
  };

  nails: {
    count: number;
    shape: string;
    length: string;
    colour: {
      primary: string;
      secondary: string | null;
      gradient: string | null;
    };
    finish: string;
    art: {
      style: string;
      perNailDetails: string[];
      textures: string[];
      embellishments: string[];
    };
  };

  scene: {
    background: string;
    surface: string;
    lighting: string;
    cameraAngle: string;
  };
}

export const ANALYSIS_PROMPT = `Describe this photograph as JSON. Return ONLY valid JSON, no backticks, no explanation.

{
  "hands": {
    "count": <1 or 2>,
    "position": "<exact hand position and pose>",
    "skinTone": "<skin tone description>",
    "visibleArea": "<what parts are visible>",
    "jewellery": [<list of jewellery with locations>]
  },
  "nails": {
    "count": <total visible nails>,
    "shape": "<nail shape>",
    "length": "<nail length>",
    "colour": {
      "primary": "<main colour with hex if possible>",
      "secondary": "<second colour or null>",
      "gradient": "<gradient description or null>"
    },
    "finish": "<finish type>",
    "art": {
      "style": "<overall art style>",
      "perNailDetails": [<describe each nail: "thumb: ...", "index: ...", etc>],
      "textures": [<texture details>],
      "embellishments": [<embellishment details with positions>]
    }
  },
  "scene": {
    "background": "<current background>",
    "surface": "<current surface>",
    "lighting": "<current lighting>",
    "cameraAngle": "<camera angle>"
  }
}`;

/**
 * Take the analysis JSON, replace only the scene fields
 * with the desired style, return the modified JSON as a string.
 */
export function buildModifiedJson(
  analysis: NailAnalysis,
  sceneOverride: Partial<NailAnalysis['scene']>,
): string {
  const modified: NailAnalysis = {
    ...analysis,
    scene: {
      ...analysis.scene,
      ...sceneOverride,
    },
  };

  return JSON.stringify(modified, null, 2);
}

/**
 * Scene overrides for each style preset.
 */
export const STYLE_SCENE_OVERRIDES: Record<
  string,
  Partial<NailAnalysis['scene']>
> = {
  limewash: {
    background:
      'Soft limewash plaster wall in warm neutral tones, subtly textured',
    surface: 'Matte plaster or stone surface with organic imperfections',
    lighting: 'Soft diffused natural light with gentle shadows',
  },
  oak: {
    background: 'Light ash wood panel wall, softly blurred',
    surface: 'Natural light ash wood grain surface, smooth and warm',
    lighting: 'Warm natural daylight from the side, soft shadows',
  },
  stone: {
    background: 'Textured travertine or limestone wall, softly out of focus',
    surface: 'Raw stone slab with subtle pits and texture',
    lighting: 'Soft directional daylight enhancing texture',
  },
  glass: {
    background: 'Clean blurred glass panels with soft reflections',
    surface: 'Glossy glass surface with subtle reflections',
    lighting: 'Bright soft studio light with gentle highlights',
  },
  'cream-boujee': {
    background: 'Soft beige luxury interior, minimal and blurred',
    surface: 'Smooth cream surface with subtle satin finish',
    lighting: 'High-end diffused lighting, soft and flattering',
  },
  marble: {
    background: 'Soft blurred marble wall',
    surface:
      'Polished white marble tray with subtle grey veining and gold accents',
    lighting: 'Soft diffused natural light from above, warm tone',
  },
  minimal: {
    background: 'Pure white, seamless',
    surface: 'Clean white surface, no texture',
    lighting: 'Bright even studio lighting, minimal shadows',
  },
  floral: {
    background: 'Soft blurred dried flowers and eucalyptus',
    surface: 'Natural linen fabric with dried flower stems nearby',
    lighting: 'Warm golden hour side light',
  },
  cosy: {
    background: 'Warm blurred interior with candle glow',
    surface: 'Chunky cream knit blanket texture',
    lighting: 'Warm amber candlelight mixed with soft window light',
  },
  'dark-moody': {
    background: 'Dark, out of focus, deep shadows',
    surface: 'Dark slate or matte black concrete',
    lighting: 'Dramatic directional light from one side, deep shadows',
  },
  'salon-pro': {
    background: 'Clean studio backdrop',
    surface: 'White professional studio surface',
    lighting: 'Bright diffused studio lighting, even and professional',
  },
};

/**
 * Build the Pass 2 prompt for style presets.
 */
export function buildEnhancementPrompt(modifiedJson: string): string {
  return `Change ONLY the background, surface, and lighting in this image to match the "scene" section of the JSON below. Do not modify the hands, nails, skin, or any other part of the subject.

${modifiedJson}`;
}

/**
 * Build the Pass 2 prompt for a custom background (two images).
 */
export function buildCustomBackgroundPrompt(modifiedJson: string): string {
  return `Two images provided. Image 1 is the subject. Image 2 is the target background.

Replace ONLY the background, surface, and lighting in Image 1 to match Image 2. Do not modify the hands, nails, skin, or any other part of the subject in Image 1.

${modifiedJson}`;
}
