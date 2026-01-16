# Git Sync Check Script
# يتحقق من وجود تحديثات على GitHub قبل البدء بالعمل

Write-Host "🔍 التحقق من التحديثات على GitHub..." -ForegroundColor Cyan

# Fetch latest changes
git fetch origin main 2>&1 | Out-Null

# Get local and remote commit hashes
$localCommit = git rev-parse HEAD
$remoteCommit = git rev-parse origin/main

# Check if there are updates
if ($localCommit -ne $remoteCommit) {
    Write-Host "⚠️  يوجد تحديثات جديدة على GitHub!" -ForegroundColor Yellow
    Write-Host ""
    
    # Show commits ahead
    $commitsAhead = git rev-list --count HEAD..origin/main
    Write-Host "📥 يوجد $commitsAhead commit جديد على GitHub" -ForegroundColor Yellow
    Write-Host ""
    
    # Show last 5 commits
    Write-Host "آخر التعديلات:" -ForegroundColor Cyan
    git log --oneline HEAD..origin/main -5
    Write-Host ""
    
    Write-Host "💡 نصيحة: قم بسحب التحديثات أولاً:" -ForegroundColor Green
    Write-Host "   git pull origin main" -ForegroundColor White
    Write-Host ""
    
    exit 1
} else {
    Write-Host "✅ النسخة المحلية محدثة مع GitHub" -ForegroundColor Green
    Write-Host ""
    exit 0
}
