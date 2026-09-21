#!/bin/sh
set -eu

# Duplicate the actual process output, not model response tokens.
# Reset on container startup; Docker still receives the same stdout/stderr.
mkdir -p /var/log/ollama
mkfifo /var/log/ollama/output.pipe 2>/dev/null || true
tee /var/log/ollama/server.log < /var/log/ollama/output.pipe &
tee_pid=$!
ollama serve > /var/log/ollama/output.pipe 2>&1 &
ollama_pid=$!
trap 'kill -TERM "$ollama_pid" 2>/dev/null || true' TERM INT
set +e
wait "$ollama_pid"
result=$?
kill -TERM "$tee_pid" 2>/dev/null || true
wait "$tee_pid" 2>/dev/null
exit "$result"
