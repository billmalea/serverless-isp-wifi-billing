#!/usr/bin/env pwsh
# Deploy frontend to S3 with auto-generated config

param(
    [Parameter(Mandatory=$false)]
    [string]$StackName = "wifi-billing-system",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "us-east-1"
)

Write-Host "🚀 Deploying frontend..." -ForegroundColor Cyan

# Get API Gateway URL from CloudFormation stack
Write-Host "Fetching API URL from stack..." -ForegroundColor Yellow
$apiUrl = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' `
    --output text

if (-not $apiUrl) {
    Write-Host "❌ Failed to get API URL from stack" -ForegroundColor Red
    exit 1
}

# Get S3 bucket name
Write-Host "Fetching S3 bucket name..." -ForegroundColor Yellow
$bucketName = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query 'Stacks[0].Outputs[?OutputKey==`PortalBucketName`].OutputValue' `
    --output text

if (-not $bucketName) {
    Write-Host "❌ Failed to get bucket name from stack" -ForegroundColor Red
    exit 1
}

Write-Host "API URL: $apiUrl" -ForegroundColor Green
Write-Host "Bucket: $bucketName" -ForegroundColor Green

# Generate config.js from template
Write-Host "`nGenerating config.js..." -ForegroundColor Yellow
$template = Get-Content "frontend/config.template.js" -Raw
$config = $template -replace '{{API_GATEWAY_URL}}', $apiUrl
$config = $config -replace '{{ENVIRONMENT}}', 'dev'
$config | Out-File -FilePath "frontend/config.js" -Encoding UTF8 -NoNewline

# Upload to S3
Write-Host "Uploading files to S3..." -ForegroundColor Yellow
aws s3 sync frontend/ "s3://$bucketName/" `
    --region $Region `
    --exclude "config.template.js" `
    --exclude "*.md"

if ($LASTEXITCODE -eq 0) {
    $portalUrl = aws cloudformation describe-stacks `
        --stack-name $StackName `
        --region $Region `
        --query 'Stacks[0].Outputs[?OutputKey==`PortalBucketUrl`].OutputValue' `
        --output text
    
    Write-Host "`n✅ Frontend deployed successfully!" -ForegroundColor Green
    Write-Host "Portal URL: $portalUrl" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Deployment failed" -ForegroundColor Red
    exit 1
}
