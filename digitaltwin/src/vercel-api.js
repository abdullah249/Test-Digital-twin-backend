// import express from 'express';

// // Create Express app
// const app = express();

// // Add middleware
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));

// // Add CORS middleware with more specific configuration
// app.use((req, res, next) => {
//   // Allow requests from any origin
//   const origin = req.headers.origin;
//   res.setHeader('Access-Control-Allow-Origin', origin || 'https://agent-f-end-vercel.vercel.app/');
  
//   // Allow credentials
//   res.setHeader('Access-Control-Allow-Credentials', 'true');
  
//   // Allow specific headers
//   res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Upgrade, Connection');
  
//   // Allow specific methods
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
//   // Handle preflight requests
//   if (req.method === 'OPTIONS') {
//     return res.status(200).end();
//   }
  
//   // Handle WebSocket upgrade requests
//   if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
//     // Since Vercel doesn't support WebSockets in serverless functions,
//     // we'll respond with a 200 OK and send the agents data as JSON
//     if (req.url === '/ws') {
//       console.log('WebSocket connection attempt detected, sending fallback response');
//       return res.json({ 
//         type: "agents_update", 
//         data: fallbackAgents 
//       });
//     }
//   }
  
//   next();
// });

// // Add detailed logging middleware
// app.use((req, res, next) => {
//   const start = Date.now();
//   console.log(`${req.method} ${req.url} - Request received`);
  
//   // Capture the original end method
//   const originalEnd = res.end;
  
//   // Override the end method
//   res.end = function(chunk, encoding) {
//     const duration = Date.now() - start;
//     console.log(`${req.method} ${req.url} - Response sent: ${res.statusCode} in ${duration}ms`);
    
//     // Call the original end method
//     return originalEnd.call(this, chunk, encoding);
//   };
  
//   next();
// });

// // Fallback agents data
// const fallbackAgents = [
//   {
//     id: 1,
//     name: "Albert Einstein",
//     type: "Theoretical Physics",
//     capabilities: ["Innovation", "Research", "Problem Solving"],
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Einstein",
//     status: "active",
//     metrics: {
//       requests_handled: 42,
//       success_rate: 95,
//       avg_response_time: 1.2
//     }
//   },
//   {
//     id: 2,
//     name: "Elon Musk",
//     type: "Tech Entrepreneur",
//     capabilities: ["Innovation", "Strategic Thinking", "Product Development"], 
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Musk",
//     status: "active",
//     metrics: {
//       requests_handled: 38,
//       success_rate: 92,
//       avg_response_time: 1.5
//     }
//   },
//   {
//     id: 3,
//     name: "Emad Mostaque",
//     type: "AI Innovator",
//     capabilities: ["Artificial Intelligence", "Leadership", "Technical Vision"],
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mostaque",
//     status: "active",
//     metrics: {
//       requests_handled: 45,
//       success_rate: 97,
//       avg_response_time: 1.1
//     }
//   },
//   {
//     id: 4,
//     name: "Fei-Fei Li",
//     type: "AI Research",
//     capabilities: ["Artificial Intelligence", "Research", "Technical Vision"],
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Li",
//     status: "active",
//     metrics: {
//       requests_handled: 36,
//       success_rate: 94,
//       avg_response_time: 1.3
//     }
//   },
//   {
//     id: 5,
//     name: "Leonardo da Vinci",
//     type: "Renaissance Innovator",
//     capabilities: ["Innovation", "Art", "Engineering"],
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=DaVinci",
//     status: "active",
//     metrics: {
//       requests_handled: 40,
//       success_rate: 96,
//       avg_response_time: 1.4
//     }
//   },
//   {
//     id: 6,
//     name: "Steve Jobs",
//     type: "Tech Visionary",
//     capabilities: ["Innovation", "Product Development", "Design"],
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jobs",
//     status: "active",
//     metrics: {
//       requests_handled: 39,
//       success_rate: 93,
//       avg_response_time: 1.2
//     }
//   },
//   {
//     id: 7,
//     name: "Walt Disney",
//     type: "Creative Visionary",
//     capabilities: ["Creativity", "Innovation", "Storytelling"],
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Disney",
//     status: "active",
//     metrics: {
//       requests_handled: 37,
//       success_rate: 91,
//       avg_response_time: 1.6
//     }
//   }
// ];

// // API Routes

// // Health check endpoint
// app.get('/api/health', (req, res) => {
//   res.json({ 
//     status: 'ok',
//     timestamp: new Date().toISOString(),
//     environment: process.env.NODE_ENV || 'production'
//   });
// });

// // Get agents
// app.get('/api/agents', (req, res) => {
//   console.log('GET /api/agents - Sending fallback agents data');
//   res.json(fallbackAgents);
// });

// // Update agent status
// app.put('/api/agents/:id/status', (req, res) => {
//   const agentId = parseInt(req.params.id);
//   const { status } = req.body;
  
//   if (isNaN(agentId) || !status) {
//     return res.status(400).json({ error: 'Invalid agent ID or status' });
//   }
  
//   // Find the agent in our fallback data
//   const agent = fallbackAgents.find(a => a.id === agentId);
//   if (!agent) {
//     return res.status(404).json({ error: 'Agent not found' });
//   }
  
//   // Update the status
//   agent.status = status;
  
//   res.json({ success: true, agent });
// });

// // Update agent metrics
// app.put('/api/agents/:id/metrics', (req, res) => {
//   const agentId = parseInt(req.params.id);
//   const { metrics } = req.body;
  
//   if (isNaN(agentId) || !metrics) {
//     return res.status(400).json({ error: 'Invalid agent ID or metrics' });
//   }
  
//   // Find the agent in our fallback data
//   const agent = fallbackAgents.find(a => a.id === agentId);
//   if (!agent) {
//     return res.status(404).json({ error: 'Agent not found' });
//   }
  
//   // Update the metrics
//   agent.metrics = metrics;
  
//   res.json({ success: true, agent });
// });

// // Voice endpoints
// app.get('/api/voice/voices', (req, res) => {
//   // Return default voices
//   res.json([
//     { voice_id: "ThT5KcBeYPX3keUQqHPh", name: "Leonardo da Vinci" },
//     { voice_id: "AZnzlk1XvdvUeBnXmlld", name: "Steve Jobs" }
//   ]);
// });

// app.post('/api/voice/synthesize', (req, res) => {
//   const { text, persona } = req.body;
  
//   // Return a fallback response
//   res.json({
//     fallback: true,
//     text,
//     persona
//   });
// });

// // WebSocket endpoint for Vercel
// app.get('/ws', (req, res) => {
//   console.log('GET /ws - Sending WebSocket fallback response');
//   res.json({
//     type: "agents_update",
//     data: fallbackAgents
//   });
// });

// // Catch-all route for any other API requests
// app.all('/api/*', (req, res) => {
//   res.status(404).json({ error: 'API endpoint not found' });
// });

// // Error handling middleware
// app.use((err, _req, res, _next) => {
//   console.error('API Error:', err);
//   const status = err.status || err.statusCode || 500;
//   const message = err.message || "Internal Server Error";
//   res.status(status).json({ error: message });
// });

// // Export the Express app as a serverless function
// export default app;





import express from 'express';
import cors from 'cors';

// Create Express app
const app = express();

// Configure CORS
const corsOptions = {
  origin: 'https://agent-f-end-vercel.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
};

app.use(cors(corsOptions));

// Add middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add detailed logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`${req.method} ${req.url} - Request received`);

  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - Response sent: ${res.statusCode} in ${duration}ms`);
    return originalEnd.call(this, chunk, encoding);
  };

  next();
});

// Fallback agents data
const fallbackAgents = [
  {
    id: 1,
    name: "Albert Einstein",
    type: "Theoretical Physics",
    capabilities: ["Innovation", "Research", "Problem Solving"],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Einstein",
    status: "active",
    metrics: {
      requests_handled: 42,
      success_rate: 95,
      avg_response_time: 1.2
    }
  },
  {
    id: 2,
    name: "Elon Musk",
    type: "Tech Entrepreneur",
    capabilities: ["Innovation", "Strategic Thinking", "Product Development"],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Musk",
    status: "active",
    metrics: {
      requests_handled: 38,
      success_rate: 92,
      avg_response_time: 1.5
    }
  },
  {
    id: 3,
    name: "Emad Mostaque",
    type: "AI Innovator",
    capabilities: ["Artificial Intelligence", "Leadership", "Technical Vision"],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mostaque",
    status: "active",
    metrics: {
      requests_handled: 45,
      success_rate: 97,
      avg_response_time: 1.1
    }
  },
  {
    id: 4,
    name: "Fei-Fei Li",
    type: "AI Research",
    capabilities: ["Artificial Intelligence", "Research", "Technical Vision"],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Li",
    status: "active",
    metrics: {
      requests_handled: 36,
      success_rate: 94,
      avg_response_time: 1.3
    }
  },
  {
    id: 5,
    name: "Leonardo da Vinci",
    type: "Renaissance Innovator",
    capabilities: ["Innovation", "Art", "Engineering"],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=DaVinci",
    status: "active",
    metrics: {
      requests_handled: 40,
      success_rate: 96,
      avg_response_time: 1.4
    }
  },
  {
    id: 6,
    name: "Steve Jobs",
    type: "Tech Visionary",
    capabilities: ["Innovation", "Product Development", "Design"],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jobs",
    status: "active",
    metrics: {
      requests_handled: 39,
      success_rate: 93,
      avg_response_time: 1.2
    }
  },
  {
    id: 7,
    name: "Walt Disney",
    type: "Creative Visionary",
    capabilities: ["Creativity", "Innovation", "Storytelling"],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Disney",
    status: "active",
    metrics: {
      requests_handled: 37,
      success_rate: 91,
      avg_response_time: 1.6
    }
  }
];

// API Routes

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

app.get('/api/agents', (req, res) => {
  console.log('GET /api/agents - Sending fallback agents data');
  res.json(fallbackAgents);
});

app.put('/api/agents/:id/status', (req, res) => {
  const agentId = parseInt(req.params.id);
  const { status } = req.body;

  if (isNaN(agentId) || !status) {
    return res.status(400).json({ error: 'Invalid agent ID or status' });
  }

  const agent = fallbackAgents.find(a => a.id === agentId);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  agent.status = status;
  res.json({ success: true, agent });
});

app.put('/api/agents/:id/metrics', (req, res) => {
  const agentId = parseInt(req.params.id);
  const { metrics } = req.body;

  if (isNaN(agentId) || !metrics) {
    return res.status(400).json({ error: 'Invalid agent ID or metrics' });
  }

  const agent = fallbackAgents.find(a => a.id === agentId);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  agent.metrics = metrics;
  res.json({ success: true, agent });
});

app.get('/api/voice/voices', (req, res) => {
  res.json([
    { voice_id: "ThT5KcBeYPX3keUQqHPh", name: "Leonardo da Vinci" },
    { voice_id: "AZnzlk1XvdvUeBnXmlld", name: "Steve Jobs" }
  ]);
});

app.post('/api/voice/synthesize', (req, res) => {
  const { text, persona } = req.body;
  res.json({ fallback: true, text, persona });
});

app.get('/ws', (req, res) => {
  console.log('GET /ws - Sending WebSocket fallback response');
  res.json({
    type: "agents_update",
    data: fallbackAgents
  });
});

app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Error handling
app.use((err, _req, res, _next) => {
  console.error('API Error:', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ error: message });
});

export default app;
