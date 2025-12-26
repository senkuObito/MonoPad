import { GoogleGenAI } from "@google/genai";

export type AiMode = 'none' | 'grammar' | 'email' | 'message';

const getApiKey = () => {
  try {
    return process.env.API_KEY || "";
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
    systemInstruction = "Correct the grammar and spelling of the user's text. Return ONLY the corrected text. If the text is already correct, return an empty string.";
  } else if (mode === 'email') {
    systemInstruction = "Rephrase the user's text into a formal professional email. Include a clear 'Subject: ' line at the start. Return ONLY the email content.";
  } else if (mode === 'message') {
    systemInstruction = "Rephrase the user's text into a formal, concise message suitable for Slack or LinkedIn. Return ONLY the message.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: text,
      config: {
        systemInstruction,
        temperature: 0.4,
        maxOutputTokens: 1024,
      },
    });

    const result = response.text?.trim();
    if (result === text.trim() || !result) return null;
    return result;
  } catch (e) {
    console.error("AI Error:", e);
    return null;
  }
};

export const refineText = async (text: string): Promise<string> => {
  if (!text.trim()) return text;
  
  const apiKey = getApiKey();
  if (!apiKey) return text;

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Refine the following note for clarity, better grammar, and a professional yet minimalist tone. Keep the original meaning intact. 
    Output ONLY the refined text, no preamble or extra commentary:
    
    "${text}"`,
    config: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  });

  return response.text || text;
};