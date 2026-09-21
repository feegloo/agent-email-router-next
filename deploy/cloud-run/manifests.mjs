const { ACCOUNT, REGISTRY, TAG, BUCKET, OLLAMA_URL, SMTP_HOST, SMTP_USER, EMAIL_FROM, EMAIL_ALLOWED_RECIPIENTS, SMTP_PASSWORD_SECRET, SMTP_PASSWORD_VERSION } = process.env;
const gpu = process.argv[2] === 'gpu';
for (const [name, value] of Object.entries({ ACCOUNT, REGISTRY, TAG, ...(gpu ? {} : { BUCKET, OLLAMA_URL, SMTP_HOST, SMTP_USER, EMAIL_FROM, EMAIL_ALLOWED_RECIPIENTS, SMTP_PASSWORD_SECRET, SMTP_PASSWORD_VERSION }) })) {
  if (!value) throw new Error(`Missing ${name}`);
}
const env = values => Object.entries(values).map(([name, value]) => ({ name, value }));
const tcp = port => ({ tcpSocket: { port }, periodSeconds: 5, timeoutSeconds: 2, failureThreshold: 48 });
const containers = gpu ? [
  { name: 'gateway', image: `${REGISTRY}/gateway:${TAG}`, ports: [{ containerPort: 8080 }], resources: { limits: { cpu: '1', memory: '512Mi' } }, startupProbe: tcp(8080), volumeMounts: [{ name: 'logs', mountPath: '/var/log/ollama' }] },
  { name: 'ollama', image: `${REGISTRY}/ollama:${TAG}`, resources: { limits: { cpu: '4', memory: '16Gi', 'nvidia.com/gpu': '1' } }, env: env({ OLLAMA_HOST: '0.0.0.0:11434', OLLAMA_KEEP_ALIVE: '-1' }), startupProbe: tcp(11434), volumeMounts: [{ name: 'logs', mountPath: '/var/log/ollama' }] },
] : [
  { name: 'app', image: `${REGISTRY}/app:${TAG}`, ports: [{ containerPort: 3000 }], resources: { limits: { cpu: '1', memory: '512Mi' } }, startupProbe: tcp(3000), env: [...env({ OLLAMA_BASE_URL: OLLAMA_URL, OLLAMA_CLOUD_RUN_AUDIENCE: OLLAMA_URL, OLLAMA_MODEL: 'qwen3.5:0.8b', ROUTES_GCS_BUCKET: BUCKET, SMTP_HOST, SMTP_PORT: process.env.SMTP_PORT || '587', SMTP_USER, SMTP_SECURE: process.env.SMTP_SECURE || 'false', SMTP_REQUIRE_TLS: 'true', EMAIL_FROM, EMAIL_ALLOWED_RECIPIENTS }), { name: 'SMTP_PASSWORD', valueFrom: { secretKeyRef: { name: SMTP_PASSWORD_SECRET, key: SMTP_PASSWORD_VERSION } } }] },
];
console.log(JSON.stringify({ apiVersion: 'serving.knative.dev/v1', kind: 'Service', metadata: { name: gpu ? 'email-router-gpu' : 'email-router' }, spec: { template: {
  metadata: { annotations: {
    'autoscaling.knative.dev/minScale': '0', 'autoscaling.knative.dev/maxScale': '1',
    'run.googleapis.com/execution-environment': 'gen2',
    ...(gpu ? { 'run.googleapis.com/container-dependencies': JSON.stringify({ gateway: ['ollama'] }) } : {}),
    ...(gpu ? { 'run.googleapis.com/cpu-throttling': 'false', 'run.googleapis.com/gpu-zonal-redundancy-disabled': 'true' } : {}),
  } },
  spec: { serviceAccountName: ACCOUNT, timeoutSeconds: 660, containerConcurrency: gpu ? 8 : 20, containers,
    ...(gpu ? { nodeSelector: { 'run.googleapis.com/accelerator': 'nvidia-l4' }, volumes: [{ name: 'logs', emptyDir: { medium: 'Memory', sizeLimit: '64Mi' } }] } : {}),
  },
} } }, null, 2));
