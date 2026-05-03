# ── Stage 1: Build React frontend ───────────────────────────────────────────
FROM node:20-slim AS frontend-build

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build Go binary ─────────────────────────────────────────────────
FROM golang:1.25-bookworm AS go-build

# libopus + opusfile required by hraban/opus (CGo)
RUN apt-get update && apt-get install -y \
    libopus-dev \
    libopusfile-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

COPY go-server/go.mod go-server/go.sum ./
RUN go mod download

COPY go-server/ ./
RUN CGO_ENABLED=1 go build -o /voice-agent-server .

# ── Stage 3: Runtime image ───────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    libopus0 \
    libopusfile0 \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=go-build /voice-agent-server ./
COPY --from=frontend-build /frontend/dist ./frontend/dist
COPY settings.json ./

EXPOSE 8080

CMD ["./voice-agent-server"]
