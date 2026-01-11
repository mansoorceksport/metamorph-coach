# Deployment Guide: Version Tracking with Docker

## Quick Start

### Option 1: Manual Build with Version
```bash
# Build with explicit version
docker build --build-arg APP_VERSION=1.2.0 -t metamorph-frontend .

# Or use git tag/commit as version
docker build --build-arg APP_VERSION=$(git describe --tags --always) -t metamorph-frontend .
```

### Option 2: docker-compose (Production)
Add to your `docker-compose.prod.yaml`:
```yaml
services:
  frontend:
    build:
      context: ../nuxt/metamorph-coach
      dockerfile: Dockerfile
      args:
        APP_VERSION: "1.2.0"  # Update on each deploy
```

Then build:
```bash
docker compose -f docker-compose.prod.yaml build frontend
docker compose -f docker-compose.prod.yaml up -d frontend
```

---

## Version Strategy

### Semantic Versioning (Recommended)
```
MAJOR.MINOR.PATCH
1.0.0 → 1.0.1 (bug fix)
1.0.1 → 1.1.0 (new feature)
1.1.0 → 2.0.0 (breaking change)
```

### Using Git Tags
```bash
# Tag a release
git tag v1.2.0
git push origin v1.2.0

# Build with tag
docker build --build-arg APP_VERSION=v1.2.0 -t metamorph-frontend .
```

---

## Verify Version in Sentry

After deploying, check Sentry dashboard:
1. Go to **Releases** in sidebar
2. You should see `metamorph-coach@1.2.0`
3. Errors will be tagged with this release

---

## Deploy Workflow (No CI/CD)

```bash
# 1. Update version (optional: edit package.json)
VERSION="1.2.0"

# 2. SSH to server
ssh mansoor@ceksport

# 3. Navigate to project
cd /home/mansoor/work/metamorph.cek-sport.com

# 4. Pull latest code
git pull

# 5. Build with version
docker compose build frontend --build-arg APP_VERSION=$VERSION

# 6. Deploy
docker compose up -d frontend

# 7. Verify
docker logs metamorph-frontend-1 --tail 20
```
