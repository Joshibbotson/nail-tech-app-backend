// ═══════════════════════════════════════════════════════════════════
// Two-Pass Enhancement Pipeline (Simplified)
// ═══════════════════════════════════════════════════════════════════
//
// Pass 1: "Describe this image as JSON" → get exact state
// Pass 2: Modify only the scene fields → "Adjust the image to match this JSON"
//
// The model receives the SAME JSON it produced, with only the scene
// changed. Everything else stays identical = everything else is preserved.
//
// IMPORTANT: Style presets describe aesthetic MOODS, not physical
// environments. The model restyles the existing scene — it does not
// reconstruct it. This prevents hand/body repositioning.
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
    "visibleArea": "<what parts are visible — include arms, wrists, body if any are in frame>",
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
 *
 * These describe aesthetic MOODS and colour grading, NOT physical
 * environments. The word "Same surface" anchors the model to restyle
 * what already exists rather than reconstructing the scene.
 */
export const STYLE_SCENE_OVERRIDES: Record<
  string,
  Partial<NailAnalysis['scene']>
> = {
  limewash: {
    background:
      'Warm neutral tones, soft plaster-like texture, muted and organic feel',
    surface:
      'Limestone surface with matte, warm-toned colour grading and subtle organic texture',
    lighting: 'Soft diffused natural light, gentle shadows, warm tone',
  },
  oak: {
    background: 'Warm woody tones, soft and natural colour palette',
    surface:
      'Oak surface with warm natural wood-toned colour grading, smooth and inviting',
    lighting: 'Warm natural side lighting, soft shadows',
  },
  marble: {
    background: 'Elegant tones, clean and refined feel',
    surface:
      'Marble surface with cool, polished colour grading and subtle contrast',
    lighting: 'Soft diffused light from above, cool-to-neutral tone',
  },
  'salon-pro': {
    background: 'Clean, bright, neutral backdrop',
    surface: 'White surface with bright, even, professional colour grading',
    lighting:
      'Bright diffused even lighting, minimal shadows, professional tone',
  },
};

/**
 * Build the Pass 2 prompt for style presets.
 *
 * Subject preservation rules come FIRST and are marked as highest
 * priority. The task is framed as colour grading / restyling, NOT
 * scene reconstruction.
 */
export function buildEnhancementPrompt(modifiedJson: string): string {
  return `CRITICAL PRESERVATION RULES (highest priority — these override ALL other instructions):
- Do NOT move, reposition, resize, add, or remove any hands, fingers, arms, or any part of any human body
- Do NOT alter any nail art, polish colour, nail shape, or finish
- Do NOT remove, obscure, or crop any person or body part visible in the image
- Every visible human element must remain in the EXACT same position, pose, scale, and crop
- If a person or body part is partially visible in the background, it MUST remain exactly as-is

TASK: Adjust ONLY the colour grading, tones, textures, and lighting of the background and surface to match the aesthetic described in the "scene" section below. The background geometry, composition, and all human body parts must stay the same — only the visual style and mood changes. Think of this as applying a colour grade and lighting filter, not replacing the scene.

${modifiedJson}`;
}

/**
 * Build the Pass 2 prompt for a custom background (two images).
 *
 * Image 2 is used as a background BEHIND the subject — never as
 * an overlay. The background adapts to fit the subject, not the
 * other way around.
 */
export function buildCustomBackgroundPrompt(analysis: NailAnalysis): string {
  const handDesc = `${analysis.hands.count} hand(s), ${analysis.hands.position}, skin tone: ${analysis.hands.skinTone}, visible: ${analysis.hands.visibleArea}`;
  const nailDesc = `${analysis.nails.count} nails, shape: ${analysis.nails.shape}, length: ${analysis.nails.length}, colour: ${analysis.nails.colour.primary}, finish: ${analysis.nails.finish}, art: ${analysis.nails.art.style}`;

  return `Two images provided. Image 1 is a nail photograph. Image 2 is a background/surface reference.

CRITICAL PRESERVATION RULES (highest priority — these override ALL other instructions):
- The hands, arms, and any visible human body parts from Image 1 must remain EXACTLY as they are — same position, same pose, same scale, same crop
- Do NOT move, reposition, resize, remove, or alter any part of any person
- Do NOT alter any nail art, polish colour, nail shape, or finish
- If a person's body is partially visible in Image 1, it MUST remain partially visible and unmodified in the output
- The subject composition from Image 1 is LOCKED — nothing about it changes

TASK: Composite the subject from Image 1 onto a background inspired by Image 2.
- Use Image 2 as a background BEHIND and BENEATH the subject — never as an overlay
- Adapt the background to fit around the subject, not the other way around
- Scale, crop, or extend Image 2's background as needed to fit Image 1's composition
- Match the lighting and colour temperature of Image 2 to create a natural composite
- Smooth skin subtly and naturally

SUBJECT REFERENCE (do not modify):
- Hands: ${handDesc}
- Nails: ${nailDesc}

The result should look like Image 1's subject was naturally photographed in Image 2's setting, with zero changes to the subject.`;
}
