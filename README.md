# Express TypeScript API

Simple layered API using Express 5, Mongoose, and classes exported as singleton instances.

## Run

Requires Node.js 22.12+ and MongoDB.

```sh
npm install
cp .env.example .env
# Set MONGODB_URI and a random JWT_SECRET (at least 32 characters).
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env`. Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

```sh
npm run check
npm test
npm run build
npm start
```

Tests use an isolated MongoDB through mongodb-memory-server; its first run downloads a MongoDB binary.

## Docker Compose

Copy `.env.example` to `.env` and set a random `JWT_SECRET` of at least 32 characters, then run:

```sh
docker compose up --build -d
docker compose ps
curl http://localhost:3000/health
docker compose logs -f api
```

The API runs at `http://localhost:3000` (or the host port set by `PORT`). Compose sets the internal MongoDB URL automatically. MongoDB data persists in the `mongo_data` named volume; MongoDB has no published host port. This simple local setup uses MongoDB without authentication on the Compose network.

The API image uses a multi-stage build, production dependencies and a non-root user. The build uses `npm ci` when a lockfile exists and `npm install` otherwise; commit the generated lockfile after a successful local install for repeatable builds. MongoDB must pass its healthcheck before the API starts, following [Compose startup ordering](https://docs.docker.com/compose/how-tos/startup-order/).

`GET /health` is public: **200** when MongoDB responds to a bounded ping, or **503** when unavailable. Docker probes this endpoint automatically. Health status alone does not restart a container; the restart policy restarts exited containers.

```sh
docker compose down
```

This stops the stack and preserves database data. S3 credentials are not included in the image; configure a credential provider separately if using S3 from the container.

## Source layout

```text
src/
  config/         Environment validation and database connection
  models/         User schema and unique email index
  services/       User business logic
    s3/           S3 upload, get and delete service
  controllers/    Request validation and HTTP responses
  routes/         Endpoint registration and rate limiting
  middleware/     Central error handler
  utils/          HTTP error class
  app.ts          Express application instance
  server.ts       Startup and shutdown
```

## Endpoints

`POST /api/users/signup`

```json
{ "name": "Ali", "email": "ali@example.com", "password": "strong-password" }
```

Returns **201**. Duplicate email returns **409**.

`POST /api/users/login`

```json
{ "email": "ali@example.com", "password": "strong-password" }
```

Returns **200**. Wrong credentials return **401**.

Both successful responses have this shape:

```json
{ "user": { "id": "...", "name": "Ali", "email": "ali@example.com" }, "token": "..." }
```

Passwords require at least 8 characters on signup and at most 72 UTF-8 bytes (bcrypt's limit). Emails are trimmed and lowercased. JWTs expire after one hour. Invalid inputs return **400**. Auth requests are limited to 30 per IP per 15 minutes. The limiter uses process memory; use a shared store when running multiple server instances. Configure Express `trust proxy` for your specific reverse proxy before deploying behind one. Use HTTPS in production.

## Bearer authentication

Use the token returned by signup or login to call `GET /api/users/me`:

```sh
curl http://localhost:3000/api/users/me -H "Authorization: Bearer YOUR_TOKEN"
```

Flow: route → auth middleware → JWT signature/expiry verification → user lookup → `req.user` → controller. The middleware accepts only HS256 tokens with a valid user ID and expiration, and rejects missing, invalid, expired tokens or deleted users with **401**. Database errors reach the central error handler. Successful responses contain `{ "user": { "id": "...", "name": "Ali", "email": "ali@example.com" } }`.

Protect additional routes with `authMiddleware.authenticate` before their controller handler. Signup and login remain public.

## S3 usage

Set `AWS_REGION` and `S3_BUCKET`, and provide credentials through the standard AWS credential chain (for example an IAM role or local AWS profile). Keep the bucket private and grant only the permissions needed.

```ts
import s3Service from './services/s3/s3.service';

await s3Service.upload('documents/example.txt', Buffer.from('Hello'), 'text/plain');
const object = await s3Service.get('documents/example.txt');
const contents = await object.Body?.transformToString();
await s3Service.delete('documents/example.txt');
```

S3 is a service only; there are no public upload endpoints. AWS configuration is required only when calling its methods.

Express async error handling follows the [Express documentation](https://expressjs.com/en/5x/guide/error-handling/). The server waits for the email index before listening, as explained in [Mongoose's unique index guidance](https://mongoosejs.com/docs/validation).
