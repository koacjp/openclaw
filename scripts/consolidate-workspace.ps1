#Requires -Version 5.1
<#
.SYNOPSIS
  Merge workspace bootstrap files (USER.md, AGENTS.md, etc.) from multiple locations
  into a single workspace root, keeping the newer file. Merge skills into <workspace>/skills.

.DESCRIPTION
  Compares:
  - $env:USERPROFILE\.openclaw\workspace\
  - <repo>\.openclaw\workspace\
  - -WorkspaceRoot (destination)
  For each bootstrap file, copies the newest (by LastWriteTime) to -WorkspaceRoot.
  Copies .openclaw\skills\* to <WorkspaceRoot>\skills\ (newer wins per SKILL.md).

.PARAMETER WorkspaceRoot
  Target workspace root (e.g. C:\Users\user\OneDrive\openclaw). Bootstrap files
  and skills will be placed here.

.PARAMETER RepoRoot
  Repo root containing .openclaw\workspace and .openclaw\skills. Defaults to
  script dir parent.

.PARAMETER WhatIf
  Only report what would be done; do not copy.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory, Position = 0)]
    [string] $WorkspaceRoot,

    [string] $RepoRoot = (Split-Path -Parent $PSScriptRoot),

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $Rest
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$homeWs = Join-Path $env:USERPROFILE ".openclaw" "workspace"
$repoWs = Join-Path $RepoRoot ".openclaw" "workspace"
$repoSkills = Join-Path $RepoRoot ".openclaw" "skills"
$destSkills = Join-Path $WorkspaceRoot "skills"

$bootstrapNames = @("USER.md", "AGENTS.md", "SOUL.md", "TOOLS.md", "HEARTBEAT.md", "IDENTITY.md", "BOOTSTRAP.md")
$sources = @(
    @{ Label = "home"; Path = $homeWs },
    @{ Label = "repo .openclaw"; Path = $repoWs },
    @{ Label = "current workspace"; Path = $WorkspaceRoot }
)

function Get-NewestFile {
    param([string[]] $Names, [string[]] $BasePaths)
    foreach ($name in $Names) {
        $best = $null
        foreach ($base in $BasePaths) {
            $full = Join-Path $base $name
            if (Test-Path -LiteralPath $full -PathType Leaf) {
                $f = Get-Item -LiteralPath $full
                if ($null -eq $best -or $f.LastWriteTimeUtc -gt $best.LastWriteTimeUtc) {
                    $best = $f
                }
            }
        }
        if ($best) { $best }
    }
}

Write-Host "Workspace root (destination): $WorkspaceRoot"
Write-Host "Bootstrap sources: $homeWs | $repoWs | $WorkspaceRoot"
Write-Host ""

# Ensure destination exists
if (-not $WhatIfPreference) {
    New-Item -ItemType Directory -Path $WorkspaceRoot -Force | Out-Null
}

# Bootstrap files: pick newest; if destination already exists and is not the newest, rename it to *_B.md then copy newest
foreach ($name in $bootstrapNames) {
    $candidates = @($homeWs, $repoWs, $WorkspaceRoot) | ForEach-Object { Join-Path $_ $name } | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf }
    if ($candidates.Count -eq 0) { continue }
    $sorted = $candidates | Sort-Object { (Get-Item -LiteralPath $_).LastWriteTimeUtc } -Descending
    $newest = $sorted[0]
    $dest = Join-Path $WorkspaceRoot $name
    if (Test-Path -LiteralPath $dest -PathType Leaf) {
        $destItem = Get-Item -LiteralPath $dest
        if ($destItem.FullName -ne (Resolve-Path -LiteralPath $newest).Path) {
            $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
            $ext = [System.IO.Path]::GetExtension($name)
            $backupName = "${base}_B$ext"
            $backupPath = Join-Path $WorkspaceRoot $backupName
            if ($PSCmdlet.ShouldProcess($backupPath, "Rename duplicate to $backupName for manual merge")) {
                Move-Item -LiteralPath $dest -Destination $backupPath -Force
            }
            Write-Host "  [bootstrap] $name -> $backupName (duplicate; compare manually)"
        }
    }
    if ($newest -ne $dest) {
        if ($PSCmdlet.ShouldProcess($dest, "Copy newest bootstrap: $name")) {
            Copy-Item -LiteralPath $newest -Destination $dest -Force
        }
        Write-Host "  [bootstrap] $name <- $newest"
    }
}

# memory/ folder: for each relative path, copy newest file to workspace memory/
$destMemory = Join-Path $WorkspaceRoot "memory"
$memoryByRel = @{}
foreach ($base in @($homeWs, $repoWs, $WorkspaceRoot)) {
    $memDir = Join-Path $base "memory"
    if (-not (Test-Path -LiteralPath $memDir -PathType Container)) { continue }
    Get-ChildItem -Path $memDir -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        $rel = $_.FullName.Substring($memDir.Length).TrimStart("\", "/")
        if (-not $memoryByRel[$rel] -or $_.LastWriteTimeUtc -gt $memoryByRel[$rel].LastWriteTimeUtc) {
            $memoryByRel[$rel] = $_
        }
    }
}
foreach ($rel in $memoryByRel.Keys) {
    $src = $memoryByRel[$rel]
    $target = Join-Path $destMemory $rel
    if ($src.FullName -eq $target) { continue }
    if (-not $WhatIfPreferencePreference) { New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null }
    if ($PSCmdlet.ShouldProcess($target, "Copy memory file")) {
        Copy-Item -LiteralPath $src.FullName -Destination $target -Force
    }
    Write-Host "  [memory] $rel"
}

# Skills: merge .openclaw/skills into <workspace>/skills (newer SKILL.md wins per skill dir)
if (Test-Path -LiteralPath $repoSkills -PathType Container) {
    if (-not $WhatIfPreferencePreference) { New-Item -ItemType Directory -Path $destSkills -Force | Out-Null }
    $skillDirs = Get-ChildItem -Path $repoSkills -Directory -ErrorAction SilentlyContinue
    foreach ($d in $skillDirs) {
        $skillMd = Join-Path $d.FullName "SKILL.md"
        if (-not (Test-Path -LiteralPath $skillMd -PathType Leaf)) { continue }
        $destDir = Join-Path $destSkills $d.Name
        $destSkillMd = Join-Path $destDir "SKILL.md"
        $copy = $false
        if (-not (Test-Path -LiteralPath $destSkillMd -PathType Leaf)) {
            $copy = $true
        } else {
            $destTime = (Get-Item -LiteralPath $destSkillMd).LastWriteTimeUtc
            if ((Get-Item -LiteralPath $skillMd).LastWriteTimeUtc -gt $destTime) { $copy = $true }
        }
        if ($copy) {
            if ($PSCmdlet.ShouldProcess($destDir, "Copy/update skill: $($d.Name)")) {
                if (-not (Test-Path -LiteralPath $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
                Copy-Item -LiteralPath $skillMd -Destination $destSkillMd -Force
                Get-ChildItem -Path $d.FullName -File | Where-Object { $_.Name -ne "SKILL.md" } | ForEach-Object {
                    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $destDir $_.Name) -Force -ErrorAction SilentlyContinue
                }
            }
            Write-Host "  [skill] $($d.Name)"
        }
    }
}

Write-Host ""
Write-Host "Done. Set agents.defaults.workspace to: $WorkspaceRoot"
Write-Host "Config: use a single ~/.openclaw/openclaw.json (see docs/reference/workspace-consolidate.md)."
