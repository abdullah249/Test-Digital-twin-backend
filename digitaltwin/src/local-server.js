// import express from 'express';
// import * as dotenv from 'dotenv';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import { registerRoutes } from './routes.js';
// import { setupVite } from './vite.js';
// import { initializeConnection, checkTablesExist, initializeTables } from './db.js';
// import cors from 'cors';

// // Get the directory name in ES modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Load environment variables
// dotenv.config();
// console.log("NODE_ENV:", process.env.NODE_ENV);
// console.log("DATABASE_URL from process.env:", process.env.DATABASE_URL ? "Found" : "Not found");

// // Create Express app
// const app = express();

// // Add middleware
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));

// // Add CORS middleware with proper WebSocket headers
// app.use((req, res, next) => {
//   // For local development, allow all origins
//   res.setHeader('Access-Control-Allow-Origin', 'https://agent-f-end-vercel.vercel.app');
  
//   // Allow credentials
//   res.setHeader('Access-Control-Allow-Credentials', 'true');
  
//   // Allow WebSocket-related headers
//   res.setHeader('Access-Control-Allow-Headers', 
//     'Origin, X-Requested-With, Content-Type, Accept, Authorization, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version');
  
//   // Allow methods
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
//   // Handle preflight requests
//   if (req.method === 'OPTIONS') {
//     return res.status(200).end();
//   }
  
//   next();
// });

// // Add detailed logging middleware
// app.use((req, res, next) => {
//   const start = Date.now();
//   const path = req.path;
//   let capturedJsonResponse = undefined;

//   const originalResJson = res.json;
//   res.json = function (bodyJson, ...args) {
//     capturedJsonResponse = bodyJson;
//     return originalResJson.apply(res, [bodyJson, ...args]);
//   };

//   res.on("finish", () => {
//     const duration = Date.now() - start;
//     if (path.startsWith("/api")) {
//       let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
//       if (capturedJsonResponse) {
//         logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
//       }

//       if (logLine.length > 80) {
//         logLine = logLine.slice(0, 79) + "…";
//       }

//       console.log(logLine);
//     }
//   });

//   next();
// });

// // Add health check endpoint
// app.get('/api/health', (req, res) => {
//   res.json({ 
//     status: 'ok',
//     timestamp: new Date().toISOString(),
//     environment: 'development',
//     websocket: 'enabled'
//   });
// });

// async function startServer() {
//   try {
//     // Initialize database connection
//     if (process.env.DATABASE_URL) {
//       console.log("Initializing database connection...");
//       await initializeConnection();
      
//       console.log("Checking database connection and tables...");
//       const tablesExist = await checkTablesExist();
      
//       if (!tablesExist) {
//         console.log("Tables don't exist, initializing database...");
//         await initializeTables();
//         console.log("Database initialized successfully!");
//       } else {
//         console.log("Database tables already exist!");
//       }
//     } else {
//       console.log("DATABASE_URL not set, using mock database");
//     }
    
//     // Create HTTP server and register routes (including WebSocket)
//     const server = registerRoutes(app);
    
//     // Add error handling middleware
//     app.use((err, _req, res, _next) => {
//       const status = err.status || err.statusCode || 500;
//       const message = err.message || "Internal Server Error";
//       res.status(status).json({ message });
//       console.error(err);
//     });
    
//     // Start the server
//     const port = process.env.PORT || 3001; // Match the port in the client's WebSocket connection
//     server.listen(port, '0.0.0.0', () => {
//       console.log(`Local development server running on port ${port}`);
//       console.log(`WebSocket endpoint available at ws://localhost:${port}/ws`);
//       console.log(`Web interface available at http://localhost:${port}`);
//     });
//   } catch (error) {
//     console.error('Error starting server:', error);
//     process.exit(1);
//   }
// }

// // Start the server
// startServer();



import express from 'express';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { registerRoutes } from './routes.js';
import { setupVite } from './vite.js';
import { initializeConnection, checkTablesExist, initializeTables } from './db.js';
// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables
dotenv.config();
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("DATABASE_URL from process.env:", process.env.DATABASE_URL ? "Found" : "Not found");
// Create Express app
const app = express();
// // Use CORS middleware
// app.use(cors({
//   origin: 'https://agent-f-end-vercel.vercel.app',
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true,
// }));


// add by haseeb 

// enable CORS preflight across the board
app.options('*', cors({
  origin: 'https://agent-f-end-vercel.vercel.app',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
}));



// Add body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Add detailed logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      console.log(logLine);
    }
  });
  next();
});
// Add health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: 'development',
    websocket: 'enabled'
  });
});
async function startServer() {
  try {
    // Initialize database connection
    if (process.env.DATABASE_URL) {
      console.log("Initializing database connection...");
      await initializeConnection();
      console.log("Checking database connection and tables...");
      const tablesExist = await checkTablesExist();
      if (!tablesExist) {
        console.log("Tables don't exist, initializing database...");
        await initializeTables();
        console.log("Database initialized successfully!");
      } else {
        console.log("Database tables already exist!");
      }
    } else {
      console.log("DATABASE_URL not set, using mock database");
    }
    // Register routes and create WebSocket server
    const server = registerRoutes(app);
    // Error handling middleware
    app.use((err, _req, res, _next) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      console.error(err);
    });
    // Start server
    const port = process.env.PORT || 3001;
    server.listen(port, '0.0.0.0', () => {
      console.log(`Local development server running on port ${port}`);
      console.log(`WebSocket endpoint available at ws://localhost:${port}/ws`);
      console.log(`Web interface available at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}
// Start the server
startServer();




















