# Cloud Run demo deployment

Two Cloud Run services, both with minimum instances 0:

- `email-router`: public Next.js UI on CPU, using an external SMTP provider. Opening the UI and editing rules do not wake the GPU.
- `email-router-gpu`: a private small Node HTTP/log gateway and Ollama with one NVIDIA L4. Only routing and its temporary log stream call this service.

Qwen 3.5 0.8B is downloaded into the Ollama image during build. The first request after scale-to-zero still loads the model into GPU memory. Subsequent requests reuse the loaded model. A warm routing latency has not yet been measured in GCP.

Rules live in a private Cloud Storage bucket. Updates use object generation preconditions and retry conflicts, including during overlapping deployments. Local Docker Compose continues using its existing JSON volume.

## Deploy from your computer

Requirements: Node.js, Docker with buildx, gcloud CLI, a GCP project with billing enabled, permission to enable APIs/create service accounts/grant IAM roles, and Cloud Run L4 quota in the selected region. The script builds and pushes Linux AMD64 images from your checkout.

```bash
git pull
gcloud auth login
export PROJECT_ID=your-project-id
export REGION=europe-west1
 # Configure SMTP as described below before deploying.
bash deploy/cloud-run/deploy.sh
```

The script creates an Artifact Registry repository, a private rules bucket, a dedicated runtime service account and the two services. It grants object access on that bucket and permission for the CPU service to invoke the GPU service. It does not create a service-account key.

After deploying, the script enables public access only for `email-router` using `--no-invoker-iam-check` and prints its URL. Open that URL directly in your browser; no local proxy is needed. This works on both initial deployment and redeployment. `email-router-gpu` remains protected by Cloud Run IAM.

The public demo allows any visitor to send messages, edit shared routing rules and view raw logs during routing. There is no per-user isolation; visitor requests can incur GPU costs.

## Access through an authenticated local proxy

A proxy is useful for testing a private Cloud Run service in your browser. It also works with the public UI, but is not required for public access. Install the gcloud CLI and sign in with an account allowed to invoke the service (for private access, for example an account with `roles/run.invoker`).

Run in a terminal on your computer:

```bash
gcloud auth login
gcloud run services proxy email-router \
  --port=3001 \
  --region=europe-west1 \
  --project=agent-email-router
```

Replace the project and region if you use a different deployment. Keep the terminal running and open [http://localhost:3001](http://localhost:3001). The application and Ollama still run in GCP; the local proxy forwards requests using your Google credentials. Docker does not need to run locally.

Port 3001 avoids a conflict with the local demo on port 3000. If it is occupied, choose another port and open that port in your browser.

Press **Ctrl+C** to stop the proxy. This only closes your local connection; it does not stop or delete the Cloud Run services.

If you receive 403, check the active account with `gcloud auth list` and verify its permission to invoke the service. Use `email-router` for the UI. The private `email-router-gpu` service has no UI, and opening its URL directly without authentication returns 403.

See [Google's authenticated proxy documentation](https://docs.cloud.google.com/run/docs/authenticating/developers#test).

## Verify after deployment

1. Open the UI and edit a rule. Confirm the GPU has not started merely from opening the page.
2. Send a holiday request. Check live raw logs and the selected HR route. Record first-request and warm-request times separately.
3. Verify the browser closes `/api/agent/logs` on success and on failure. After idle time, both services should reach zero instances.
4. Confirm edited rules survive a restart/redeployment.
5. Test a failed routing request, then retry successfully. There must be no stuck Sending state.

Logs show actual Ollama stdout/stderr, not model answer tokens. The gateway exposes only `/api/chat`, `/api/ps`, `/logs`, and `/health`; Cloud Run IAM protects the service. The SSE stream also has a finite lifetime in case a browser disconnect is not propagated.

## Email behavior

Local Docker Compose uses MailHog and does not deliver mail externally. Cloud Run has no MailHog container and requires authenticated external SMTP with TLS. A successful response means the SMTP provider accepted the message, not confirmed inbox delivery.

### Quick test with Mailgun sandbox

1. Create a Mailgun account at https://signup.mailgun.com/.
2. Open **Send > Domains**, select your sandbox domain, and add your own inbox as an authorized recipient. Confirm the verification email.
3. Find the domain's SMTP credentials. Use the SMTP hostname displayed for its region, the full SMTP username, and SMTP password (not the API key).
4. In Google Cloud Secret Manager, enable its API and create a secret named `email-router-smtp-password` containing only that SMTP password. Do not paste it into chat or commit it to Git.
5. Set these non-secret variables in the terminal used for deployment, replacing all example values:

```bash
export SMTP_HOST=smtp.mailgun.org
export SMTP_PORT=587
export SMTP_USER=postmaster@sandboxYOUR_DOMAIN.mailgun.org
export EMAIL_FROM=router@sandboxYOUR_DOMAIN.mailgun.org
export SMTP_PASSWORD_SECRET=email-router-smtp-password
export SMTP_PASSWORD_VERSION=1
bash deploy/cloud-run/deploy.sh
```

The script grants the runtime service account access to this secret and pins its version in the Cloud Run configuration. Keep these settings for redeployments; the script fails before building if required SMTP settings are missing. For password rotation, add a new secret version and deploy with that version number. Other SMTP providers work with the same variables; for port 465 also export `SMTP_SECURE=true`.

Change one route's email address in the UI to your authorized inbox, leaving its routing rule intact, then send a matching message. Check your inbox, spam folder and Mailgun sending logs. The default `example.com` destinations will not deliver real email.

The app sends to any address selected from the saved routes and reports an SMTP rejection as a delivery warning while keeping the selected route highlighted. Mailgun sandbox still restricts delivery to its verified recipients. Use a verified custom sending domain for delivery beyond sandbox recipients.

References: [Mailgun sandbox](https://documentation.mailgun.com/docs/mailgun/user-manual/domains/domains-sandbox), [Cloud Run secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets).

## Cost and idle behavior

The GPU service uses L4 without zonal redundancy, 4 vCPU/16 GiB for Ollama and 1 vCPU/512 MiB for the gateway. Instance-based billing charges startup, processing and idle time before shutdown. Scale-to-zero is automatic, not immediate after each message. Maximum instances is 1 per revision; temporary overlap can happen during deployments. This is not a hard spending cap.

Artifact Registry images and the rules bucket have small ongoing storage charges even when services are at zero. No scheduler or health probe calls the GPU service. Do not add uptime monitoring to its URL if you want it to sleep.

## Stop the demo

```bash
gcloud run services delete email-router email-router-gpu --region="$REGION" --project="$PROJECT_ID"
```

This leaves the rules bucket and image repository intact. Delete those separately only if you no longer need their data.

## Validation status

TypeScript, lint, unit tests and a local Next.js production build can be checked without GCP. A real GPU deployment, cold-start timing, IAM invocation and scale-to-zero must be verified in your project. No GCP resources have been provisioned by preparing these files.
