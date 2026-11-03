
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import type { CanvasImage } from '../types';

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!apiKey) {
    console.warn("GEMINI_API_KEY or API_KEY environment variable not set. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: apiKey! });

const resizeImage = (base64: string, maxWidth: number = 1024, maxHeight: number = 1024): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
};

export const generateOverlayFromPrompt = async (prompt: string, canvasImageBase64: string): Promise<string> => {
    try {
        const resized = await resizeImage(canvasImageBase64);
        const base64Data = resized.split(',')[1];
        if (!base64Data) {
            throw new Error("Invalid base64 image data provided for overlay generation.");
        }

        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: 'image/png',
            },
        };

        const textPart = {
            text: `Instruction: "${prompt}". Analyze the provided image which is a canvas containing other images. Based on the instruction, generate a new image that can be used as an overlay. The output should be a PNG image with a transparent background, matching the dimensions of the input image, and containing ONLY the elements described in the instruction, positioned appropriately relative to the content of the input image.`,
        };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-image',
            contents: {
                parts: [imagePart, textPart],
            },
        });

        const imagePartResponse = response.candidates?.[0]?.content?.parts.find(part => part.inlineData);

        if (imagePartResponse && imagePartResponse.inlineData) {
            const base64ImageBytes: string = imagePartResponse.inlineData.data;
            return `data:image/png;base64,${base64ImageBytes}`;
        }
        
        throw new Error(response.text || "No image was generated.");

    } catch (error: any) {
        console.error("Error generating smart overlay:", error);
        throw new Error(error.message || "Failed to generate AI overlay.");
    }
};

export const generateSeamlessTexture = async (prompt: string): Promise<string> => {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-image',
            contents: [{
                parts: [
                    { text: `IMAGE_REQUEST: A high-resolution, perfectly seamless tiling game texture of ${prompt}. 
                    SPECIFICATIONS:
                    - Perspective: 90 degree overhead flat top-down view.
                    - Lighting: Global ambient occlusion style, no directional shadows, no sun glare.
                    - Tiling: Perfectly seamless on all edges.
                    - Usage: Floor terrain texture for an isometric strategy game.
                    - Response: Return the PNG image data ONLY.` }
                ]
            }]
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        
        if (imagePart && imagePart.inlineData) {
            return `data:image/png;base64,${imagePart.inlineData.data}`;
        }
        
        throw new Error(response.text || "The model returned text instead of an image. Try being more descriptive or simple with your prompt.");
    } catch (error: any) {
        console.error("Error generating seamless texture:", error);
        throw new Error(error.message || "Failed to generate texture.");
    }
};

export const generateSimilarTexture = async (imageBase64: string): Promise<string> => {
    try {
        const resized = await resizeImage(imageBase64);
        const base64Data = resized.split(',')[1];
        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: 'image/png',
            },
        };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-image',
            contents: {
                parts: [
                    imagePart,
                    { text: `IMAGE_REQUEST: A high-resolution image containing a 2x2 grid (4 total) of different but perfectly seamless tiling game textures that are visually similar and match the style, color palette, and material of the provided image.
                    SPECIFICATIONS:
                    - Layout: A 2x2 grid of 4 distinct textures.
                    - Perspective: 90 degree overhead flat top-down view for each.
                    - Lighting: Global ambient occlusion style, no directional shadows, no sun glare.
                    - Tiling: Each of the 4 textures must be perfectly seamless on its own edges.
                    - Style: All 4 must perfectly match the input image style so they can be used together.
                    - Response: Return the PNG image data ONLY.` }
                ]
            }
        });

        const imagePartResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        
        if (imagePartResponse && imagePartResponse.inlineData) {
            return `data:image/png;base64,${imagePartResponse.inlineData.data}`;
        }
        
        throw new Error("Model failed to generate a similar image.");
    } catch (error: any) {
        console.error("Error generating similar texture:", error);
        throw new Error(error.message || "Failed to generate similar texture.");
    }
};

interface LayoutCommandResponse {
    updates: Array<{
        id: string;
        x: number;
        y: number;
    }>;
}

// Fixed: Updated signature to include x and y coordinates used in destructuring from images
export const getLayoutCommand = async (prompt: string, images: (CanvasImage & { x: number; y: number })[], canvasDimensions: {width: number, height: number}): Promise<LayoutCommandResponse> => {
    if (!images.length) {
        throw new Error("Cannot process layout command without images.");
    }
    
    const imageInfo = images.map(({ id, x, y, width, height, visualBounds }) => ({ id, x, y, width, height, ...(visualBounds && { visualBounds }) }));

    const fullPrompt = `User command: "${prompt}". \n Current state: ${JSON.stringify({ canvas: canvasDimensions, images: imageInfo })}`;
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: fullPrompt,
            config: {
                systemInstruction: `You are an intelligent canvas layout assistant. Interpret user commands to modify image positions on a canvas. The user will provide a list of images with their current positions (x, y) and original dimensions (width, height). Some images may also include 'visualBounds', which represent the bounding box of the non-transparent content within the image. When 'visualBounds' are present, you MUST use them for all layout calculations (e.g., alignment, spacing, collision). Respond ONLY with a JSON object conforming to the schema. Ensure coordinates are within canvas bounds. Do not add any conversational text or markdown.`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        updates: {
                            type: Type.ARRAY,
                            description: "List of image position updates.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING, description: "The unique ID of the image." },
                                    x: { type: Type.NUMBER, description: "The new X coordinate." },
                                    y: { type: Type.NUMBER, description: "The new Y coordinate." },
                                },
                                required: ['id', 'x', 'y'],
                            },
                        },
                    },
                    required: ['updates'],
                },
            },
        });
        
        const jsonText = response.text.trim();
        const parsedResponse = JSON.parse(jsonText);
        return parsedResponse as LayoutCommandResponse;

    } catch (error) {
        console.error("Error processing layout command:", error);
        throw new Error("Failed to process AI command. The model may have returned an invalid format.");
    }
};

export const generateDepthToImageOverlay = async (prompt: string, imageBase64: string, referenceImageBase64?: string): Promise<string> => {
    try {
        const resized = await resizeImage(imageBase64);
        const base64Data = resized.split(',')[1];
        if (!base64Data) {
            throw new Error("Invalid base64 image data.");
        }

        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: 'image/png',
            },
        };

        const parts: any[] = [imagePart];

        if (referenceImageBase64) {
            const resizedRef = await resizeImage(referenceImageBase64);
            const refBase64Data = resizedRef.split(',')[1];
            if (refBase64Data) {
                parts.push({
                    inlineData: {
                        data: refBase64Data,
                        mimeType: 'image/png',
                    },
                });
            }
        }

        let instructionText = `IMAGE_EDIT_REQUEST: Generate a new game texture overlay based on prompt: "${prompt}".
        SPECIFICATIONS:
        - Preservation: You must strictly use an image-to-depth technique. Keep the exact outline, coordinates, perspective, and boundaries of the elements in the input image.`;

        if (referenceImageBase64 && parts.length > 1) {
            instructionText = `IMAGE_EDIT_REQUEST: Generate a new game texture overlay based on prompt: "${prompt}".
            SPECIFICATIONS:
            - Input Image 1: The original game layout. You must strictly preserve the exact outline, coordinates, perspective, and boundaries of the elements from Input Image 1.
            - Input Image 2: Style reference image. Use this image as a style, texture, color, and medium inspiration/reference to generate the requested texture.
            - Modification: Alter material details, colors, textures, and features of Input Image 1 according to "${prompt}" and style/details of Input Image 2, while maintaining the original layout boundaries and pixel structure.
            - Response: Return the PNG image data ONLY with no extra text or explanations.`;
        } else {
            instructionText = `IMAGE_EDIT_REQUEST: Generate a new game texture overlay based on prompt: "${prompt}".
            SPECIFICATIONS:
            - Preservation: You must strictly use an image-to-depth technique. Keep the exact outline, coordinates, perspective, and boundaries of the elements in the input image.
            - Modification: Alter material details, colors, textures, and features according to "${prompt}" (e.g., turning cliffs into volcanic cliffs) while maintaining the original pixel placement and overall boundaries perfectly.
            - Response: Return the PNG image data ONLY with no extra text or explanations.`;
        }

        parts.push({ text: instructionText });

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-image',
            contents: {
                parts: parts
            }
        });

        // Loop parts to find inlineData image
        let base64Result = '';
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    base64Result = part.inlineData.data;
                    break;
                }
            }
        }

        if (base64Result) {
            return `data:image/png;base64,${base64Result}`;
        }

        throw new Error(response.text || "The model returned text content instead of an image. Try being more descriptive or simple with your prompt.");
    } catch (error: any) {
        console.error("Error in generateDepthToImageOverlay:", error);
        throw new Error(error.message || "Failed to generate AI depth overlay.");
    }
};

