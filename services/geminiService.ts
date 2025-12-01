import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

const createClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY is not defined");
  return new GoogleGenAI({ apiKey });
};

export const generateQuestionsAI = async (
  topic: string,
  subjectId: string,
  count: number = 5
): Promise<Omit<Question, "id">[]> => {
  const ai = createClient();
  
  const prompt = `Genera ${count} preguntas de examen de opción múltiple (multiple choice) sobre el tema "${topic}". 
  Cada pregunta debe tener un texto claro y 4 opciones de respuesta, donde solo una es correcta.
  El nivel debe ser académico universitario.
  Idioma: Español.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "La pregunta del examen" },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Las 4 opciones posibles"
            },
            correctOptionIndex: {
              type: Type.INTEGER,
              description: "El índice (0-3) de la respuesta correcta en el array de opciones"
            }
          },
          required: ["text", "options", "correctOptionIndex"]
        }
      }
    }
  });

  const rawData = response.text;
  if (!rawData) return [];

  try {
    const parsed = JSON.parse(rawData);
    return parsed.map((q: any) => ({
      subjectId,
      text: q.text,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      isActive: true // Default to active when generated
    }));
  } catch (e) {
    console.error("Error parsing Gemini response", e);
    return [];
  }
};