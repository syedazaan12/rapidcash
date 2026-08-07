# package-deployment.ps1
# This script packages the RapidCash project into a .zip file for deployment to Hostinger.

$ZipPath = Join-Path $PSScriptRoot "rapidcash-deploy.zip"
$StagingPath = Join-Path $PSScriptRoot "deploy_staging"

# Clean up existing files
if (Test-Path $ZipPath) {
    Remove-Item $ZipPath -Force
}
if (Test-Path $StagingPath) {
    Remove-Item $StagingPath -Recurse -Force
}

Write-Host "Creating deployment staging directory..."
New-Item -ItemType Directory -Path $StagingPath | Out-Null

# Create directories in staging
New-Item -ItemType Directory -Path (Join-Path $StagingPath "backend") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $StagingPath "frontend") | Out-Null

Write-Host "Copying project files..."
# Copy backend files excluding node_modules, data, secure_uploads, and .env
Get-ChildItem -Path (Join-Path $PSScriptRoot "backend") | Where-Object { 
    $_.Name -ne "node_modules" -and 
    $_.Name -ne "data" -and 
    $_.Name -ne "secure_uploads" -and 
    $_.Name -ne ".env"
} | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination (Join-Path $StagingPath "backend") -Recurse -Force
}

# Copy frontend files
Copy-Item -Path (Join-Path $PSScriptRoot "frontend") -Destination $StagingPath -Recurse -Force

# Copy root package.json
Copy-Item -Path (Join-Path $PSScriptRoot "package.json") -Destination $StagingPath -Force

# Compress to zip
Write-Host "Compressing to rapidcash-deploy.zip..."
Compress-Archive -Path (Join-Path $StagingPath "*") -DestinationPath $ZipPath

# Clean up staging
Write-Host "Cleaning up staging directory..."
Remove-Item $StagingPath -Recurse -Force

Write-Host "Successfully created rapidcash-deploy.zip!" -ForegroundColor Green
