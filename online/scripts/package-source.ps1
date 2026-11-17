#requires -Version 7.0
param([string]$OutputPath='')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
if(-not $OutputPath){$OutputPath=Join-Path $projectRoot 'delivery/growth-tavern-v7-source_20261117.zip'}
$archivePath=[IO.Path]::GetFullPath($OutputPath)
if(-not $archivePath.StartsWith($projectRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Archive must stay inside this project'}
if(Test-Path -LiteralPath $archivePath){throw 'Archive exists; use a new output filename'}
$files=[Collections.Generic.List[IO.FileInfo]]::new()
foreach($directory in @('public','server','worker','drizzle','tests','scripts')){
 foreach($file in Get-ChildItem -LiteralPath (Join-Path $projectRoot $directory) -Recurse -File){
  if($file.FullName -eq (Join-Path $projectRoot 'worker/assets.js')){continue}
  $files.Add($file)
 }
}
foreach($file in Get-ChildItem -LiteralPath (Join-Path $projectRoot 'docs') -File){$files.Add($file)}
foreach($name in @('README.md','package.json','package-lock.json','.gitignore','.env.example','.openai/hosting.json','明天课堂_开局与排障.txt','课堂PK操作指南_2026-11-17.txt')){
 $files.Add((Get-Item -LiteralPath (Join-Path $projectRoot $name)))
}
$evidence=@('classroom-deployment-v7.json','etag-public-v7.json','god-live-run-summary.json','figma-v6-manifest.json','v6-built-worker-smoke.json','v6-browser-verification-summary.json','v6-browser-verification-summary.md','multiplayer-local-v6.json','multiplayer-local-v6.md','CLASSROOM_ONLINE_V6_INDEPENDENT_AUDIT.md','V6_GOD_RUNTIME_INDEPENDENT_REVIEW.md','god-live-targeted-human-review.md','交付公网复测摘要.json')
foreach($name in $evidence){$candidate=Join-Path $projectRoot ('docs/evidence/'+$name);if(Test-Path -LiteralPath $candidate){$files.Add((Get-Item -LiteralPath $candidate))}}
$manifest=[Collections.Generic.List[object]]::new()
$secretNeedle=[string]$env:DEEPSEEK_API_KEY
foreach($file in $files){
 if(-not $file.FullName.StartsWith($projectRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Source file outside project'}
 if($file.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Source archive requires ordinary files'}
 $relative=[IO.Path]::GetRelativePath($projectRoot,$file.FullName).Replace('\','/')
 if($relative -match '(^|/)(data|node_modules|\.git|dist)(/|$)' -or ($relative -match '(^|/)\.env' -and $relative -ne '.env.example')){throw 'Excluded runtime path selected'}
 $bytes=[IO.File]::ReadAllBytes($file.FullName)
 if($secretNeedle.Length -gt 12 -and [Text.Encoding]::UTF8.GetString($bytes).Contains($secretNeedle)){throw 'Provider secret found; refusing source archive'}
 $manifest.Add([ordered]@{path=$relative;bytes=$bytes.Length;sha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()})
}
$delivery=[ordered]@{createdAt=[DateTime]::UtcNow.ToString('o');site='https://growth-tavern-suli-demo.zheiisu.chatgpt.site/#/tavern';siteVersion=7;siteSource='c1aeaff6f3a38b6473e19244f55087db190e6ecc';sourceBranch='codex/tavern-v6-20261117';note='Runtime source matches hosting version7; includes later QA and classroom guide. No keys, room data, dependencies or generated bundle.';providerSecretCheck=if($secretNeedle.Length -gt 12){'actual configured key checked, zero matches'}else{'no key needle supplied; path exclusions checked'};files=$manifest}
[void][IO.Directory]::CreateDirectory((Split-Path -Parent $archivePath))
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream=[IO.File]::Open($archivePath,[IO.FileMode]::CreateNew)
$zip=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create,$false,[Text.Encoding]::UTF8)
try{
 foreach($row in $manifest){[void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $projectRoot $row.path),('growth-tavern-v7/'+$row.path),[IO.Compression.CompressionLevel]::Optimal)}
 $entry=$zip.CreateEntry('growth-tavern-v7/SOURCE_MANIFEST.json');$writer=[IO.StreamWriter]::new($entry.Open(),[Text.UTF8Encoding]::new($false));try{$writer.Write(($delivery|ConvertTo-Json -Depth 8))}finally{$writer.Dispose()}
}finally{$zip.Dispose();$stream.Dispose()}
$read=[IO.Compression.ZipFile]::OpenRead($archivePath)
try{if($read.Entries.Count -ne $manifest.Count+1){throw 'Archive entry count mismatch'}}finally{$read.Dispose()}
$hash=(Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText($archivePath+'.manifest.json',($delivery|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
@{archive=$archivePath;files=$manifest.Count;bytes=(Get-Item -LiteralPath $archivePath).Length;sha256=$hash;secretCheck=$delivery.providerSecretCheck}|ConvertTo-Json -Compress
