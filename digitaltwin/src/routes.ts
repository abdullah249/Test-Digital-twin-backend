import express, { Express } from "express";
import { createServer, Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import { z } from "zod";
import bodyParser from "body-parser";
import cors from "cors";
import { storage } from "./storage.js";
import { documentService } from "./document-service.js";
import { voiceService } from "./voice-service.js";
import { zoomService } from "./zoom-service.js";
import {
  insertAgentSchema,
  insertDigitalTwinSchema,
  insertConversationSchema,
  type Agent,
  type Task,
  type DigitalTwin,
  type Conversation,
  type InsertAgent,
  type InsertTask,
  type InsertDigitalTwin,
  type InsertConversation,
} from "./schema.js";

// This is just a TypeScript type declaration to avoid errors
// The actual implementation will use the imported storage
interface StorageInterface {
  getAgents(): Promise<any[]>;
  updateAgentStatus(id: number, status: string): Promise<any>;
  updateAgentMetrics(id: number, metrics: any): Promise<any>;
  getDigitalTwins(): Promise<any[]>;
  createDigitalTwin(data: any): Promise<any>;
  getConversations(): Promise<any[]>;
  getConversation(id: number): Promise<any | null>;
  createConversation(data: any): Promise<any>;
  getConversationsByParticipant(name: string): Promise<any[]>;
  cleanupDuplicateAgents(): Promise<number>;
  createAgent(data: any): Promise<any>;
}

// Fallback storage implementation for when imports fail
function createFallbackStorage() {
  console.log("Using fallback storage implementation");
  return {
    getAgents: async () => {
      return [
        {
          id: 1,
          name: "Albert Einstein",
          type: "Theoretical Physics",
          capabilities: ["Innovation", "Research", "Problem Solving"],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Einstein",
          status: "active",
        },
        {
          id: 2,
          name: "Elon Musk",
          type: "Tech Entrepreneur",
          capabilities: [
            "Innovation",
            "Strategic Thinking",
            "Product Development",
          ],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Musk",
          status: "active",
        },
        {
          id: 3,
          name: "Emad Mostaque",
          type: "AI Innovator",
          capabilities: [
            "Artificial Intelligence",
            "Leadership",
            "Technical Vision",
          ],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mostaque",
          status: "active",
        },
        {
          id: 4,
          name: "Fei-Fei Li",
          type: "AI Research",
          capabilities: [
            "Artificial Intelligence",
            "Research",
            "Technical Vision",
          ],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Li",
          status: "active",
        },
        {
          id: 5,
          name: "Leonardo da Vinci",
          type: "Renaissance Innovator",
          capabilities: ["Innovation", "Art", "Engineering"],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=DaVinci",
          status: "active",
        },
        {
          id: 6,
          name: "Steve Jobs",
          type: "Tech Visionary",
          capabilities: ["Innovation", "Product Development", "Design"],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jobs",
          status: "active",
        },
        {
          id: 7,
          name: "Walt Disney",
          type: "Creative Visionary",
          capabilities: ["Creativity", "Innovation", "Storytelling"],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Disney",
          status: "active",
        },
      ];
    },
    updateAgentStatus: async (id: number, status: string) => {
      console.log(`Updating agent ${id} status to ${status}`);
      return { id, status };
    },
    updateAgentMetrics: async (id: number, metrics: any) => {
      console.log(`Updating agent ${id} metrics:`, metrics);
      return { id, metrics };
    },
    getDigitalTwins: async () => {
      return [
        {
          id: 1,
          name: "Einstein Digital Twin",
          description: "AI-powered digital twin of Albert Einstein",
          type: "AI Assistant",
          status: "active",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Einstein",
          capabilities: ["Physics", "Innovation", "Problem Solving"],
        },
      ];
    },
    createDigitalTwin: async (data: any) => {
      console.log("Creating digital twin:", data);
      return { id: Date.now(), ...data };
    },
    getConversations: async () => {
      return [];
    },
    getConversation: async (id: number) => {
      return null;
    },
    createConversation: async (data: any) => {
      console.log("Creating conversation:", data);
      return { id: Date.now(), ...data };
    },
    getConversationsByParticipant: async (name: string) => {
      return [];
    },
    cleanupDuplicateAgents: async () => {
      return 0;
    },
    createAgent: async (data: any) => {
      console.log("Creating agent:", data);
      return { id: Date.now(), ...data };
    },
  };
}

// Use imported storage or fallback
let actualStorage: StorageInterface;
try {
  actualStorage = storage;
} catch (error) {
  console.error("Failed to import storage, using fallback:", error);
  actualStorage = createFallbackStorage();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

function isFallbackResponse(
  result: any
): result is { fallback: true; text: string; persona?: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "fallback" in result &&
    result.fallback === true
  );
}

export function registerRoutes(app: Express): Server {
  // Add CORS middleware for production - properly configured for your frontend
  // Skip CORS entirely for Slack webhook endpoints (server-to-server requests)
  app.use((req, res, next) => {
    if (req.path.startsWith("/slack")) {
      console.log(
        `[CORS] Skipping CORS middleware for Slack endpoint: ${req.path}`
      );
      return next();
    }

    // Apply CORS for non-Slack routes
    cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
          "https://digital-frontend-1rc0.onrender.com",
          "https://test-digital-twin-2.onrender.com",
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:5173",
          "http://localhost:4173",
        ];

        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          console.log("CORS blocked origin:", origin);
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
        "Cache-Control",
      ],
      exposedHeaders: ["Content-Length", "X-Requested-With"],
      preflightContinue: false,
      optionsSuccessStatus: 204,
    })(req, res, next);
  });

  // Additional CORS headers for all responses (skip for Slack)
  app.use((req, res, next) => {
    // Skip CORS headers for Slack endpoints entirely
    if (req.path.startsWith("/slack")) {
      return next();
    }

    const allowedOrigins = [
      "https://digital-frontend-1rc0.onrender.com",
      "https://test-digital-twin-2.onrender.com",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:4173",
    ];

    const origin = req.headers.origin;
    console.log(`CORS request from origin: ${origin}`);

    if (origin && allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      console.log(`CORS allowed for origin: ${origin}`);
    } else {
      console.log(`CORS blocked for origin: ${origin}`);
    }

    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control"
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      console.log("Handling OPTIONS preflight request");
      res.sendStatus(200);
    } else {
      next();
    }
  });

  const jsonParser = bodyParser.json();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // Add initial digital twin agents only if they don't already exist
  (async () => {
    try {
      // First check if any agents already exist
      const existingAgents = await actualStorage.getAgents();
      const existingNames = existingAgents.map((agent) => agent.name);

      // Define our 7 core digital twins
      const digitalTwins = [
        {
          name: "Albert Einstein",
          type: "Theoretical Physics",
          capabilities: ["Innovation", "Research", "Problem Solving"],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Einstein",
          status: "active",
        },
        {
          name: "Elon Musk",
          type: "Tech Entrepreneur",
          capabilities: [
            "Innovation",
            "Strategic Thinking",
            "Product Development",
          ],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Musk",
          status: "active",
        },
        {
          name: "Emad Mostaque",
          type: "AI Innovator",
          capabilities: [
            "Artificial Intelligence",
            "Leadership",
            "Technical Vision",
          ],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mostaque",
          status: "active",
        },
        {
          name: "Fei-Fei Li",
          type: "AI Research",
          capabilities: [
            "Artificial Intelligence",
            "Research",
            "Technical Vision",
          ],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Li",
          status: "active",
        },
        {
          name: "Leonardo da Vinci",
          type: "Renaissance Innovator",
          capabilities: ["Innovation", "Art", "Engineering"],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=DaVinci",
          status: "active",
        },
        {
          name: "Steve Jobs",
          type: "Tech Visionary",
          capabilities: ["Innovation", "Product Development", "Design"],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jobs",
          status: "active",
        },
        {
          name: "Walt Disney",
          type: "Creative Visionary",
          capabilities: ["Creativity", "Innovation", "Storytelling"],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Disney",
          status: "active",
        },
      ];

      // Clean up duplicates first if they exist
      if (existingAgents.length > 0) {
        await actualStorage.cleanupDuplicateAgents();
        console.log("Cleaned up any duplicate agents");
      }

      // Add only the twins that don't exist yet
      for (const twin of digitalTwins) {
        if (!existingNames.includes(twin.name)) {
          // Provide all required fields for the agents table
          await actualStorage.createAgent({
            name: twin.name,
            type: twin.type,
            capabilities: twin.capabilities,
            avatar: twin.avatar,
            status: twin.status,
          });
          console.log(`Created agent: ${twin.name}`);
        } else {
          console.log(`Agent already exists: ${twin.name}`);
        }
      }

      console.log("Digital twin initialization complete");
    } catch (error) {
      console.error("Error during agent initialization:", error);
      console.log("Continuing with existing agents...");
    }
  })();

  // WebSocket connection handling
  wss.on("connection", (ws) => {
    console.log("New WebSocket connection established");

    const broadcast = () => {
      if (ws.readyState === WebSocket.OPEN) {
        actualStorage.getAgents().then((agents: Agent[]) => {
          ws.send(JSON.stringify({ type: "agents_update", data: agents }));
        });
      }
    };

    // Send initial data
    broadcast();

    ws.on("message", async (message) => {
      const data = JSON.parse(message.toString());

      if (data.type === "update_status") {
        await actualStorage.updateAgentStatus(data.agentId, data.status);
        broadcast();
      } else if (data.type === "update_metrics") {
        await actualStorage.updateAgentMetrics(data.agentId, data.metrics);
        broadcast();
      }
    });

    ws.on("error", console.error);
  });

  // Document upload endpoint
  app.post(
    "/api/upload-twin-document",
    upload.single("document"),
    async (req, res) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: "No document provided" });
          return;
        }

        const { name } = req.body;
        if (!name) {
          res.status(400).json({ error: "Twin name is required" });
          return;
        }

        const content = await documentService.processWordDocument(req.file);
        await documentService.createDigitalTwin(content, name);

        res.json({ message: "Digital twin created successfully" });
      } catch (error) {
        console.error("Error processing document:", error);
        res.status(500).json({ error: "Failed to process document" });
      }
    }
  );

  //Synthesize Route with fallback
  app.post("/api/synthesize", jsonParser, async (req, res) => {
    try {
      const { text, persona, voiceId } = req.body;
      const result = await voiceService.synthesizeSpeech({
        text,
        persona,
        voiceId,
      });

      // Use the type guard to check if it's a fallback response
      if (isFallbackResponse(result)) {
        res.json(result);
      } else {
        res.set("Content-Type", "audio/mpeg");
        res.send(result);
      }
    } catch (error: any) {
      res
        .status(500)
        .json({
          error: error.message,
          fallback: true,
          text: req.body.text,
          persona: req.body.persona,
        });
    }
  });

  // Get available voices endpoint
  app.get("/api/voices", async (_req, res) => {
    try {
      const voices = await voiceService.getVoices();
      res.json(voices);
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({ error: "Failed to fetch voices" });
    }
  });

  // Get all available ElevenLabs voices (including your trained ones)
  app.get("/api/voices/all", async (_req, res) => {
    try {
      const voices = await voiceService.getAllVoices();
      res.json(voices);
    } catch (error) {
      console.error("Error fetching all voices:", error);
      res.status(500).json({ error: "Failed to fetch all voices" });
    }
  });

  // Digital Twins endpoints
  app.get("/api/digital-twins", async (_req, res) => {
    const twins = await actualStorage.getDigitalTwins();
    res.json(twins);
  });

  app.post("/api/digital-twins", async (req, res) => {
    const result = insertDigitalTwinSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    const twin = await actualStorage.createDigitalTwin(result.data);
    res.json(twin);
  });

  // Health check endpoint
  app.get("/api/health", async (_req, res) => {
    try {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ error: "Health check failed" });
    }
  });

  // REST endpoints
  app.get("/api/agents", async (req, res) => {
    console.log(
      `GET /api/agents request received from origin: ${req.headers.origin}`
    );
    try {
      const agents = await actualStorage.getAgents();
      const safeAgents = Array.isArray(agents) ? agents : [];
      console.log(`Returning ${safeAgents.length} agents`);
      res.json(safeAgents);
    } catch (error) {
      console.error("Error fetching agents (serving fallback):", error);
      // Serve a safe fallback instead of 500 to keep UI working
      res.json([
        {
          id: 1,
          name: "Albert Einstein",
          type: "Theoretical Physics",
          capabilities: ["Innovation", "Research", "Problem Solving"],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Einstein",
          status: "active",
          metrics: {
            requests_handled: 0,
            success_rate: 0,
            avg_response_time: 0,
          },
        },
        {
          id: 2,
          name: "Elon Musk",
          type: "Tech Entrepreneur",
          capabilities: [
            "Innovation",
            "Strategic Thinking",
            "Product Development",
          ],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Musk",
          status: "active",
          metrics: {
            requests_handled: 0,
            success_rate: 0,
            avg_response_time: 0,
          },
        },
        {
          id: 3,
          name: "Emad Mostaque",
          type: "AI Innovator",
          capabilities: [
            "Artificial Intelligence",
            "Leadership",
            "Technical Vision",
          ],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mostaque",
          status: "active",
          metrics: {
            requests_handled: 0,
            success_rate: 0,
            avg_response_time: 0,
          },
        },
        {
          id: 4,
          name: "Fei-Fei Li",
          type: "AI Research",
          capabilities: [
            "Artificial Intelligence",
            "Research",
            "Technical Vision",
          ],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Li",
          status: "active",
          metrics: {
            requests_handled: 0,
            success_rate: 0,
            avg_response_time: 0,
          },
        },
        {
          id: 5,
          name: "Leonardo da Vinci",
          type: "Renaissance Innovator",
          capabilities: ["Innovation", "Art", "Engineering"],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=DaVinci",
          status: "active",
          metrics: {
            requests_handled: 0,
            success_rate: 0,
            avg_response_time: 0,
          },
        },
        {
          id: 6,
          name: "Steve Jobs",
          type: "Tech Visionary",
          capabilities: ["Innovation", "Product Development", "Design"],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jobs",
          status: "active",
          metrics: {
            requests_handled: 0,
            success_rate: 0,
            avg_response_time: 0,
          },
        },
        {
          id: 7,
          name: "Walt Disney",
          type: "Creative Visionary",
          capabilities: ["Creativity", "Innovation", "Storytelling"],
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Disney",
          status: "active",
          metrics: {
            requests_handled: 0,
            success_rate: 0,
            avg_response_time: 0,
          },
        },
      ]);
    }
  });

  app.post("/api/agents", async (req, res) => {
    const result = insertAgentSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    const agent = await actualStorage.createAgent(result.data);
    res.json(agent);
  });

  // Conversation endpoints
  app.get("/api/conversations", async (_req, res) => {
    const conversations = await actualStorage.getConversations();
    res.json(conversations);
  });

  app.post("/api/conversations", async (req, res) => {
    const result = insertConversationSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    const conversation = await actualStorage.createConversation(result.data);
    res.json(conversation);
  });

  app.get("/api/conversations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    const conversation = await actualStorage.getConversation(id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.json(conversation);
  });

  app.get("/api/conversations/participant/:name", async (req, res) => {
    const conversations = await actualStorage.getConversationsByParticipant(
      req.params.name
    );
    res.json(conversations);
  });

  // Maintenance endpoint to clean up duplicate agents
  app.post("/api/maintenance/cleanup-duplicates", async (_req, res) => {
    try {
      const removed = await actualStorage.cleanupDuplicateAgents();
      res.json({
        success: true,
        message: `Successfully cleaned up ${removed} duplicate agents`,
        removed,
      });
    } catch (error) {
      console.error("Error cleaning up duplicates:", error);
      res.status(500).json({
        success: false,
        error: "Failed to clean up duplicates",
      });
    }
  });

  app.post("/api/voice/synthesize", async (req, res) => {
    try {
      const schema = z.object({
        text: z.string().min(1).max(500),
        persona: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        res
          .status(400)
          .json({ error: "Invalid request data", details: result.error });
        return;
      }

      const { text, persona } = result.data;
      console.log(
        `Voice synthesis request: "${text.substring(0, 30)}..." with persona: ${
          persona || "default"
        }`
      );

      // Get synthesized speech from voice service
      const audioData = await voiceService.synthesizeSpeech({ text, persona });

      // If we get a fallback indicator object, send it as JSON
      if (typeof audioData === "object" && "fallback" in audioData) {
        console.log("Sending fallback response to client");
        res.json(audioData);
        return;
      }

      // Otherwise send the audio buffer with appropriate headers
      console.log(
        "Sending audio response to client:",
        (audioData as Buffer).length,
        "bytes"
      );
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-cache");
      res.send(audioData);
    } catch (error) {
      console.error("Speech synthesis error:", error);
      res.status(500).json({ error: "Failed to synthesize speech" });
    }
  });

  // Test endpoint for trained voices
  app.post("/api/test-voice", jsonParser, async (req, res) => {
    try {
      const { persona, text } = req.body;

      if (!persona || !text) {
        res.status(400).json({ error: "Persona and text are required" });
        return;
      }

      console.log(`Testing voice for persona: ${persona}`);
      const result = await voiceService.synthesizeSpeech({ text, persona });

      if (isFallbackResponse(result)) {
        res.json({
          message: "Using fallback voice synthesis",
          fallback: true,
          text: result.text,
          persona: result.persona,
        });
      } else {
        res.set("Content-Type", "audio/mpeg");
        res.send(result);
      }
    } catch (error: any) {
      console.error("Error testing voice:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Health check endpoint for Render deployment
  app.get("/api/health", (req, res) => {
    console.log(`Health check request from origin: ${req.headers.origin}`);
    res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      origin: req.headers.origin,
      cors: "enabled",
    });
  });

  // CORS test endpoint
  app.get("/api/cors-test", (req, res) => {
    console.log(`CORS test request from origin: ${req.headers.origin}`);
    res.json({
      message: "CORS is working!",
      origin: req.headers.origin,
      timestamp: new Date().toISOString(),
    });
  });

  // Slack health check endpoint
  app.get("/slack/health", (req, res) => {
    console.log("[Slack] Health check endpoint called");
    const slackBotToken = process.env.SLACK_BOT_TOKEN;
    const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

    res.json({
      status: "healthy",
      slackIntegration: "active",
      timestamp: new Date().toISOString(),
      botToken: slackBotToken ? "configured" : "missing",
      signingSecret: slackSigningSecret ? "configured" : "missing",
    });
  });

  // Zoom endpoints
  app.post("/api/zoom/signature", jsonParser, async (req, res) => {
    try {
      const { meetingNumber, role = 0 } = req.body;

      if (!meetingNumber) {
        res.status(400).json({ 
          error: "Meeting number is required",
          message: "Please provide a meeting number to generate a signature"
        });
        return;
      }

      // Check if credentials are configured
      if (!process.env.ZOOM_SDK_KEY || !process.env.ZOOM_SDK_SECRET) {
        res.status(500).json({ 
          error: "Zoom SDK credentials not configured",
          message: "Please set ZOOM_SDK_KEY and ZOOM_SDK_SECRET in your .env file. See ZOOM_SETUP.md for instructions."
        });
        return;
      }

      const signature = zoomService.generateSDKSignature(meetingNumber, role);
      res.json({ signature, meetingNumber, role });
    } catch (error: any) {
      console.error("Error generating Zoom signature:", error);
      res.status(500).json({ 
        error: error.message || "Failed to generate signature",
        message: error.message || "Failed to generate signature. Check server logs for details."
      });
    }
  });

  app.post("/api/zoom/create-meeting", jsonParser, async (req, res) => {
    try {
      const { topic, startTime } = req.body;

      if (!topic) {
        res.status(400).json({ 
          error: "Topic is required",
          message: "Please provide a meeting topic"
        });
        return;
      }

      // Check if credentials are configured
      if (!process.env.ZOOM_API_KEY || !process.env.ZOOM_API_SECRET) {
        res.status(500).json({ 
          error: "Zoom API credentials not configured",
          message: "Please set ZOOM_API_KEY, ZOOM_API_SECRET, and ZOOM_USER_ID in your .env file. See ZOOM_SETUP.md for instructions."
        });
        return;
      }

      const meeting = await zoomService.createMeeting(topic, startTime);
      res.json(meeting);
    } catch (error: any) {
      console.error("Error creating Zoom meeting:", error);
      res.status(500).json({ 
        error: error.message || "Failed to create meeting",
        message: error.message || "Failed to create meeting. Check server logs for details."
      });
    }
  });

  return httpServer;
}
