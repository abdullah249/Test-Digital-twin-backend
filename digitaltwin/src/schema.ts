import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";


export const agentMetricsSchema = z.object({
  requests_handled: z.number(),
  success_rate: z.number(),
  avg_response_time: z.number(),
});

export type AgentMetrics = z.infer<typeof agentMetricsSchema>;

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("idle"),
  type: text("type").notNull(),
  capabilities: text("capabilities").array().notNull(),
  avatar: text("avatar").notNull(),
  metrics: jsonb("metrics").notNull().default({
    requests_handled: 0,
    success_rate: 0,
    avg_response_time: 0,
  }),
});

export const digitalTwins = pgTable("digital_twins", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  status: text("status").notNull().default("active"),
  avatar: text("avatar").notNull(),
  capabilities: text("capabilities").array().notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Configuration for the digital twin's behavior and appearance
  configuration: jsonb("configuration").notNull().default({
    personality: "friendly",
    voice_id: "21m00Tcm4TlvDq8ikWAM",
    voice_settings: {
      stability: 0.75,
      similarityBoost: 0.75,
      style: 0.5,
      speakerBoost: true
    }
  }),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("medium"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  assignedAgentId: integer("assigned_agent_id").references(() => agents.id),
  assignedTwinId: integer("assigned_twin_id").references(() => digitalTwins.id),
  metadata: jsonb("metadata").default({}),
});

export const insertAgentSchema = createInsertSchema(agents);

export const insertTaskSchema = createInsertSchema(tasks);

export const insertDigitalTwinSchema = createInsertSchema(digitalTwins);

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  participants: text("participants").array().notNull(),
  topic: text("topic").notNull(),
  transcript: text("transcript").notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations);

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertDigitalTwin = z.infer<typeof insertDigitalTwinSchema>;
export type DigitalTwin = typeof digitalTwins.$inferSelect;

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;