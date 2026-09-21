# agent-email-router-next

**[Live demo](https://email-router-192983570115.europe-west1.run.app/)**

An interactive Next.js visualizer for an AI agent that forwards user messages to the right department email address.

This repository is a Node.js and Next.js implementation based on my original Python implementation with CLI: [feegloo/agent-email-router](https://github.com/feegloo/agent-email-router).

https://github.com/user-attachments/assets/69900e98-ba3f-4342-a3e6-d48a89b08e3e

## What it does

1. The user writes a message and enters their email address in the browser.
2. The Next.js server loads the latest forwarding emails and editable routing rules.
3. A dynamic prompt and a constrained `forward_email` tool are sent to `qwen3.5:0.8b` through Ollama.
4. The model selects one server-defined `routeId`.
5. The server validates the selection and sends the message to the corresponding email address.
6. The UI highlights the path selected by the agent.

The model never provides the destination email address directly. It can only select an ID from the current list of routes, and the server resolves that ID to a saved email address.

## Forwarding routes

The application starts with three routes:

- `human-resources@example.com`
- `help-desk@example.com`
- `other@example.com`

Both the email address and its forwarding rule are editable. A change is saved to the server when the field loses focus. Routes can also be added and removed.

Routes are persisted in the `routes_data` Docker volume. They are used to build a new agent prompt for every message, so changing a rule changes subsequent routing decisions without changing source code or restarting the application.


## Local services

- Application: http://localhost:3000
- Health endpoint: http://localhost:3000/api/health
- MailHog inbox: http://localhost:8025
- Ollama API: http://localhost:11434

## API

### Route a message

```http
POST /api/messages
Content-Type: application/json

{
  "email": "adam.nowak@example.com",
  "message": "I cannot access my company account"
}
```

The request stays open while the local model processes the message and the email is sent. A successful response contains the selected route:

```json
{
  "status": "forwarded",
  "routeId": "help-desk",
  "email": "help-desk@example.com"
}
```

Both `email` and `message` are required. The sender email is validated and used as `Reply-To` and in the message subject. `From` remains the configured agent address (`EMAIL_FROM`). SMTP acceptance does not confirm inbox delivery. If routing succeeds but SMTP submission fails, the response retains the selected route with `status: "routed"` and a `warning`; the UI keeps the arrows green and shows a yellow warning.

### Manage forwarding routes

- `GET /api/routes`
- `POST /api/routes`
- `PATCH /api/routes/:id`
- `DELETE /api/routes/:id`


## Run locally

Requirements:

- Docker with Docker Compose
- Approximately 2 GB of free disk space for images and the model

Start the complete application:

```bash
docker compose up -d --wait --build
```

Or use:

```bash
make up
```

The first startup takes longer because the `ollama-model-init` container downloads `qwen3.5:0.8b`. Open http://localhost:3000 after all services become healthy.

Send a message such as:

```text
My computer stopped working. Can someone help me?
```

The agent should route it to `help-desk@example.com`. The generated email can be inspected in MailHog at http://localhost:8025.

Stop the services:

```bash
docker compose down
```

### Live container logs (local only)

The three small lines below the agent status show actual Ollama stdout/stderr,
not model response tokens. The container entrypoint duplicates output to a shared
log file; Next.js mounts it read-only and sends each new complete line separately
over `/api/agent/logs` (SSE), checking every 250 ms with a byte cursor.
The UI queues bursts and adds one line at a time, keeping three visible lines.
On connection, the latest three lines seed the display. Hover a line to read its full text.

Run `docker compose up --build -d` after updating, including the `docker/`
folder. No Docker socket is mounted. Logs reset when the Ollama container starts;
the file grows during a session. This unauthenticated diagnostic endpoint is for
local development only: logs may contain sensitive data. Do not expose it publicly.
Outside Compose, set `OLLAMA_LOG_PATH` to a readable Ollama stdout/stderr log file.

The inference timeout defaults to 600000 ms and can be changed with
`OLLAMA_TIMEOUT_MS`. Longer timeouts do not accelerate CPU inference.


## Development without the application container

Copy the environment file and install dependencies:

```bash
cp .env.example .env
npm install
```

Start the supporting services:

```bash
docker compose up -d --wait ollama ollama-model-init mailhog
```

Start Next.js:

```bash
npm run dev
```

## Checks

```bash
make check
```

This runs ESLint, TypeScript, unit tests, and the production build.

## Configuration

See [`.env.example`](./.env.example) for the complete local configuration.

The default model is:

```text
qwen3.5:0.8b
```

This small model is fast enough for a local demonstration but can occasionally omit the required tool call or return an invalid argument. The server validates every tool call and automatically retries once before returning an error.

## Cloud deployment

See [Cloud Run deployment](deploy/cloud-run/README.md) for a public, scale-to-zero UI with a private L4 GPU service, persistent routing rules, and authenticated external SMTP. MailHog is used locally only.
