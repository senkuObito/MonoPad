import { GoogleGenAI } from "@google/genai";

export type AiMode = 'none' | 'grammar' | 'email' | 'message';

const getApiKey = () => {
  try {
    return (window as any).process?.env?.API_KEY || "";
  } catch (e) {
    return "";
  }
};

export const getAiSuggestion = async (text: string, mode: AiMode): Promise<string | null> => {
  if (!text.trim() || mode === 'none') return null;

  const apiKey = getApiKey();
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  
  let systemInstruction = "";
  if (mode === 'grammar') {
    systemInstruction = "Correct grammar/spelling. Return ONLY the corrected text.";
  } else if (mode === 'email') {
    systemInstruction = "Convert to formal email. Return ONLY the email content.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: text,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    return response.text?.trim() || null;
  } catch (e) {
    return null;
  }
};