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
