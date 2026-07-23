$ErrorActionPreference = "Stop"

$env:DATABASE_URL="postgresql://academy:academy_secret@127.0.0.1:5432/bahrawy_db"
Write-Host "Running pnpm install --frozen-lockfile..."
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Running pnpm format:check..."
pnpm format:check
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Running pnpm lint..."
pnpm lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Running prisma generate..."
pnpm --filter @bahrawy/db generate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Running pnpm typecheck..."
pnpm typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Running pnpm test..."
pnpm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Running pnpm build..."
pnpm build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Running docker compose config..."
docker compose config -q
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "All checks passed! Working tree intentionally untouched."
