// server.js — Custom Next.js Server dengan Socket.io
// ============================================================
// Mengganti Supabase Realtime dengan WebSocket/Socket.io lokal.
// Jalankan dengan: node server.js (dev) atau node server.js (prod)
// ============================================================

const { createServer } = require("http");
const { Server: SocketIOServer } = require("socket.io");
const next = require("next");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Simpan socket server di global agar bisa diakses dari API routes
global._socketio = null;

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // ─── Setup Socket.io ────────────────────────────────────────────────────────

  const io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    transports: ["websocket", "polling"],
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Simpan instance di global agar API routes bisa emit events
  global._socketio = io;

  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Client bisa join room berdasarkan mesin/line
    socket.on("join:line", (lineId) => {
      socket.join(`line:${lineId}`);
      console.log(`[Socket.io] ${socket.id} joined line:${lineId}`);
    });

    socket.on("join:mesin", (mesin) => {
      socket.join(`mesin:${mesin}`);
      console.log(`[Socket.io] ${socket.id} joined mesin:${mesin}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`\n✅ PKIS-PLUS server ready at http://${hostname}:${port}`);
    console.log(`   Socket.io listening on path: /api/socket`);
    console.log(`   Mode: ${dev ? "development" : "production"}\n`);
  });
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────────

process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Server] SIGINT received, shutting down gracefully...");
  process.exit(0);
});
