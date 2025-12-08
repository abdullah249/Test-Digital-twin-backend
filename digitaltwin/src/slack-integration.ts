import express from "express";
import crypto from "crypto";
import { generateDebate } from "./debate-generator.js";
import { voiceService } from "./voice-service.js";
import { storage } from "./storage.js";
import { conversationManager } from "./conversation-manager.js";

interface SlashCommandPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string; // the topic
  response_url: string;
  trigger_id: string;
}

interface InteractivePayload {
  type: string;
  user: { id: string; name: string };
  channel?: { id: string; name: string };
  actions?: Array<{
    action_id: string;
    value?: string;
    selected_option?: { value: string };
  }>;
  trigger_id: string;
  response_url: string;
}

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || "";
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";

// Digital Twin Personas available in Slack
const DIGITAL_TWINS = [
  {
    id: "albert-einstein",
    name: "Albert Einstein",
    expertise: ["Innovation", "Research", "Problem Solving"],
    emoji: "🧠",
    description: "Theoretical physicist and innovator",
  },
  {
    id: "elon-musk",
    name: "Elon Musk",
    expertise: ["Innovation", "Strategic Thinking", "Product Development"],
    emoji: "🚀",
    description: "Tech entrepreneur and visionary",
  },
  {
    id: "steve-jobs",
    name: "Steve Jobs",
    expertise: ["Innovation", "Product Development", "Design"],
    emoji: "🍎",
    description: "Tech visionary and design pioneer",
  },
  {
    id: "leonardo-da-vinci",
    name: "Leonardo da Vinci",
    expertise: ["Innovation", "Art", "Engineering", "Design Thinking"],
    emoji: "🎨",
    description: "Renaissance innovator and polymath",
  },
  {
    id: "walt-disney",
    name: "Walt Disney",
    expertise: ["Creativity", "Innovation", "Storytelling"],
    emoji: "🏰",
    description: "Creative visionary and storyteller",
  },
  {
    id: "emad-mostaque",
    name: "Emad Mostaque",
    expertise: ["Artificial Intelligence", "Leadership", "Technical Vision"],
    emoji: "🤖",
    description: "AI innovator and leader",
  },
  {
    id: "fei-fei-li",
    name: "Fei-Fei Li",
    expertise: ["Artificial Intelligence", "Research", "Technical Vision"],
    emoji: "👩‍🔬",
    description: "AI researcher and computer vision expert",
  },
];

// Store user conversations in memory (in production, use Redis/database)
const userConversations = new Map<
  string,
  {
    selectedPersona?: string;
    conversationHistory: Array<{
      role: "user" | "assistant";
      content: string;
      persona?: string;
    }>;
    lastActivity: number;
  }
>();

function verifySlackSignature(
  rawBody: string,
  timestamp: string | undefined,
  signature: string | undefined
): boolean {
  if (!SLACK_SIGNING_SECRET || !timestamp || !signature) return false;
  // Replay attack guard (5 min window)
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) return false;
  const sigBase = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", SLACK_SIGNING_SECRET)
    .update(sigBase, "utf8")
    .digest("hex");
  const expected = `v0=${hmac}`;
  // Constant time compare
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function postSlackMessage(channel: string, text: string, blocks?: any[]) {
  if (!SLACK_BOT_TOKEN) return;
  const payload: any = { channel, text };
  if (blocks) payload.blocks = blocks;

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
}

async function postEphemeralMessage(
  channel: string,
  user: string,
  text: string,
  blocks?: any[]
) {
  if (!SLACK_BOT_TOKEN) return;
  const payload: any = { channel, user, text };
  if (blocks) payload.blocks = blocks;

  await fetch("https://slack.com/api/chat.postEphemeral", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
}

async function uploadSlackFile(
  channel: string,
  filename: string,
  buffer: Buffer,
  title?: string
) {
  if (!SLACK_BOT_TOKEN) return;
  // Use FormData (Node 18+/undici)
  const form = new FormData();
  form.append("channels", channel);
  form.append("filename", filename);
  form.append("title", title || filename);
  // Convert Node Buffer to a Blob/File compatible object for FormData
  const uint = new Uint8Array(buffer); // safe view over underlying data
  const fileBlob = new Blob([uint], { type: "audio/mpeg" });
  // Some runtimes support File; fallback to Blob with filename parameter
  form.append(
    "file",
    (globalThis as any).File
      ? new File([fileBlob], filename, { type: "audio/mpeg" })
      : fileBlob,
    filename
  );
  await fetch("https://slack.com/api/files.upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    body: form as any,
  });
}

// Helper function to create persona selection blocks
function createPersonaSelectionBlocks() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "🤖 *Choose a Digital Twin to chat with:*\nSelect from our collection of AI personas based on historical figures and innovators.",
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "static_select",
          placeholder: {
            type: "plain_text",
            text: "Select a persona...",
          },
          action_id: "select_persona",
          options: DIGITAL_TWINS.map((twin) => ({
            text: {
              type: "plain_text",
              text: `${twin.emoji} ${twin.name}`,
            },
            description: {
              type: "plain_text",
              text: twin.description,
            },
            value: twin.id,
          })),
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "💡 *Tip:* Each persona has unique expertise and personality based on their real-world counterpart.",
        },
      ],
    },
  ];
}

// Helper function to create conversation management blocks
function createConversationBlocks(
  persona: string,
  userMessage: string,
  response: string
) {
  const twin = DIGITAL_TWINS.find((t) => t.id === persona);
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${twin?.emoji} ${twin?.name}:*\n${response}`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🎤 Get Voice Response",
          },
          value: JSON.stringify({ persona, text: response }),
          action_id: "generate_voice",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "💭 Continue Chat",
          },
          value: persona,
          action_id: "continue_chat",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🔄 Switch Persona",
          },
          action_id: "switch_persona",
        },
      ],
    },
  ];
}

// Get or create user conversation context
function getUserConversation(userId: string) {
  if (!userConversations.has(userId)) {
    userConversations.set(userId, {
      conversationHistory: [],
      lastActivity: Date.now(),
    });
  }
  const conv = userConversations.get(userId)!;
  conv.lastActivity = Date.now();
  return conv;
}

// Generate AI response using existing conversation logic
async function generatePersonaResponse(
  persona: string,
  userMessage: string,
  conversationHistory: any[]
) {
  try {
    // Use your existing conversation manager or create a simple response
    // For now, create a contextual response based on persona
    const twin = DIGITAL_TWINS.find((t) => t.id === persona);
    if (!twin) return "I'm sorry, I couldn't find that persona.";

    // Create a contextual prompt based on the persona
    const contextualPrompt = `You are ${twin.name}, ${twin.description}. 
Your expertise includes: ${twin.expertise.join(", ")}.
Respond to this message in character: "${userMessage}"
Keep your response conversational and under 300 words.`;

    // Here you would integrate with your AI service (Anthropic, OpenAI, etc.)
    // For now, return a placeholder response
    return `As ${twin.name}, I find your question about "${userMessage}" quite intriguing. Based on my expertise in ${twin.expertise[0]}, I would suggest... [This would be replaced with actual AI-generated content]`;
  } catch (error) {
    console.error("Error generating persona response:", error);
    return "I'm having trouble thinking right now. Please try again in a moment.";
  }
}

// Handle /chat command
async function handleChatCommand(payload: SlashCommandPayload, res: any) {
  const message = (payload.text || "").trim();
  const userConv = getUserConversation(payload.user_id);

  if (!message) {
    // Show persona selection if no message provided
    const blocks = createPersonaSelectionBlocks();
    res.json({
      response_type: "ephemeral",
      text: "Choose a persona to chat with:",
      blocks,
    });
    return;
  }

  if (!userConv.selectedPersona) {
    // No persona selected, show selection
    const blocks = createPersonaSelectionBlocks();
    res.json({
      response_type: "ephemeral",
      text: "Please select a persona first:",
      blocks,
    });
    return;
  }

  // Generate response from selected persona
  res.send(
    `💭 Thinking as ${
      DIGITAL_TWINS.find((t) => t.id === userConv.selectedPersona)?.name
    }...`
  );

  // Async response
  (async () => {
    try {
      const response = await generatePersonaResponse(
        userConv.selectedPersona!,
        message,
        userConv.conversationHistory
      );

      // Add to conversation history
      userConv.conversationHistory.push(
        { role: "user", content: message },
        {
          role: "assistant",
          content: response,
          persona: userConv.selectedPersona,
        }
      );

      const blocks = createConversationBlocks(
        userConv.selectedPersona!,
        message,
        response
      );
      await postSlackMessage(payload.channel_id, "", blocks);
    } catch (error) {
      console.error("Chat command error:", error);
      await postSlackMessage(
        payload.channel_id,
        "Sorry, I encountered an error processing your message."
      );
    }
  })();
}

// Handle /personas command
async function handlePersonasCommand(payload: SlashCommandPayload, res: any) {
  const personaList = DIGITAL_TWINS.map(
    (twin) =>
      `${twin.emoji} *${twin.name}* - ${
        twin.description
      }\n   _Expertise: ${twin.expertise.join(", ")}_`
  ).join("\n\n");

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🤖 *Available Digital Twin Personas:*\n\n${personaList}`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "💬 Start Chatting",
          },
          action_id: "start_chat",
        },
      ],
    },
  ];

  res.json({
    response_type: "ephemeral",
    text: "Available Digital Twin Personas:",
    blocks,
  });
}

// Handle /debate command (existing functionality)
async function handleDebateCommand(payload: SlashCommandPayload, res: any) {
  const topic = (payload.text || "").trim();
  if (!topic) {
    res.send("Please provide a topic, e.g. `/debate AI ethics`");
    return;
  }

  res.send(
    `🎭 Generating debate on "${topic}" between digital twin personas...`
  );

  // Async processing
  (async () => {
    try {
      const debate = await generateDebate({ topic, includeAudio: false });
      await postSlackMessage(
        payload.channel_id,
        `*🎭 Debate: ${topic}*\n${debate.combinedText}`
      );
      if (debate.audioBuffer && debate.audioBuffer.length < 24_000_000) {
        await uploadSlackFile(
          payload.channel_id,
          `debate-${Date.now()}.mp3`,
          debate.audioBuffer,
          `Debate Audio: ${topic}`
        );
      }
    } catch (err) {
      console.error("Debate generation failed", err);
      await postSlackMessage(
        payload.channel_id,
        `❌ Failed to generate debate for topic: ${topic}`
      );
    }
  })();
}

// Handle Slack events (app_mention, message.channels, message.im)
async function handleSlackEvent(event: any) {
  console.log(`[Slack] Handling event: ${event.type}`);

  switch (event.type) {
    case "app_mention":
      await handleAppMention(event);
      break;

    case "message":
      // Only handle direct messages (not channel messages to avoid spam)
      if (event.channel_type === "im") {
        await handleDirectMessage(event);
      }
      break;

    default:
      console.log(`[Slack] Unhandled event type: ${event.type}`);
  }
}

// Handle @DigitalTwinBot mentions in channels
async function handleAppMention(event: any) {
  const { user, channel, text } = event;

  // Remove the bot mention from the text
  const cleanText = text.replace(/<@[UW][A-Z0-9]+>/g, "").trim();

  if (!cleanText) {
    // No message after mention, show help
    const helpBlocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "👋 Hi! I'm DigitalTwinBot. Here's how to chat with me:\n\n• `/chat [message]` - Chat with a digital twin persona\n• `/personas` - See all available personas\n• `/debate [topic]` - Generate debates between personas\n\nOr just mention me with a question!",
        },
      },
    ];

    await postSlackMessage(channel, "", helpBlocks);
    return;
  }

  // Get user conversation context
  const userConv = getUserConversation(user);

  if (!userConv.selectedPersona) {
    // No persona selected, show selection with the user's message queued
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `💭 I'd love to help with: "${cleanText}"\n\nFirst, choose which digital twin persona you'd like to hear from:`,
        },
      },
      ...createPersonaSelectionBlocks().slice(1), // Skip the first intro block
    ];

    await postSlackMessage(channel, "", blocks);

    // Store the message for after persona selection
    userConv.conversationHistory.push({ role: "user", content: cleanText });
    return;
  }

  // Generate response from selected persona
  try {
    const response = await generatePersonaResponse(
      userConv.selectedPersona,
      cleanText,
      userConv.conversationHistory
    );

    // Add to conversation history
    userConv.conversationHistory.push(
      { role: "user", content: cleanText },
      {
        role: "assistant",
        content: response,
        persona: userConv.selectedPersona,
      }
    );

    const blocks = createConversationBlocks(
      userConv.selectedPersona,
      cleanText,
      response
    );
    await postSlackMessage(channel, "", blocks);
  } catch (error) {
    console.error("[Slack] Error in app mention:", error);
    await postSlackMessage(
      channel,
      "Sorry, I encountered an error processing your message. Please try again."
    );
  }
}

// Handle direct messages to the bot
async function handleDirectMessage(event: any) {
  const { user, channel, text } = event;

  // Skip bot messages to avoid loops
  if (event.subtype === "bot_message" || event.bot_id) return;

  const userConv = getUserConversation(user);

  if (!userConv.selectedPersona) {
    // Show persona selection for DMs
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `👋 Hi! I'm DigitalTwinBot. I can help you chat with digital twin personas of famous innovators.\n\nYou said: "${text}"\n\nWho would you like to discuss this with?`,
        },
      },
      ...createPersonaSelectionBlocks().slice(1),
    ];

    await postSlackMessage(channel, "", blocks);

    // Store the message for after persona selection
    userConv.conversationHistory.push({ role: "user", content: text });
    return;
  }

  // Generate response from selected persona in DM
  try {
    const response = await generatePersonaResponse(
      userConv.selectedPersona,
      text,
      userConv.conversationHistory
    );

    // Add to conversation history
    userConv.conversationHistory.push(
      { role: "user", content: text },
      {
        role: "assistant",
        content: response,
        persona: userConv.selectedPersona,
      }
    );

    const blocks = createConversationBlocks(
      userConv.selectedPersona,
      text,
      response
    );
    await postSlackMessage(channel, "", blocks);
  } catch (error) {
    console.error("[Slack] Error in direct message:", error);
    await postSlackMessage(
      channel,
      "Sorry, I encountered an error processing your message. Please try again or use `/chat` command."
    );
  }
}

// Handle interactive components (buttons, select menus)
async function handleInteractivePayload(payload: InteractivePayload, res: any) {
  res.status(200).send(); // Acknowledge immediately

  const userId = payload.user.id;
  const userConv = getUserConversation(userId);

  if (!payload.actions || payload.actions.length === 0) return;

  const action = payload.actions[0];

  switch (action.action_id) {
    case "select_persona":
      const selectedPersona = action.selected_option?.value;
      if (selectedPersona) {
        userConv.selectedPersona = selectedPersona;
        const twin = DIGITAL_TWINS.find((t) => t.id === selectedPersona);
        await postEphemeralMessage(
          payload.channel?.id || "",
          userId,
          `✅ Selected ${twin?.emoji} ${twin?.name}! You can now use \`/chat [your message]\` to start chatting.`
        );
      }
      break;

    case "generate_voice":
      try {
        const voiceData = JSON.parse(action.value || "{}");
        const audioBuffer = await voiceService.synthesizeSpeech({
          text: voiceData.text,
          persona: DIGITAL_TWINS.find((t) => t.id === voiceData.persona)?.name,
        });

        if (audioBuffer && !("fallback" in audioBuffer)) {
          await uploadSlackFile(
            payload.channel?.id || "",
            `voice-response-${Date.now()}.mp3`,
            audioBuffer as Buffer,
            `Voice Response from ${
              DIGITAL_TWINS.find((t) => t.id === voiceData.persona)?.name
            }`
          );
        } else {
          await postEphemeralMessage(
            payload.channel?.id || "",
            userId,
            "🔊 Voice synthesis is temporarily unavailable, but here's the text response above!"
          );
        }
      } catch (error) {
        console.error("Voice generation error:", error);
        await postEphemeralMessage(
          payload.channel?.id || "",
          userId,
          "❌ Sorry, I couldn't generate the voice response right now."
        );
      }
      break;

    case "continue_chat":
      await postEphemeralMessage(
        payload.channel?.id || "",
        userId,
        `💬 Continue chatting with ${
          DIGITAL_TWINS.find((t) => t.id === action.value)?.name
        } using \`/chat [your message]\``
      );
      break;

    case "switch_persona":
      userConv.selectedPersona = undefined;
      const blocks = createPersonaSelectionBlocks();
      await postEphemeralMessage(
        payload.channel?.id || "",
        userId,
        "Choose a new persona:",
        blocks
      );
      break;

    case "start_chat":
      const selectionBlocks = createPersonaSelectionBlocks();
      await postEphemeralMessage(
        payload.channel?.id || "",
        userId,
        "Choose a persona to start chatting:",
        selectionBlocks
      );
      break;
  }
}

export function registerSlackRoutes(app: express.Express) {
  // ALWAYS register the bare /slack URL verification endpoint.
  // Slack will POST { type: 'url_verification', challenge: '...' } and expects the raw challenge string.
  // This MUST NOT be blocked by missing secrets or other middleware.
  // NOTE: express.json() is applied globally in index.ts before this function is invoked.
  app.post("/slack", async (req: any, res: any) => {
    const { type, challenge, event } = req.body || {};

    if (type === "url_verification") {
      if (typeof challenge === "string" && challenge.length > 0) {
        console.log(
          "[Slack] URL verification received. Responding with challenge."
        );
        // Respond with plain text EXACTLY matching the challenge.
        return res.status(200).type("text/plain").send(challenge);
      }
      console.warn(
        "[Slack] URL verification missing/empty challenge field. Body:",
        req.body
      );
      return res.status(400).type("text/plain").send("missing_challenge");
    }

    // Handle Slack events (app_mention, message.channels, message.im)
    if (type === "event_callback" && event) {
      res.sendStatus(200); // Acknowledge immediately

      try {
        await handleSlackEvent(event);
      } catch (error) {
        console.error("[Slack] Error handling event:", error);
      }
      return;
    }

    // For other events, just fast-ack
    return res.sendStatus(200);
  });

  // Only register the richer Slack routes if we have a signing secret.
  if (!SLACK_SIGNING_SECRET) {
    console.warn(
      "[Slack] SLACK_SIGNING_SECRET not set — advanced Slack routes (/slack/webhook) disabled"
    );
    return;
  }
  if (!SLACK_BOT_TOKEN) {
    console.warn(
      "[Slack] SLACK_BOT_TOKEN not set — will not be able to post responses"
    );
  }

  const router = express.Router();

  // Capture raw body for signature verification
  router.use(
    express.urlencoded({
      extended: true,
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString("utf8");
      },
    })
  );

  router.post("/webhook", async (req: any, res) => {
    try {
      const raw = req.rawBody as string;
      const ts = req.header("x-slack-timestamp");
      const sig = req.header("x-slack-signature");
      if (!verifySlackSignature(raw, ts, sig)) {
        res.status(401).send("Invalid signature");
        return;
      }

      // If content-type is JSON but urlencoded parser ran, parse manually
      if (!req.body || Object.keys(req.body).length === 0) {
        const ct = req.headers["content-type"] || "";
        if (/application\/json/i.test(ct) && raw) {
          try {
            req.body = JSON.parse(raw);
          } catch {
            /* ignore */
          }
        }
      }

      // Handle Slack Events API url_verification even if user pointed it here
      if (req.body && req.body.type === "url_verification") {
        const challenge = req.body.challenge;
        if (typeof challenge === "string") {
          res.setHeader("Content-Type", "text/plain");
          res.status(200).send(challenge);
        } else {
          res.status(400).json({ error: "missing_challenge" });
        }
        return;
      }

      // Handle interactive payloads (button clicks, select menus)
      if (req.body.payload) {
        const interactivePayload: InteractivePayload = JSON.parse(
          req.body.payload
        );
        await handleInteractivePayload(interactivePayload, res);
        return;
      }

      // Slash command payload is form-encoded
      const payload: SlashCommandPayload = req.body as any;

      // Handle different slash commands
      switch (payload.command) {
        case "/chat":
          await handleChatCommand(payload, res);
          break;

        case "/personas":
          await handlePersonasCommand(payload, res);
          break;

        case "/debate":
          await handleDebateCommand(payload, res);
          break;

        default:
          res.send(`🤖 *DigitalTwin Bot Commands:*
• \`/chat [message]\` - Chat with a digital twin persona
• \`/personas\` - See all available personas
• \`/debate [topic]\` - Generate a debate between personas
          
Use \`/chat\` to start a conversation!`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Slack webhook error", error);
      res.status(500).send("Internal error");
    }
  });

  app.use("/slack", router);
  console.log("[Slack] Routes registered at /slack/webhook");
}
