# Deploy script for Windows PowerShell
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'dev',
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,
    
    [Parameter(Mandatory=$false)]
    [switch]$UploadFrontend
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying WiFi Billing System to $Environment..." -ForegroundColor Cyan

# Check if SAM CLI is installed
try {
    $samVersion = sam --version
    Write-Host "✓ SAM CLI version: $samVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS SAM CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "Install: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
}

# Check if AWS CLI is configured
try {
    $awsIdentity = aws sts get-caller-identity --query "Account" --output text
    Write-Host "✓ AWS Account: $awsIdentity" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI not configured. Run 'aws configure' first." -ForegroundColor Red
    exit 1
}

# Build TypeScript
if (-not $SkipBuild) {
    Write-Host "`n📦 Building TypeScript..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ TypeScript build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Build successful" -ForegroundColor Green
}

# Validate SAM template
Write-Host "`n🔍 Validating SAM template..." -ForegroundColor Yellow
sam validate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Template validation failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Template is valid" -ForegroundColor Green

# Build SAM application
Write-Host "`n🔨 Building SAM application..." -ForegroundColor Yellow
sam build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SAM build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ SAM build successful" -ForegroundColor Green

# Deploy
Write-Host "`n🚀 Deploying to AWS..." -ForegroundColor Yellow
sam deploy --config-env $Environment
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n✓ Deployment successful!" -ForegroundColor Green

# Get stack outputs
$stackName = "wifi-billing-$Environment"
Write-Host "`n📋 Stack Outputs:" -ForegroundColor Cyan

$apiUrl = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" --output text
$portalBucket = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='PortalBucketName'].OutputValue" --output text
$portalUrl = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='PortalBucketUrl'].OutputValue" --output text

Write-Host "API Gateway URL: $apiUrl" -ForegroundColor White
Write-Host "Portal Bucket: $portalBucket" -ForegroundColor White
Write-Host "Portal URL: $portalUrl" -ForegroundColor White

# Upload frontend if requested
if ($UploadFrontend) {
    Write-Host "`n📤 Uploading frontend to S3..." -ForegroundColor Yellow
    
    # Update API URL in frontend
    $frontendJs = Get-Content "frontend/app.js" -Raw
    $frontendJs = $frontendJs -replace "const API_BASE_URL = '[^']*'", "const API_BASE_URL = '$apiUrl'"
    $frontendJs | Set-Content "frontend/app.js"
    
    # Sync to S3
    aws s3 sync frontend/ "s3://$portalBucket/" --exclude "*.md" --cache-control "max-age=31536000"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Frontend uploaded successfully" -ForegroundColor Green
        Write-Host "`nCaptive Portal URL: $portalUrl" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Frontend upload failed" -ForegroundColor Red
    }
}

Write-Host "`n✅ Deployment Complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Update frontend/app.js with API URL: $apiUrl"
Write-Host "2. Upload frontend: npm run sam:deploy -- -UploadFrontend"
Write-Host "3. Configure your hotspot gateway"
Write-Host "4. Test with M-Pesa sandbox"
Write-Host "`nView logs: sam logs -n AuthFunction --stack-name $stackName --tail"
