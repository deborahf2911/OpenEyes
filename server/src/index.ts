import {
  parseImageStream,
  recordsOfKind,
  type ResponsesEvent,
} from "@meta-sam/parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import OpenAI from "openai";
import WebSocket, { WebSocketServer } from "ws";

const app = express();
const PORT = 3000;

app.use(cors());

app.use((req, res, next) => {
  res.locals.requestArrivedAt = Date.now();

  console.log(`Incoming request: ${req.method} ${req.url}`);

  if (req.method === "POST") {
    console.log(
      `Request Content-Length: ${req.headers["content-length"] ?? "unknown"} bytes`
    );
  }

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

async function* normalizedSamEvents(
    stream: AsyncIterable<unknown>
  ): AsyncIterable<ResponsesEvent> {
    const completed = new Set<string>();

    for await (const raw of stream) {
      const event = raw as {
        type?: string;
        item_id?: unknown;
        output_index?: unknown;
        content_index?: unknown;
        part?: { type?: unknown; text?: unknown } | null;
      };

      const lane = `${String(event.item_id)}:${String(
        event.output_index
      )}:${String(event.content_index)}`;

      if (event.type === "response.output_text.done") {
        if (!completed.has(lane)) {
          completed.add(lane);
          yield event as unknown as ResponsesEvent;
        }
        continue;
      }

      yield event as unknown as ResponsesEvent;

      if (
        event.type === "response.content_part.done" &&
        !completed.has(lane) &&
        event.part?.type === "output_text" &&
        typeof event.part.text === "string"
      ) {
        completed.add(lane);

        yield {
          type: "response.output_text.done",
          item_id: event.item_id,
          output_index: event.output_index,
          content_index: event.content_index,
          text: event.part.text,
        } as unknown as ResponsesEvent;
      }
    }
  }

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
  const requestStartedAt = Date.now();

  const requestArrivedAt = Number(
    res.locals.requestArrivedAt ?? requestStartedAt
  );

  console.log(
    `Image upload and JSON parsing time: ${((requestStartedAt - requestArrivedAt) / 1000).toFixed(2)} seconds`
  );

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
    const metaStartedAt = Date.now();
    const stream = client.responses.stream({
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

    let message = "";
    let firstTextTime: number | null = null;

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        if (firstTextTime === null) {
          firstTextTime = Date.now();

          console.log(
            `Time to first text: ${((firstTextTime - metaStartedAt) / 1000).toFixed(2)} seconds`
          );
        }

        message += event.delta;
      }
    }

    console.log("Streaming finished.");

    const metaDuration = Date.now() - metaStartedAt;
    const totalDuration = Date.now() - requestStartedAt;

    console.log(`Meta API response time: ${(metaDuration / 1000).toFixed(2)} seconds`);
    console.log(`Total backend processing time: ${(totalDuration / 1000).toFixed(2)} seconds`);

    const responsePayload = {
      success: true,
      message,
    };

    const responseSize = Buffer.byteLength(
      JSON.stringify(responsePayload)
    );

    const responseStartedAt = Date.now();

    res.on("finish", () => {
      console.log(
        `Response size: ${(responseSize / 1024).toFixed(2)} KB`
      );

      console.log(
        `Server response transmission time: ${((Date.now() - responseStartedAt) / 1000).toFixed(2)} seconds`
      );

      console.log(
        `Total server request time: ${((Date.now() - requestArrivedAt) / 1000).toFixed(2)} seconds`
      );
    });

    res.json(responsePayload);
  } catch (error) {
    console.error("Image analysis failed:", error);
    res.status(502).json({ error: "AI image analysis failed." });
  }
});

app.post("/api/test-sam", async (req, res) => {
  const startedAt = Date.now();

  const { prompt, imageDataUrl } = req.body as {
    prompt?: unknown;
    imageDataUrl?: unknown;
  };

  if (typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "Please provide an object name." });
    return;
  }

  if (prompt.length > 100) {
    res.status(400).json({ error: "Object name is too long." });
    return;
  }

  if (
    typeof imageDataUrl !== "string" ||
    !/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
      imageDataUrl
    )
  ) {
    res.status(400).json({ error: "Please provide a valid base64 image." });
    return;
  }

  if (imageDataUrl.length > 8_000_000) {
    res.status(413).json({ error: "Image is too large." });
    return;
  }

  if (!client) {
    res.status(500).json({ error: "Meta API key is not configured." });
    return;
  }

  try {
    const stream = await client.responses.create({
      model: "sam-3.1",
      stream: true,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt.trim(),
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
            },
          ],
        },
      ] as any,
    });

    const result = await parseImageStream(
      normalizedSamEvents(stream)
    ).finalResult;

    console.log(
      "SAM raw box records:",
      JSON.stringify(recordsOfKind(result.records, "box"), null, 2)
    );

    const boxes = recordsOfKind(result.records, "box").map((box) => ({
      objectId: box.objectId,
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      confidence: box.confidence ?? null,
    }));

    const masks = recordsOfKind(result.records, "mask");

    const duration = (Date.now() - startedAt) / 1000;

    console.log(`SAM processing time: ${duration.toFixed(2)} seconds`);
    console.log(`SAM detected objects: ${boxes.length}`);

    res.json({
      success: true,
      model: "sam-3.1",
      prompt: prompt.trim(),
      detected: boxes.length > 0,
      objectCount: boxes.length,
      boxes,
      maskCount: masks.length,
      processingTimeSeconds: Number(duration.toFixed(2)),
      outcome: result.outcome.status,
      diagnostics: result.diagnostics,
    });
  } catch (error) {
    console.error("SAM segmentation failed:", error);

    res.status(502).json({
      error: "SAM image segmentation failed.",
    });
  }
});

app.post("/api/test-hybrid", async (req, res) => {
  const startedAt = Date.now();

  const { prompt, samPrompt, imageDataUrl } = req.body as {
    prompt?: unknown;
    samPrompt?: unknown;
    imageDataUrl?: unknown;
  };

  if (
    typeof prompt !== "string" ||
    !prompt.trim() ||
    typeof samPrompt !== "string" ||
    !samPrompt.trim()
  ) {
    res.status(400).json({
      error: "Please provide both prompt and samPrompt.",
    });
    return;
  }

  if (prompt.length > 2000 || samPrompt.length > 100) {
    res.status(400).json({ error: "A prompt is too long." });
    return;
  }

  if (
    typeof imageDataUrl !== "string" ||
    !/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
      imageDataUrl
    )
  ) {
    res.status(400).json({
      error: "Please provide a valid base64 image.",
    });
    return;
  }

  if (imageDataUrl.length > 8_000_000) {
    res.status(413).json({ error: "Image is too large." });
    return;
  }

  if (!client) {
    res.status(500).json({
      error: "Meta API key is not configured.",
    });
    return;
  }

  try {
    // Step 1: Ask SAM to locate candidate objects.
    const samStartedAt = Date.now();

    const samStream = await client.responses.create({
      model: "sam-3.1",
      stream: true,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: samPrompt.trim(),
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
            },
          ],
        },
      ] as any,
    });

    const samResult = await parseImageStream(
      normalizedSamEvents(samStream)
    ).finalResult;

    const boxes = recordsOfKind(samResult.records, "box").map((box) => ({
      objectId: box.objectId,
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
    }));

    const samDuration = (Date.now() - samStartedAt) / 1000;

    console.log(
      `Hybrid SAM processing time: ${samDuration.toFixed(2)} seconds`
    );
    console.log(`Hybrid SAM candidate boxes: ${boxes.length}`);

    // Step 2: Ask Muse Spark to assess the original image
    // together with SAM's candidate locations.
    const museStartedAt = Date.now();

    const museResponse = await client.responses.create({
      model: "muse-spark-1.3",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
You are OpenEyes, a careful visual assistant helping someone
with low vision find an everyday object.

User's request:
${prompt.trim()}

SAM 3.1 searched for:
${samPrompt.trim()}

SAM returned these candidate bounding boxes:
${JSON.stringify(boxes)}

These coordinates are in the original image's pixel coordinate
system. A candidate box is NOT proof that the requested object
is present. SAM can mistake similar-looking objects.

Examine the original image independently. Check whether a
candidate box actually contains the requested object.

If the object is clearly visible, describe its location using
simple, accurate visual landmarks.

If SAM's candidates appear incorrect, or you cannot confidently
identify the object, say so. Do not claim the object has been
found based only on SAM's detection.

Use short, clear sentences. Give at most one safe camera
adjustment. Never instruct the user to walk, climb, or reach.
`,
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

    const museDuration = (Date.now() - museStartedAt) / 1000;
    const totalDuration = (Date.now() - startedAt) / 1000;

    console.log(
      `Hybrid Muse processing time: ${museDuration.toFixed(2)} seconds`
    );
    console.log(
      `Total hybrid processing time: ${totalDuration.toFixed(2)} seconds`
    );

    res.json({
      success: true,
      model: "muse-spark-1.3 + sam-3.1",
      samPrompt: samPrompt.trim(),
      detectedCandidates: boxes.length,
      boxes,
      message: museResponse.output_text,
      timings: {
        samSeconds: Number(samDuration.toFixed(2)),
        museSeconds: Number(museDuration.toFixed(2)),
        totalSeconds: Number(totalDuration.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("Hybrid analysis failed:", error);

    res.status(502).json({
      error: "Hybrid image analysis failed.",
    });
  }
});

const server = createServer(app);

const voiceServer = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(
    request.url ?? "/",
    `http://${request.headers.host}`
  ).pathname;

  if (pathname !== "/api/voice") {
    socket.destroy();
    return;
  }

  voiceServer.handleUpgrade(request, socket, head, (webSocket) => {
    voiceServer.emit("connection", webSocket, request);
  });
});

voiceServer.on("connection", (mobileSocket) => {
  console.log("Mobile voice connection received.");

  if (!apiKey) {
    mobileSocket.close(1011, "Meta API key is not configured.");
    return;
  }

  const metaSocket = new WebSocket(
    "wss://api.meta.ai/v1/asr/realtime"
  );

    let handshakeComplete = false;
    let lastForwardAt: number | null = null;

  metaSocket.on("open", () => {
    console.log("Connected to Meta voice service.");

    metaSocket.send(
      JSON.stringify({
        authorization: {
          accessToken: `Bearer ${apiKey}`,
        },
        audioEncoding: "PCM_24KHZ",
        model: "muse-voice-transcribe-1.0",
        mode: "ENDPOINTING",
        partialMode: "CUMULATIVE",
        emitAudioProgress: false,
      })
    );
  });

  metaSocket.on("message", (data, isBinary) => {
    if (isBinary) {
      return;
    }

    try {
      const event = JSON.parse(data.toString());

      // Meta's initial acknowledgement has a sessionId
      // and does not contain a type field.
      if (!handshakeComplete && event.sessionId) {
        handshakeComplete = true;

        console.log(
          `Meta voice session ready: ${event.sessionId}`
        );

        if (mobileSocket.readyState === WebSocket.OPEN) {
          mobileSocket.send(
            JSON.stringify({
              type: "ready",
              sessionId: event.sessionId,
            })
          );
        }

        return;
      }

      if (event.type === "error") {
        console.error("Meta voice error:", event);

        if (mobileSocket.readyState === WebSocket.OPEN) {
          mobileSocket.send(JSON.stringify(event));
        }

        return;
      }

      // Forward transcripts and speech events to the iPhone.
      if (mobileSocket.readyState === WebSocket.OPEN) {
        mobileSocket.send(JSON.stringify(event));
      }

      if (event.type === "speechComplete") {
        console.log(
          `Completed voice instruction: ${event.transcript}`
        );
      }
    } catch (error) {
      console.error("Could not process Meta voice event:", error);
    }
  });

  mobileSocket.on("message", (data, isBinary) => {
    if (isBinary) {
      const now = Date.now();

      const audioData = Array.isArray(data)
        ? Buffer.concat(data)
        : Buffer.isBuffer(data)
          ? data
          : Buffer.from(data as ArrayBuffer);

      receivedAudioFrames++;
      receivedAudioBytes += audioData.byteLength;

      const receiveInterval = lastAudioFrameAt === null
        ? null
        : now - lastAudioFrameAt;

      const forwardInterval = lastForwardAt === null
        ? null
        : now - lastForwardAt;

      lastAudioFrameAt = now;

      if (firstAudioFrameAt === null) {
        firstAudioFrameAt = now;
      }

      if (
        metaSocket.readyState !== WebSocket.OPEN ||
        !handshakeComplete
      ) {
        console.warn("Audio frame received before Meta was ready.");
        return;
      }

      lastForwardAt = now;

      metaSocket.send(audioData, (error) => {
        if (error) {
          console.error("Audio forwarding failed:", error);
          return;
        }

        forwardedAudioFrames++;
        forwardedAudioBytes += audioData.byteLength;
      });

      if (receivedAudioFrames % 10 === 0) {
        const elapsedSeconds =
          (now - firstAudioFrameAt) / 1000;

        console.log("Audio forwarding diagnostics:", {
          receivedFrames: receivedAudioFrames,
          forwardedFrames: forwardedAudioFrames,
          receivedKB: Number(
            (receivedAudioBytes / 1024).toFixed(2)
          ),
          forwardedKB: Number(
            (forwardedAudioBytes / 1024).toFixed(2)
          ),
          receiveIntervalMs: receiveInterval,
          forwardIntervalMs: forwardInterval,
          receivedBytesPerSecond: elapsedSeconds > 0
            ? Math.round(receivedAudioBytes / elapsedSeconds)
            : 0,
          metaBufferedAmount: metaSocket.bufferedAmount,
        });
      }

      return;
    }

    if (
      metaSocket.readyState !== WebSocket.OPEN ||
      !handshakeComplete
    ) {
      return;
    }

    try {
      const message = JSON.parse(data.toString());

      if (message.type === "endStream") {
        metaSocket.send(JSON.stringify(message));
      }
    } catch {
      console.warn("Received an invalid voice control message.");
    }
  });

  metaSocket.on("error", (error) => {
    console.error("Meta voice connection failed:", error);

    if (mobileSocket.readyState === WebSocket.OPEN) {
      mobileSocket.send(
        JSON.stringify({
          type: "error",
          message: "Could not connect to Meta voice transcription.",
        })
      );
    }
  });

  // Temporary audio diagnostics.
  let receivedAudioFrames = 0;
  let receivedAudioBytes = 0;
  let forwardedAudioFrames = 0;
  let forwardedAudioBytes = 0;
  let lastAudioFrameAt: number | null = null;
  let firstAudioFrameAt: number | null = null;

  mobileSocket.on("close", () => {
    console.log("Mobile voice connection closed.");

    if (
      metaSocket.readyState === WebSocket.OPEN ||
      metaSocket.readyState === WebSocket.CONNECTING
    ) {
      metaSocket.close();
    }
  });

  metaSocket.on("close", (code, reason) => {
    console.log(
      `Meta voice connection closed: ${code} ${reason.toString()}`
    );

    if (mobileSocket.readyState === WebSocket.OPEN) {
      mobileSocket.close(code === 1000 ? 1000 : 1011);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`OpenEyes backend running at http://localhost:${PORT}`);
});