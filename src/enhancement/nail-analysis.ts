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
  marble: {
    background: 'Soft blurred marble wall',
    surface:
      'Polished white marble tray with subtle grey veining and gold accents',
    lighting: 'Soft diffused natural light from above, warm tone',
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
 * Uses the analysis to describe what must NOT change, and a direct
 * instruction to replace the background with Image 2.
 */
export function buildCustomBackgroundPrompt(analysis: NailAnalysis): string {
  const handDesc = `${analysis.hands.count} hand(s), ${analysis.hands.position}, skin tone: ${analysis.hands.skinTone}, visible: ${analysis.hands.visibleArea}`;
  const nailDesc = `${analysis.nails.count} nails, shape: ${analysis.nails.shape}, length: ${analysis.nails.length}, colour: ${analysis.nails.colour.primary}, finish: ${analysis.nails.finish}, art: ${analysis.nails.art.style}`;

  return `Two images provided. Image 1 is a nail photograph. Image 2 is a background/surface.
 
Replace the background and surface in Image 1 with the background and surface shown in Image 2. Place the hands naturally on Image 2's surface. Match the lighting and colour temperature of Image 2.
 
DO NOT MODIFY THE SUBJECT FROM IMAGE 1:
- Hands: ${handDesc}
- Nails: ${nailDesc}
- Do not change, add, remove, or reposition any hands, fingers, or nails
- Do not alter nail colour, art, shape, or finish in any way
 
The result should look like the hands from Image 1 were photographed on the surface in Image 2.`;
}
