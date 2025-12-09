import { GoogleGenAI, Type } from "@google/genai";
import { StoredFile } from "../types";

const GEMINI_MODEL = "gemini-2.5-flash";

class AIService {
  private getClient() {
    // In a real app, this should be handled securely. 
    // For this client-side demo, we use the env var injected by the environment.
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing. Please configure it.");
    return new GoogleGenAI({ apiKey });
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async analyzeFile(file: StoredFile): Promise<{ description: string; tags: string[] }> {
    const ai = this.getClient();
    const base64Data = await this.blobToBase64(file.content);
    
    // Determine prompt based on file type
    let prompt = "Analyze this file.";
    if (file.type.startsWith('image/')) {
      prompt = "Describe this image in detail and provide 3-5 relevant categorical tags.";
    } else if (file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('javascript') || file.type.includes('pdf')) {
      prompt = "Summarize the content of this document and provide 3-5 relevant categorical tags.";
    } else {
      // Fallback for generic files if model supports them or purely based on metadata (unlikely to work well for binaries without specific model support)
      // For now, we assume visual or text-based files for deep analysis.
      throw new Error("AI Analysis is currently optimized for Images and Text/PDF documents.");
    }

    // Structured output schema
    const schema = {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING, description: "A concise summary or description of the file content." },
        tags: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: "A list of 3-5 short tags categorizing the file."
        }
      },
      required: ["description", "tags"]
    };

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: [
            { inlineData: { mimeType: file.type, data: base64Data } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");

      const result = JSON.parse(text);
      return {
        description: result.description,
        tags: result.tags
      };

    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      throw error;
    }
  }
}

export const aiService = new AIService();
