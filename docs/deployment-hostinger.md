# Hostinger Deployment Guide

**Specs:** KVM 4 (4 vCPU, 16 GB RAM, 200 GB Disk)
**OS:** Ubuntu 24.04 LTS
**Stack:** Docker Compose

**Setup Steps:**

1. Secure SSH and configure UFW firewall (allow 80/443).
2. Install Docker and Docker Compose v2.
3. Deploy application stack via Compose.
4. Mount persistent volumes for PostgreSQL, Valkey, and Local HLS storage.
5. Monitor disk utilization (Alerts at 65%, page at 75%).
