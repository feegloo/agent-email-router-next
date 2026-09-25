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

## Sender email and Reply-To

The form contains a message textarea, a required `email` input, and **Send message**. The server validates both fields. Enter sends the form; Shift+Enter adds a new line in the message.

For a request from `adam.nowak@example.com` routed to HR:

| Email field | Value |
| --- | --- |
| From | The agent's configured address (`EMAIL_FROM`) |
| To | The email address of the department selected by the agent |
| Reply-To | `adam.nowak@example.com`, supplied by the user |
| Subject | `New message from user 'adam.nowak@example.com'` |
| Body | The user's message |

The department can use **Reply** in its email client to respond to the user. The user's address is not used as `From`; the agent sends through its configured SMTP account. Email validation checks the address format, not ownership or whether the mailbox exists.

## Routing and email status

Routing and email submission are separate steps:

- Once the agent selects a route, the full path stays green, even if email submission fails.
- Successful SMTP submission shows **Message sent to email address, check spam if not visible**.
- A submission warning shows a yellow **Email cannot be sent to this address** badge and **The message was routed by the agent but couldn't be emailed.** below the form.
- If SMTP explicitly reports that the recipient does not exist (5.1.1 during RCPT TO), the yellow badge says **Email address not found**. An SMTP rejection does not always prove that an address is invalid.
- An actual routing failure shows a red status. Both routing errors and email warnings allow another message to be sent.

**SMTP acceptance is not a delivery receipt.** A provider can accept a message and later have it rejected by Gmail, or deliver it to spam. The app does not currently consume delivery webhooks, so later bounces and spam placement do not update the UI. Use the provider's delivery logs to investigate.

## Forwarding routes

The application starts with three routes:

- `human-resources@example.com`
- `help-desk@example.com`
- `other@example.com`

Both the email address and its forwarding rule are editable. A change is saved to the server when the field loses focus. Routes can also be added and removed.

Locally, routes are persisted in the `routes_data` Docker volume. Cloud Run stores them in a private Cloud Storage bucket. They are used to build a new agent prompt for every message, so changing a rule changes subsequent routing decisions without changing source code or restarting the application.


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

Enter your email in the field below the message, then send. The agent should route it to `help-desk@example.com`. The generated email can be inspected in MailHog at http://localhost:8025.

Stop the services:

```bash
docker compose down
```

### Live container logs

The six small lines below the agent status show raw Ollama stdout/stderr, not model response tokens. Logs are streamed through `/api/agent/logs` using Server-Sent Events (SSE). The UI queues incoming lines and adds one every 100 ms, shifting older lines up and keeping at most six visible. Hover a line to read its full text.

The browser subscribes while a message is processing and closes the stream on completion or failure. Locally, the container duplicates its output into a shared log file that Next.js reads without mounting the Docker socket. In Cloud Run, Next.js authenticates to the private GPU gateway and proxies its log stream to the UI.

Outside Compose, set `OLLAMA_LOG_PATH` to a readable Ollama stdout/stderr log file. Logs are diagnostic output and may contain request details. The public demo exposes shared logs during routing, not a separate log stream for each user.

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

### Local capture and production delivery

- **Local Docker Compose:** MailHog captures messages at http://localhost:8025. No email is delivered to external inboxes.
- **Cloud Run:** MailHog is not deployed. Nodemailer uses authenticated external SMTP (currently Mailgun for the demo), with the password stored in Google Secret Manager.
- **Recipients:** Any saved route address can be submitted to SMTP. The user's `Reply-To` address remains separate from the selected destination.
- **Mailgun sandbox:** Destinations must also be authorized in Mailgun. Replace a default `example.com` route with an authorized inbox to test real delivery.
- **Delivery troubleshooting:** Check both spam and Mailgun logs. During testing, Gmail rejected some sandbox messages with `550 5.7.40` (DMARC alignment); a later test reached spam with an unauthenticated-sender warning. A green path confirms routing, not inbox placement.

For a custom sending domain, configure SPF, DKIM and DMARC with alignment to the `From` domain. Correct authentication helps delivery but does not guarantee avoiding spam. Mailgun sandbox still requires recipients to be authorized there.

### Redeploy

After setting the project, region and SMTP variables described in the [deployment guide](deploy/cloud-run/README.md), run in the same terminal:

```bash
git pull origin main
bash deploy/cloud-run/deploy.sh
```

The deployment uses a public CPU service for the UI and a private L4 GPU service for Ollama. Both have minimum instances set to zero. Opening the UI or editing rules does not wake the GPU; routing does. Shutdown after inactivity is not immediate, and storage/image charges remain.

Routes are shared by visitors to the public demo. For authenticated access through a local proxy, see the [proxy instructions](deploy/cloud-run/README.md#access-through-an-authenticated-local-proxy).
