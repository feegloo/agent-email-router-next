# Cloud Run demo deployment

Two Cloud Run services, both with minimum instances 0:

- `email-router`: public Next.js UI on CPU, with a MailHog sidecar. Opening the UI and editing rules do not wake the GPU.
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

Logs show actual Ollama stdout/stderr, not model answer tokens. The gateway exposes only `/api/chat`, `/logs`, and `/health`; Cloud Run IAM protects the service. The SSE stream also has a finite lifetime in case a browser disconnect is not propagated.

## Email behavior

MailHog captures messages inside the CPU service. **No email is delivered externally.** Captured messages are ephemeral and disappear when that instance stops; routing rules persist independently in Cloud Storage. The MailHog web UI is not exposed by this deployment. Real SMTP delivery and persistent mailbox viewing are separate follow-up work.

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
