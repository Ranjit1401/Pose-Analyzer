# fix_env.ps1
# ─── Run this ONCE to fix the Windows long-path issue and reinstall deps ──────
# Usage: .\fix_env.ps1
# Run as Administrator OR ensure venv is in a short path.

Write-Host ">>> Step 1: Enabling Windows Long Path support..." -ForegroundColor Cyan
try {
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
        -Name "LongPathsEnabled" -Value 1 -Type DWord -ErrorAction Stop
    Write-Host "Long paths enabled in registry." -ForegroundColor Green
} catch {
    Write-Host "WARNING: Could not set registry (run as Administrator to fix this)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host ">>> Step 2: Upgrading pip, setuptools, wheel..." -ForegroundColor Cyan
python -m pip install --upgrade pip setuptools wheel

Write-Host ""
Write-Host ">>> Step 3: Installing minimal requirements (no tensorflow/jupyter)..." -ForegroundColor Cyan
pip install -r requirements_minimal.txt

Write-Host ""
Write-Host ">>> Done! Start the backend with:" -ForegroundColor Green
Write-Host "    uvicorn main:app --reload" -ForegroundColor White
