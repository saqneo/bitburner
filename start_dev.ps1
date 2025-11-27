Write-Host "Starting Bitburner Development Environment..." -ForegroundColor Cyan

# Check for node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Start the sync
Write-Host "Starting File Watcher..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
npm run start
