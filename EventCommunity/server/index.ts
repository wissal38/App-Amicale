import express, { type Request, Response, NextFunction, Application } from "express";
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { xss } from 'express-xss-sanitizer';
import hpp from 'hpp';
import compression from 'compression';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { connectMongoDB } from "./mongodb";
import { errorHandler, notFoundHandler } from "./middleware/error";
import dotenv from 'dotenv';
import http from 'http';

// Load environment variables
dotenv.config();

const app = express();

// 1) GLOBAL MIDDLEWARES
// Set security HTTP headers
// In development, disable CSP to allow Vite inline scripts and HMR WebSocket
if (process.env.NODE_ENV === 'development') {
  app.use(helmet({ contentSecurityPolicy: false }));
} else {
  app.use(helmet());
}

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Limit requests from same API (only in production to avoid 429 during development)
if (process.env.NODE_ENV === 'production') {
  // Global API limiter with auth routes excluded (handled by a dedicated limiter below)
  const apiLimiter = rateLimit({
    max: 1000, // allow more requests in production before throttling
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many requests from this IP, please try again in an hour!',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      const url = req.originalUrl || req.url;
      const host = req.headers['host'] || '';
      const ip = req.ip || '';
      const isLocal = typeof host === 'string' && (host.includes('localhost') || host.includes('127.0.0.1')) || ip === '::1' || ip === '127.0.0.1';
      if (isLocal) return true; // never rate-limit localhost
      // exclude login/register from the global limiter
      return url.startsWith('/api/auth/login') || url.startsWith('/api/auth/register') || req.method === 'OPTIONS';
    }
  });
  app.use('/api', apiLimiter);

  // Dedicated limiter for login endpoint
  const loginLimiter = rateLimit({
    max: 200, // allow ample login attempts within window to avoid false 429s
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      const host = req.headers['host'] || '';
      const ip = req.ip || '';
      return (typeof host === 'string' && (host.includes('localhost') || host.includes('127.0.0.1'))) || ip === '::1' || ip === '127.0.0.1';
    }
  });
  app.post('/api/auth/login', loginLimiter, (_req, _res, next) => next());
} else {
  console.log('Rate limiter disabled in development');
}

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
  whitelist: [
    'duration', 'ratingsQuantity', 'ratingsAverage', 'maxGroupSize', 'difficulty', 'price'
  ]
}));

// Compress all responses
app.use(compression());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const logLine = `[${new Date().toISOString()}] ${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      console.log(logLine);
      
      // Log request details in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Request Headers:', req.headers);
        console.log('Request Body:', req.body);
        console.log('Response:', capturedJsonResponse);
      }
      
      log(logLine);
    }
  });

  next();
});

(async () => {
  // Connecter à MongoDB
  await connectMongoDB();
  
  // Register routes and obtain the underlying HTTP server used across the app
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // 4) ERROR HANDLING MIDDLEWARE
  // Handle 404 - Must be after all other routes
  app.all('*', notFoundHandler);

  // Global error handling middleware
  app.use(errorHandler);

  // 5) START SERVER
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5004;
  server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err: Error) => {
    console.error('UNHANDLED REJECTION! Shutting down...');
    console.error(err.name, err.message);
    
    // Close server & exit process
    server.close(() => {
      process.exit(1);
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err: Error) => {
    console.error('UNCAUGHT EXCEPTION! Shutting down...');
    console.error(err.name, err.message);
    
    // Close server & exit process
    server.close(() => {
      process.exit(1);
    });
  });
})();