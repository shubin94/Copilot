# Git Safe Push Script
# This script always pulls with rebase before pushing to prevent conflicts
# Usage: .\git-safe-push.ps1 [branch-name]
# If no branch name provided, uses current branch

param(
    [string]$Branch = ""
)

# Color output functions
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Failure { param($msg) Write-Host $msg -ForegroundColor Red }

# Get current branch if not specified
if ([string]::IsNullOrEmpty($Branch)) {
    $Branch = git branch --show-current
    if ($LASTEXITCODE -ne 0) {
        Write-Failure "❌ Failed to get current branch"
        exit 1
    }
}

Write-Info "🔄 Safe Push Process for branch: $Branch"
Write-Info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Check for uncommitted changes
Write-Info "📋 Step 1: Checking for uncommitted changes..."
$status = git status --porcelain
if ($status) {
    Write-Warning "⚠️  You have uncommitted changes:"
    git status --short
    $response = Read-Host "Do you want to commit them first? (y/n)"
    if ($response -eq 'y') {
        $message = Read-Host "Enter commit message"
        git add .
        git commit -m $message
        if ($LASTEXITCODE -ne 0) {
            Write-Failure "❌ Commit failed"
            exit 1
        }
        Write-Success "✅ Changes committed"
    } else {
        Write-Warning "⚠️  Continuing with uncommitted changes (they will be stashed if needed)"
    }
}

# Step 2: Fetch latest changes
Write-Info "`n📥 Step 2: Fetching latest changes from remote..."
git fetch origin $Branch
if ($LASTEXITCODE -ne 0) {
    Write-Failure "❌ Fetch failed"
    exit 1
}
Write-Success "✅ Fetch completed"

# Step 3: Check if remote is ahead
Write-Info "`n🔍 Step 3: Checking if remote has new changes..."
$ahead = git rev-list --count HEAD..origin/$Branch 2>$null
$behind = git rev-list --count origin/$Branch..HEAD 2>$null

if ($ahead -eq "0" -and $behind -eq "0") {
    Write-Success "✅ Already up to date with remote"
} elseif ($ahead -gt 0 -and $behind -eq "0") {
    Write-Info "📥 Remote is ahead by $ahead commit(s). Pulling with rebase..."
    git pull --rebase origin $Branch
    if ($LASTEXITCODE -ne 0) {
        Write-Failure "❌ Rebase failed. Resolve conflicts and run: git rebase --continue"
        exit 1
    }
    Write-Success "✅ Rebased successfully"
} elseif ($ahead -eq "0" -and $behind -gt 0) {
    Write-Info "📤 Local is ahead by $behind commit(s). Ready to push."
} else {
    Write-Warning "⚠️  Branches have diverged! Local: +$behind, Remote: +$ahead"
    Write-Info "🔄 Pulling with rebase to synchronize..."
    git pull --rebase origin $Branch
    if ($LASTEXITCODE -ne 0) {
        Write-Failure "❌ Rebase failed. Resolve conflicts and run: git rebase --continue"
        exit 1
    }
    Write-Success "✅ Rebased successfully"
}

# Step 4: Push to remote
Write-Info "`n📤 Step 4: Pushing to remote..."
git push origin $Branch
if ($LASTEXITCODE -ne 0) {
    Write-Failure "❌ Push failed"
    exit 1
}

Write-Success "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Success "✅ Successfully pushed to origin/$Branch"
Write-Success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
