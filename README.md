<<<<<<< HEAD
# RealTimeWebApplication
blablabla
=======
# Realtime Chat Backend — Implementation Guide

**Stack**: Node.js, Express, Socket.IO, MongoDB (Mongoose), Redis, JWT, Winston, Jest

This document is a step-by-step implementation plan, architecture, code snippets, config files, testing guidance, and operational notes to build a production-quality realtime chat backend (no frontend).

---

## Table of contents

1. Goals & requirements
2. High-level architecture
3. Folder structure
4. Core models (Mongoose schemas)
5. Auth (JWT) and REST API endpoints
6. Socket.IO architecture (Redis adapter + pub/sub)
7. Presence tracking
8. Message persistence & pagination
9. Rate limiting (REST + socket-level)
10. Logging (Winston)
11. Testing strategy (Jest + socket.io-client)
12. Deployment & docker-compose
13. Swagger (API docs)
14. Operational notes & scaling
15. Postman & Socket.IO test recipes
16. Extras & hardening checklist

---

## 1) Goals & requirements

* Signup/login with JWT
* REST endpoints for profiles and fetching history
* Socket connections for realtime messaging (1:1 and rooms)
* Persist messages in MongoDB
* Presence: online/offline per user and per device
* Redis for session store and Socket scaling (pub/sub)
* Rate limiting to prevent spam
* Structured logs via Winston
* Unit & integration tests using Jest
* Bonus: Swagger UI

## 2) High-level architecture

* **API server**: Express + REST endpoints (auth, users, messages)
* **Realtime layer**: Socket.IO integrated in same Node server
* **DB**: MongoDB for users, rooms, messages
* **Cache / coordination**: Redis

  * Use `socket.io-redis` (or built-in adapter) for pub/sub across instances
  * Use Redis sets/hashes to track online presence and socket → user mapping
* **Logging**: Winston to centralize logs (JSON output)
* **Tests**: Jest for unit tests; integration tests launching in-memory MongoDB (mongodb-memory-server) and a Redis mock or real local Redis

**Flow**: When user authenticates (JWT), client connects to Socket.IO passing the token. Server validates, associates socket id to user id (persisted in Redis). When user sends message, server rate-limits, persists to MongoDB, emits to recipient(s) and publishes to other instances via Redis adapter.

## 3) Folder structure

```
chat-backend/
├── src/
│   ├── config/
│   │   ├── index.js
│   │   └── winston.js
│   ├── models/
│   │   ├── user.js
│   │   ├── room.js
│   │   └── message.js
│   ├── services/
│   │   ├── auth.js
│   │   ├── presence.js
│   │   ├── rateLimiter.js
│   │   └── socketService.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   └── messages.js
│   ├── sockets/
│   │   └── index.js
│   ├── utils/
│   │   └── validators.js
│   ├── app.js
│   └── server.js
├── tests/
│   ├── unit/
│   └── integration/
├── docker-compose.yml
├── Dockerfile
├── package.json
└── README.md
```

## 4) Core models (Mongoose schemas)

### `User` (src/models/user.js)

* `_id`, `username` (unique), `email` (unique), `passwordHash`, `displayName`, `avatarUrl`, `createdAt`, `lastSeen`, `roles`

### `Room` (src/models/room.js)

* `_id`, `name` (optional), `isGroup` (boolean), `members` [userId], `createdBy`, `createdAt`, `meta`

### `Message` (src/models/message.js)

* `_id`, `roomId`, `from` (userId), `to` (userId or null), `content` (text), `type` (text/image/...), `delivered` (bool or per-user delivery map), `readBy` [userId], `createdAt`

Include appropriate indexes on `roomId + createdAt`, `to + createdAt`, and text indexes if you need search.

## 5) Auth (JWT) and REST endpoints

### JWT flow

* On login/signup issue a JWT with short expiration (e.g., 1h) and a refresh token (longer-lived stored server-side in Redis or DB). For simplicity you can store refresh tokens in Redis keyed by userId.
* Use `express-jwt` middleware or custom middleware to validate tokens on REST and sockets.

### Key endpoints (Express)

* `POST /api/auth/signup` — {username, email, password}
* `POST /api/auth/login` — {email, password} -> {accessToken, refreshToken}
* `POST /api/auth/refresh` — {refreshToken} -> new accessToken
* `GET /api/users/:id` — get user profile
* `GET /api/rooms/:roomId/messages?limit=&before=` — get messages (pagination)
* `GET /api/users/:id/presence` — optional presence endpoint

Add input validation (Joi or express-validator) and proper error codes.

## 6) Socket.IO architecture

**Setup** (src/sockets/index.js)

* Attach socket.io to the HTTP server in `server.js`.
* Use `socket.io-redis` adapter (or `@socket.io/redis-adapter`) with Redis connection to scale across instances.
* Authentication: implement a `middleware` for sockets which reads the token (via `auth` query param or `Authorization` in `socket.handshake.headers`) and validates JWT, attaching `socket.user`.

**Socket events**

* `connection` — on connect, register socket → user mapping, join rooms (user's private room `user:{userId}`), broadcast presence
* `disconnect` — remove socket mapping; if no more sockets for user, mark offline
* `message:send` — payload `{roomId, toUserId, content, clientMessageId}`; server rate-limits, persists message, emits `message:receive` to room and to `user:{recipientId}` channels
* `message:ack` — client acknowledges delivery/read statuses
* `typing` — optional typing indicator, forwarded to other room members

**Room strategy**

* For 1:1 chats, use a room name deterministic: `room:{minId}-{maxId}` or maintain `Room` documents. For group chats use `room:{roomId}`.

**Delivery guarantees**

* Persist message first, then emit. Include a `serverMessageId` and timestamp so clients can reconcile.

## 7) Presence tracking (using Redis)

Design: Keep a Redis **set** of active socket ids per user and a global set of online user ids.

* Key: `user:sockets:{userId}` — set of socket IDs
* Key: `user:online` — set of userIds currently online
* On socket connect: add socket id to `user:sockets:{userId}`, add userId to `user:online`.
* On disconnect: remove socket id, check set cardinality. If zero remove userId from `user:online` and set `lastSeen` in MongoDB.

Expose REST or socket endpoint to query presence. Publish presence changes via Socket.IO to friends/room members.

## 8) Message persistence & pagination

Schema references above. For history endpoint use cursor pagination by `createdAt` or message `_id`.

Example query:

```
GET /api/rooms/:roomId/messages?limit=50&before=2025-10-29T10:00:00Z
```

Server does `Message.find({roomId, createdAt: {$lt: before}}).sort({createdAt:-1}).limit(limit)` and returns reversed to clients.

Consider adding message trimming or archiving policies for extremely large rooms.

## 9) Rate limiting

Two layers:

1. **REST**: Use `express-rate-limit` for normal API endpoints (e.g., 100 requests per 15 min per IP).
2. **Socket-level**: Implement token bucket per-user or per-socket in Redis.

   * Keep counter key `rate:messages:{userId}` with TTL of the window. On each `message:send` increment; if exceeds threshold (e.g., 10 messages / 5 seconds) drop and emit `error:rate_limited`.
   * Better: use leaky-bucket algorithm with small Lua script in Redis for atomicity.

Also apply per-room limits and limit message size.

## 10) Logging with Winston /// done

* Configure Winston with two transports: console (JSON) and file/rotating files. In production, consider sending logs to a centralized system (ELK, Datadog, etc.).
* Log levels: `error`, `warn`, `info`, `debug`.
* Log structure: timestamp, requestId (generate on incoming HTTP request), userId, ip, route, duration, message.

Example `src/config/winston.js` provided in snippets.

## 11) Testing strategy (Jest)

**Unit**

* Test utilities, validators, services (auth hashing, token creation). Use mocking for Mongoose models via `jest.mock` or `mongodb-memory-server`.

**Integration**

* Use `mongodb-memory-server` to run ephemeral MongoDB for tests.
* For Socket tests use `socket.io-client` to connect to a running test server (spawned by Jest before tests run). You can run a real Redis instance in CI or mock Redis using `redis-mock` for lower fidelity.

**Examples**

* Test that when client A sends `message:send` to B, message persists and B receives `message:receive`.
* Test presence toggles when sockets connect/disconnect.

## 12) Deployment & docker-compose

Provide `docker-compose.yml` with services: `app`, `mongo`, `redis`. Example:

```yaml
version: '3.8'
services:
  redis:
    image: redis:7
    ports: ["6379:6379"]
    volumes:
      - redis-data:/data
  mongo:
    image: mongo:6
    ports: ["27017:27017"]
    volumes:
      - mongo-data:/data/db
  app:
    build: .
    env_file: .env
    ports: ["3000:3000"]
    depends_on: [redis, mongo]
volumes:
  redis-data:
  mongo-data:
```

**Production**: run multiple replicas behind a load balancer (sticky sessions not required if using Redis adapter and emitting to `user:{id}` rooms). Use PM2 or container orchestration.

## 13) Swagger (API docs)

* Use `swagger-jsdoc` + `swagger-ui-express` or Redoc.
* Document REST endpoints, models and auth header.
* Serve at `/docs`.

## 14) Operational notes & scaling

* Use Redis adapter so sockets across instances can communicate. Each instance still runs Socket.IO and handles its local sockets.
* For >10k connections, tune Node/GC and increase ulimits.
* Use horizontal scaling: run N app instances behind LB; Redis and MongoDB are centralized and scaled independently.
* Monitor heartbeats and implement healthcheck endpoints.
* Housekeeping tasks: prune `user:sockets:{userId}` set keys for stale sockets occasionally.

## 15) Postman & Socket.IO test recipes

**REST (Postman)**

* Signup user -> receive accessToken
* Add `Authorization: Bearer <token>` header and call protected endpoints

**Socket.IO CLI / client**

* Connect: `io('https://api.example.com', {auth: {token: 'JWT'}})` or pass `?token=`
* Emit: `socket.emit('message:send', {roomId, content})`
* Listen: `socket.on('message:receive', msg => console.log(msg))`

**Useful tests**

* Multi-client integration: connect two clients in test, verify message persistence and event delivery
* Presence: open/close client sockets and verify presence events

## 16) Extras & hardening checklist

* Validate message size, sanitize inputs
* Use CSP and secure cookies if serving any frontends
* Rotate JWT signing keys periodically
* Use TLS (HTTPS / WSS)
* Ensure Redis is secured (auth, private network)
* Implement message deletion/edits carefully (audit trail)
* Rate-limit login endpoints to prevent brute-force

---

# Implementation: code snippets (boilerplate)

> The snippets below are minimal but ready to copy/paste and expand. Replace `process.env.*` values appropriately.

### `package.json` (core deps)

```json
{
  "name": "chat-backend",
  "version": "1.0.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "express": "^4.x",
    "socket.io": "^4.x",
    "mongoose": "^7.x",
    "ioredis": "^5.x",
    "@socket.io/redis-adapter": "^7.x",
    "jsonwebtoken": "^9.x",
    "bcrypt": "^5.x",
    "winston": "^3.x",
    "swagger-jsdoc": "^6.x",
    "swagger-ui-express": "^4.x",
    "express-rate-limit": "^6.x",
    "helmet": "^7.x",
    "cors": "^2.x"
  },
  "devDependencies": {
    "jest": "^29.x",
    "supertest": "^6.x",
    "socket.io-client": "^4.x",
    "mongodb-memory-server": "^8.x",
    "nodemon": "^2.x"
  }
}
```

### `src/server.js`

```js
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { createServer } = require('http');
const createSocket = require('./sockets');
const config = require('./config');
const app = require('./app'); // express app

const httpServer = createServer(app);

async function start(){
  await mongoose.connect(process.env.MONGO_URI);

  const io = createSocket(httpServer); // attaches socket.io and starts redis adapter

  httpServer.listen(process.env.PORT || 3000, () => {
    console.log('Server listening on', process.env.PORT || 3000);
  });
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});
```

### `src/sockets/index.js` (outline)

```js
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');
const presence = require('../services/presence');

module.exports = function(httpServer){
  const io = new Server(httpServer, { cors: { origin: '*' } });

  const pubClient = new Redis(process.env.REDIS_URL);
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  // socket auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if(!token) return next(new Error('Authentication error'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: payload.sub, username: payload.username };
      return next();
    } catch (err) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    await presence.addSocket(userId, socket.id);
    socket.join(`user:${userId}`);

    socket.on('message:send', async (msg) => {
      // rate limiting, validate payload, persist, emit
    });

    socket.on('disconnect', async (reason) => {
      await presence.removeSocket(userId, socket.id);
    });
  });

  return io;
};
```

### `src/services/presence.js` (outline)

```js
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

module.exports = {
  async addSocket(userId, socketId){
    const key = `user:sockets:${userId}`;
    await redis.sadd(key, socketId);
    await redis.sadd('user:online', userId);
    // optionally set TTL for socket sets
  },
  async removeSocket(userId, socketId){
    const key = `user:sockets:${userId}`;
    await redis.srem(key, socketId);
    const remaining = await redis.scard(key);
    if(remaining === 0){
      await redis.srem('user:online', userId);
      // update lastSeen in Mongo
    }
  },
  async isOnline(userId){
    return await redis.sismember('user:online', userId) === 1;
  }
};
```

## 17) Example tests (Jest)

* Use `supertest` to test REST routes
* Use `socket.io-client` for socket tests

Example integration test skeleton:

```js
const { createServer } = require('http');
const ioClient = require('socket.io-client');
const app = require('../src/app');
// start test server with in-memory mongo

describe('socket messaging', () => {
  let server, url;
  beforeAll(async () => {
    server = createServer(app);
    server.listen(0);
    const addr = server.address();
    url = `http://127.0.0.1:${addr.port}`;
    // start socket server (same as production)
  });

  afterAll(() => server.close());

  test('A sends message to B and B receives', (done) => {
    const a = ioClient(url, { auth: { token: '...' } });
    const b = ioClient(url, { auth: { token: '...' } });

    b.on('message:receive', (msg) => {
      expect(msg.content).toBe('hello');
      a.close(); b.close();
      done();
    });

    a.on('connect', () => {
      a.emit('message:send', { to: 'userB', content: 'hello' });
    });
  });
});
```

---

# Quick checklist to get started (minimum viable)

1. Scaffold project + install deps
2. Implement Mongoose models
3. Implement auth routes & JWT
4. Start simple Socket.IO server with local Redis adapter
5. Implement `message:send` path: validate -> persist -> emit
6. Add presence service using Redis
7. Add rate-limiter on socket message path
8. Add basic tests for REST and one socket flow
9. Add Docker + env files
10. Add Swagger docs

---

If you'd like, I can:

* Generate full, runnable starter repo with the core files (server, models, socket handlers) ready-to-run + Dockerfile and docker-compose.
* Provide full test suite scaffolding (Jest + integration tests).
* Produce copy-pasteable full files for any of the outlines above (auth, socket handlers, presence, rate limiter, winston config).

Tell me which part you want next and I will produce complete, ready-to-run code for it.
>>>>>>> 94bb002 (Start of the project)
