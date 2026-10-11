$ErrorActionPreference = 'Stop'

# Deploy TWINKLE Studio's already-tested static dist/ folder to the existing
# Cloudflare Pages project. Uses a locally authenticated Wrangler session.
# Does not create a new Pages project or alter database/security settings.

$ProjectName = 'video-music'
$DistPath = Join-Path $PSScriptRoot 'dist'

if (-not (Test-Path (Join-Path $DistPath 'index.html'))) {
    throw "Built dist/index.html not found at $DistPath. Run npm test and npm run build first."
}

Write-Host 'Checking Node.js and npm...' -ForegroundColor Cyan
node --version
npm --version

Write-Host 'Checking Cloudflare Wrangler authentication...' -ForegroundColor Cyan
npx --yes wrangler whoami
if ($LASTEXITCODE -ne 0) {
    throw 'Cloudflare authentication is missing. Run: npx wrangler login, then rerun this script.'
}

Write-Host "Deploying $DistPath to the existing Pages project '$ProjectName'..." -ForegroundColor Cyan
npx --yes wrangler pages deploy $DistPath --project-name $ProjectName --branch main
if ($LASTEXITCODE -ne 0) {
    throw 'Cloudflare deployment command failed. Review the Wrangler error output before retrying.'
}

Write-Host 'Deployment command completed. Verifying the live URL...' -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri 'https://video-music.pages.dev/' -Method Get -TimeoutSec 30
    Write-Host ("Live HTTP status: {0}" -f [int]$response.StatusCode) -ForegroundColor Green
} catch {
    Write-Warning "The deploy command returned success but the live URL check failed: $($_.Exception.Message)"
    throw
}
