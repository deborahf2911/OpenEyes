import cors from "cors";
import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const app = express();
const PORT = 3000;

app.use(cors());

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: "10mb" }));

const apiKey = process.env.MODEL_API_KEY;

const client = apiKey
  ? new OpenAI({
      apiKey,
      baseURL: "https://api.meta.ai/v1",
    })
  : null;

// Check backend status
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "OpenEyes Backend",
  });
});

// Original connection test
app.post("/api/test", async (_req, res) => {
  if (!client) {
    res.status(500).json({ error: "Meta API key is not configured." });
    return;
  }

  try {
    const response = await client.responses.create({
      model: "muse-spark-1.3",
      input: "Introduce yourself briefly. You are powering OpenEyes.",
    });

    res.json({
      success: true,
      message: response.output_text,
    });
  } catch (error) {
    console.error("Meta API request failed:", error);
    res.status(502).json({ error: "AI service request failed." });
  }
});

// Dynamic AI prompt
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body as { prompt?: unknown };

  if (typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({
      error: "Please provide a valid prompt.",
    });
    return;
  }

  if (prompt.length > 2000) {
    res.status(400).json({
      error: "Prompt must not exceed 2000 characters.",
    });
    return;
  }

  if (!client) {
    res.status(500).json({
      error: "Meta API key is not configured.",
    });
    return;
  }

  try {
    const response = await client.responses.create({
      model: "muse-spark-1.3",
      input: prompt.trim(),
    });

    res.json({
      success: true,
      message: response.output_text,
    });
  } catch (error) {
    console.error("Meta API request failed:", error);

    res.status(502).json({
      error: "AI service request failed.",
    });
  }
});

app.post("/api/analyze-image", async (req, res) => {
  const { prompt, imageDataUrl } = req.body as {
    prompt?: unknown;
    imageDataUrl?: unknown;
  };

  if (typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "Please provide a valid prompt." });
    return;
  }

  if (
    typeof imageDataUrl !== "string" ||
    !/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(imageDataUrl)
  ) {
    res.status(400).json({ error: "Please provide a valid base64 image." });
    return;
  }

  if (imageDataUrl.length > 8_000_000) {
    res.status(413).json({ error: "Image is too large. Please use a smaller image." });
    return;
  }

  if (!client) {
    res.status(500).json({ error: "Meta API key is not configured." });
    return;
  }

  try {
    const response = await client.responses.create({
      model: "muse-spark-1.3",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt.trim(),
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high",
            },
          ],
        },
      ],
    });

    res.json({
      success: true,
      message: response.output_text,
    });
  } catch (error) {
    console.error("Image analysis failed:", error);
    res.status(502).json({ error: "AI image analysis failed." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`OpenEyes backend running at http://localhost:${PORT}`);
});