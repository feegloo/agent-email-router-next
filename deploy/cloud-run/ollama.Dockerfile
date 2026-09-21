FROM ollama/ollama:0.32.2
ENV OLLAMA_MODEL=qwen3.5:0.8b
# Download at build time, not on every cold start.
RUN ollama serve >/tmp/ollama-build.log 2>&1 & \
    server_pid=$!; \
    until ollama list >/dev/null 2>&1; do sleep 1; done; \
    ollama pull qwen3.5:0.8b; result=$?; kill "$server_pid"; exit "$result"
COPY docker/ollama-entrypoint.sh /opt/ollama-entrypoint.sh
ENTRYPOINT ["/bin/sh", "/opt/ollama-entrypoint.sh"]
