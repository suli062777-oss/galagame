#requires -Version 7.0
<#
Explicit post-deployment verification. Does not deploy or read provider keys.
  pwsh -NoProfile -File scripts/qa-classroom-v6-online.ps1 -BaseUrl https://PUBLIC-HOST
Uses Invoke-WebRequest's real default PowerShell User-Agent. No WAF bypass,
browser impersonation, direct provider calls, clock override or /advance.
#>
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$BaseUrl,[switch]$NoNetworkSelfTest)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$script:EvidencePath=Join-Path (Split-Path -Parent $PSScriptRoot) 'docs/evidence/classroom-online-v7.json'
$script:ExecutionClock=[Diagnostics.Stopwatch]::StartNew()
$script:MaximumMs=720000;$script:PollIntervalMs=1500;$script:BaseOriginUrl=''
$script:Secrets=[Collections.Generic.HashSet[string]]::new()
$script:Tables=[Collections.Generic.List[object]]::new()
$script:RequestMetrics=[Collections.Generic.List[object]]::new()
$script:CredentialSessions=[Collections.Generic.Dictionary[string,Microsoft.PowerShell.Commands.WebRequestSession]]::new()
$script:Evidence=[ordered]@{
 version=7;runId=[Guid]::NewGuid().ToString();startedAt=[DateTime]::UtcNow.ToString('o');status='running'
 transport='PowerShell 7 Invoke-WebRequest native default User-Agent; persistent native WebRequestSession per credential; ForEach-Object -Parallel throttle 8'
 clientDifference='Previous V6 used fresh implicit request sessions; V7 retains distinct human/Agent credential sessions. Client timings are not directly comparable and do not demonstrate a frontend speed improvement.'
 retryPolicy='GET temporary transport exceptions only: at most one immediate retry within a 15-second logical request budget; no POST retries or certificate/TLS validation changes. Every attempt, including recovered errors, remains in the evidence.'
 scope='Two real public multiplayer tables, eight independent human-seat credentials and fixed protocol clients, six production-timed rounds; not eight humans or external LLM Agents'
 constraints=@('No browser/User-Agent impersonation or WAF bypass','No /advance or clock override','No provider-key access','Latency is a single HTTP request Stopwatch, excluding polling sleeps','304 bytes mean the actual decoded response body, not headers or compressed wire bytes')
 maximumRuntimeSeconds=720;pollIntervalMs=1500;modelRequestsDirectlyMade=0;advanceRequestsMade=0
 checks=[Collections.Generic.List[object]]::new();tables=[Collections.Generic.List[object]]::new()
 acceptedActions=[Collections.Generic.List[object]]::new();suggestions=[Collections.Generic.List[object]]::new()
 networkErrors=[Collections.Generic.List[object]]::new();logicalRequests=[Collections.Generic.List[object]]::new();notVerified=[Collections.Generic.List[object]]::new();pollWindows=[Collections.Generic.List[object]]::new()
}

function Safe-Text([string]$Text){
 $value=$Text -replace 'Bearer\s+\S+','Bearer [redacted]' -replace '\b[a-fA-F0-9]{64}\b','[redacted]' -replace 'sk-[A-Za-z0-9_-]+','[redacted]'
 foreach($secret in $script:Secrets){$value=$value.Replace($secret,'[redacted]')}
 if($value.Length -gt 500){$value=$value.Substring(0,500)};return $value
}
function Progress-Row([string]$Event,[hashtable]$Details=@{}){
 $row=[ordered]@{task='classroom-online-v7';event=$Event;elapsedSeconds=[Math]::Round($script:ExecutionClock.Elapsed.TotalSeconds,1)}
 foreach($key in $Details.Keys){$row[$key]=$Details[$key]};Write-Host ($row|ConvertTo-Json -Depth 5 -Compress)
}
function Check([bool]$Condition,[string]$Name,$Details=$null){
 $row=[ordered]@{name=$Name;passed=$Condition};if($null -ne $Details){$row['details']=$Details}
 [void]$script:Evidence.checks.Add($row);if(-not $Condition){throw $Name}
}
function Runtime-Guard(){if($script:ExecutionClock.Elapsed.TotalMilliseconds -ge $script:MaximumMs){throw 'Public verification exceeded its 12-minute runtime bound'}}
function Set-PublicOrigin([string]$Url){
 [Uri]$parsedOriginUri=[Uri]::new($Url)
 if($parsedOriginUri.Scheme -ne 'https' -or $parsedOriginUri.UserInfo -or $parsedOriginUri.Query -or $parsedOriginUri.Fragment -or $parsedOriginUri.AbsolutePath -ne '/' -or $parsedOriginUri.IsLoopback){throw 'Supply only a public HTTPS origin without path, credentials, query or fragment'}
 $authorityText=$parsedOriginUri.GetLeftPart([UriPartial]::Authority)
 $script:BaseOriginUrl=$authorityText+'/';$script:Evidence['origin']=$authorityText
}
function Room-Path($Table){return '/api/rooms/'+[Uri]::EscapeDataString($Table.Id)}
function Request-Task([string]$Key,[string]$Route,[string]$Method='GET',$Body=$null,[string]$Credential='',[int]$Expected=200,[int]$Table=-1,[int]$Seat=-1,[string]$ETag='',[Microsoft.PowerShell.Commands.WebRequestSession]$WebSession=$null){
 Runtime-Guard;if($Route -match '/advance(?:[/?]|$)'){throw 'Advance route is prohibited'}
 $json=$null;if($null -ne $Body){$json=$Body|ConvertTo-Json -Depth 15 -Compress}
 if($null -eq $WebSession){if($Credential -and $script:CredentialSessions.ContainsKey($Credential)){$WebSession=$script:CredentialSessions[$Credential]}else{$WebSession=[Microsoft.PowerShell.Commands.WebRequestSession]::new()}}
 return [pscustomobject]@{Key=$Key;Origin=$script:BaseOriginUrl;Route=$Route;Method=$Method;BodyJson=$json;Credential=$Credential;Expected=$Expected;Table=$Table;Seat=$Seat;ETag=$ETag;WebSession=$WebSession;MaximumAttempts=$(if($Method -eq 'GET'){2}else{1});Timeout=[Math]::Max(1,[Math]::Min(15,[Math]::Floor(($script:MaximumMs-$script:ExecutionClock.Elapsed.TotalMilliseconds)/1000)))}
}
function Record-ResponseMetrics($Response,$Metrics=$script:RequestMetrics,$Errors=$script:Evidence.networkErrors,$Logical=$script:Evidence.logicalRequests){
 foreach($attempt in $Response.Attempts){
  $metric=[ordered]@{key=$Response.Key;attempt=$attempt.Number;table=$Response.Table;seat=$Response.Seat;method=$Response.Method;route=($Response.Route -replace '/api/rooms/[^/]+','/api/rooms/[table]');status=$attempt.Status;elapsedMs=[Math]::Round($attempt.ElapsedMs,2);startedUtcMs=$attempt.StartedUtcMs;bodyBytes=$attempt.BodyBytes;hasETag=$attempt.HasETag;recoveredByLaterAttempt=($attempt.Number -lt $Response.Attempts.Count -and -not $Response.Error)}
  if($attempt.Number -eq $Response.Attempts.Count -and $Response.Data -and $Response.Data['receipt']){$metric['receiptStatus']=$Response.Data['receipt']['status'];$metric['receiptSource']=$Response.Data['receipt']['source'];$metric['receiptRound']=$Response.Data['receipt']['round']}
  [void]$Metrics.Add($metric)
  if($attempt.Error -or ($attempt.Status -ne $Response.Expected -and -not ($Response.Method -eq 'GET' -and $attempt.Status -eq 304 -and $Response.Key -like 'poll-*'))){
   [void]$Errors.Add([ordered]@{key=$Response.Key;attempt=$attempt.Number;status=$attempt.Status;elapsedMs=$metric.elapsedMs;bodyBytes=$attempt.BodyBytes;contentType=$attempt.ContentType;error=(Safe-Text ([string]$attempt.Error));temporaryTransportError=$attempt.Transient;recoveredByLaterAttempt=$metric.recoveredByLaterAttempt})
  }
 }
 [void]$Logical.Add([ordered]@{key=$Response.Key;method=$Response.Method;attempts=$Response.Attempts.Count;totalElapsedMs=[Math]::Round($Response.ElapsedMs,2);finalStatus=$Response.Status;postOutcome=$(if($Response.Method -eq 'POST' -and $Response.Status -eq 0){'unknown; no automatic retry'}else{'response observed'})})
}
function Request-Batch($Tasks){
 Runtime-Guard
 $responses=@($Tasks | ForEach-Object -Parallel {
  $task=$_;$ProgressPreference='SilentlyContinue';$ErrorActionPreference='Stop'
  $parameters=@{Uri=([Uri]::new([Uri]$task.Origin,$task.Route));Method=$task.Method;MaximumRedirection=0;SkipHttpErrorCheck=$true;WebSession=$task.WebSession}
  $headers=@{};if($task.Credential){$headers.Authorization='Bearer '+$task.Credential};if($task.ETag){$headers['If-None-Match']=$task.ETag};if($headers.Count){$parameters.Headers=$headers}
  if($null -ne $task.BodyJson){$parameters.ContentType='application/json';$parameters.Body=$task.BodyJson}
  $logicalWatch=[Diagnostics.Stopwatch]::StartNew();$attempts=[Collections.Generic.List[object]]::new()
  $status=0;$data=$null;$etag='';$serverTime=$null;$type='';$errorText=$null;$bodyBytes=0;$firstStarted=0
  for($number=1;$number -le $task.MaximumAttempts;$number++){
   $remainingSeconds=if($number -eq 1){[int]$task.Timeout}else{[Math]::Floor($task.Timeout-$logicalWatch.Elapsed.TotalSeconds)};if($remainingSeconds -lt 1){break}
   $parameters.TimeoutSec=[int]$remainingSeconds
   $requestStartedUtcMs=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();if(-not $firstStarted){$firstStarted=$requestStartedUtcMs}
   $watch=[Diagnostics.Stopwatch]::StartNew();$transient=$false
   try{
    if($task.Route -match '/advance(?:[/?]|$)'){throw 'Advance route is prohibited'}
    if($task.WebSession -isnot [Microsoft.PowerShell.Commands.WebRequestSession]){throw 'Native per-credential WebRequestSession was not preserved across the parallel task'}
    # Persistent native session, genuine default User-Agent and default TLS validation.
    $response=Invoke-WebRequest @parameters;$watch.Stop()
    $status=[int]$response.StatusCode
    $content=if($response.Content -is [byte[]]){[Text.Encoding]::UTF8.GetString($response.Content)}else{[string]$response.Content}
    $bodyBytes=[Text.Encoding]::UTF8.GetByteCount($content);$data=$null;$errorText=$null
    if($status -ne 304){try{$data=$content|ConvertFrom-Json -AsHashtable -Depth 70}catch{$errorText='Response body is not JSON'}}
    $etag='';if($response.Headers.ContainsKey('ETag')){$etag=[string]($response.Headers['ETag']|Select-Object -First 1)}
    $serverTime=$null;if($response.Headers.ContainsKey('X-Server-Time')){$serverTime=[string]($response.Headers['X-Server-Time']|Select-Object -First 1)}
    $type='';if($response.Headers.ContainsKey('Content-Type')){$type=[string]($response.Headers['Content-Type']|Select-Object -First 1)}
   }catch{
    $watch.Stop();$status=0;$data=$null;$bodyBytes=0;$etag='';$serverTime=$null;$type=''
    $messages=[Collections.Generic.List[string]]::new();$exception=$_.Exception
    while($null -ne $exception){[void]$messages.Add([string]$exception.Message);if($exception -is [Net.Http.HttpRequestException] -or $exception -is [IO.IOException] -or $exception -is [TimeoutException] -or $exception -is [Threading.Tasks.TaskCanceledException]){$transient=$true};$exception=$exception.InnerException}
    $errorText=$messages -join ' -> ';$errorText=$errorText -replace 'Bearer\s+\S+','Bearer [redacted]' -replace '\b[a-fA-F0-9]{64}\b','[redacted]'
    if($errorText -match '(?i)certificate.*(invalid|validation|mismatch)|trust failure|证书'){$transient=$false}
   }
   [void]$attempts.Add([pscustomobject]@{Number=$number;Status=$status;ElapsedMs=$watch.Elapsed.TotalMilliseconds;StartedUtcMs=$requestStartedUtcMs;BodyBytes=$bodyBytes;ContentType=$type;HasETag=[bool]$etag;Error=$errorText;Transient=$transient})
   if(-not ($task.Method -eq 'GET' -and $status -eq 0 -and $transient -and $number -lt $task.MaximumAttempts -and ($task.Timeout-$logicalWatch.Elapsed.TotalSeconds) -ge 1)){break}
  }
  $logicalWatch.Stop()
  if($attempts.Count -eq 0){$errorText='Logical HTTP request exhausted its bounded timeout before an attempt'}
  [pscustomobject]@{Key=$task.Key;Table=$task.Table;Seat=$task.Seat;Method=$task.Method;Route=$task.Route;Expected=$task.Expected;Status=$status;ElapsedMs=$logicalWatch.Elapsed.TotalMilliseconds;StartedUtcMs=$firstStarted;BodyBytes=$bodyBytes;ContentType=$type;ETag=$etag;ServerTime=$serverTime;Data=$data;Error=$errorText;Attempts=$attempts;Session=$task.WebSession}
 } -ThrottleLimit 8)
 foreach($response in $responses){Record-ResponseMetrics $response}
 return $responses
}
function Response-OK($Response){
 $valid=$null -ne $Response -and -not $Response.Error -and $Response.Status -eq $Response.Expected -and $null -ne $Response.Data
 if($valid -and $Response.Expected -lt 400){$valid=$Response.Data['ok'] -ne $false}
 Check $valid "HTTP $($Response.Key): expected JSON status $($Response.Expected)" @{status=$Response.Status;bodyBytes=$Response.BodyBytes;contentType=$Response.ContentType}
 return $Response.Data
}
function One-Request($Task){return Response-OK (@(Request-Batch @($Task))[0])}
function New-Client($Data,[string]$Role,[string]$Authorization,[Microsoft.PowerShell.Commands.WebRequestSession]$HumanSession){
 Check ([bool]$Data['token'] -and [bool]$Data['agentToken'] -and [bool]$Data['state']['me']) 'Seat creation returned independent credentials'
 [void]$script:Secrets.Add([string]$Data['token']);[void]$script:Secrets.Add([string]$Data['agentToken'])
 if($null -eq $HumanSession){$HumanSession=[Microsoft.PowerShell.Commands.WebRequestSession]::new()}
 $agentSession=[Microsoft.PowerShell.Commands.WebRequestSession]::new()
 $script:CredentialSessions[[string]$Data['token']]=$HumanSession;$script:CredentialSessions[[string]$Data['agentToken']]=$agentSession
 return [pscustomobject]@{Role=$Role;Authorization=$Authorization;Token=$Data['token'];AgentToken=$Data['agentToken'];Id=$Data['state']['me']['id'];Seat=[int]$Data['state']['me']['seat'];State=$Data['state'];ETag='';LastPollStart=0;MaxPollGap=0}
}
function Safe-Host($Message){
 return [ordered]@{id=$Message['id'];round=$Message['round'];provider=$Message['provider'];status=$Message['status'];reason=$Message['reason'];text=$Message['text'];generatedAt=$Message['generatedAt'];claimRefs=@($Message['claimRefs']|ForEach-Object {[ordered]@{id=$_['id'];type=$_['type'];text=$_['text']}});knowledgeRefs=@($Message['knowledgeRefs']|ForEach-Object {[ordered]@{id=$_['id'];title=$_['title'];chapter=$_['chapter'];section=$_['section'];summary=$_['summary'];source=$_['source'];sourceType=$_['sourceType'];version=$_['version']}})}
}
function Observe-Host($Table,$State){
 $message=$State['god'];if($message){$key="$($message['id']):$($message['status']):$($message['provider'])";if($Table.SeenHosts.Add($key)){[void]$Table.Summary.hostObservations.Add((Safe-Host $message))}}
 foreach($message in @($State['godHistory'])){if($message -and $message['id']){$Table.HostMessages[[string]$message['id']]=Safe-Host $message}}
 $world=@($State['world']|ForEach-Object {$row=[ordered]@{};foreach($field in @('id','round','type','text','eventId','targets','effect','endRound','concept','dueRound','claimId','verified')){if($_.Contains($field)){$row[$field]=$_[$field]}};$row})
 $digest=Digest ($world|ConvertTo-Json -Depth 25 -Compress)
 if($Table.SeenWorld.Add($digest)){[void]$Table.Summary.worldSnapshots.Add([ordered]@{round=$State['round'];phase=$State['phase'];serverTime=$State['serverTime'];world=$world})}
}
function Apply-Response($Response){
 $table=$script:Tables[$Response.Table];$client=$table.Clients[$Response.Seat]
 if($Response.Status -eq 200 -and $Response.Data -and $Response.Data['state']){
  $next=$Response.Data['state'];Check ($next['id'] -eq $table.Id -and $next['me']['id'] -eq $client.Id) "$($table.Label): response remains bound to seat $($client.Seat)"
  foreach($publicPlayer in @($next['players'])){Check (-not $publicPlayer.Contains('privateNotes') -and -not $publicPlayer.Contains('intent') -and -not $publicPlayer.Contains('receipt') -and -not $publicPlayer.Contains('action') -and -not $publicPlayer.Contains('company')) "$($table.Label): public opponent records contain no private action, receipt or company data"}
  if(-not $client.State -or [long]$next['version'] -ge [long]$client.State['version']){$client.State=$next;Observe-Host $table $next}
 }
 if($Response.ETag){$client.ETag=$Response.ETag}
}
function Poll-All([bool]$Force=$false){
 $tasks=@();for($ti=0;$ti -lt $script:Tables.Count;$ti++){$t=$script:Tables[$ti];for($ci=0;$ci -lt 4;$ci++){$c=$t.Clients[$ci];$etag=if($Force){''}else{$c.ETag};$tasks+=Request-Task "poll-$($t.Label)-$ci" (Room-Path $t) -Credential $c.Token -Table $ti -Seat $ci -ETag $etag}}
 $results=@(Request-Batch $tasks)
 foreach($r in $results){
  Check (-not $r.Error -and ($r.Status -eq 200 -or (-not $Force -and $r.Status -eq 304))) "Poll $($r.Key) returned its genuine expected 200/304" @{status=$r.Status;bodyBytes=$r.BodyBytes}
  if($r.Status -eq 200){Check ($r.Data -and $r.Data['ok'] -eq $true -and $r.Data['state']) "Poll $($r.Key) includes actual authoritative state"}
  if($r.Status -eq 304){Check ($r.BodyBytes -eq 0) '304 response contains zero body bytes'}
  $c=$script:Tables[$r.Table].Clients[$r.Seat];if($c.LastPollStart -gt 0){$c.MaxPollGap=[Math]::Max($c.MaxPollGap,$r.StartedUtcMs-$c.LastPollStart)};$c.LastPollStart=$r.StartedUtcMs
  Apply-Response $r
 }
}
function Wait-All([scriptblock]$Predicate,[string]$Label,[int]$TimeoutMs=120000){
 $wait=[Diagnostics.Stopwatch]::StartNew();$lastStart=0;$sample=[ordered]@{label=$Label;batches=0;parallelRequestsPerBatch=8;maximumBatchStartGapMs=0;maximumBatchDurationMs=0}
 try{while($true){Runtime-Guard;$cycle=[Diagnostics.Stopwatch]::StartNew();$now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();if($lastStart -gt 0){$sample.maximumBatchStartGapMs=[Math]::Max($sample.maximumBatchStartGapMs,$now-$lastStart)};$lastStart=$now;Poll-All;$sample.batches++;$sample.maximumBatchDurationMs=[Math]::Max($sample.maximumBatchDurationMs,$cycle.Elapsed.TotalMilliseconds)
   if(& $Predicate){return};if($wait.Elapsed.TotalMilliseconds -gt $TimeoutMs){throw "Timed out waiting for $Label"}
   $delay=[Math]::Max(0,$script:PollIntervalMs-$cycle.Elapsed.TotalMilliseconds);if($delay -gt 0){Start-Sleep -Milliseconds ([int]$delay)}
  }}finally{$sample['elapsedMs']=$wait.Elapsed.TotalMilliseconds;[void]$script:Evidence.pollWindows.Add($sample)}
}
function Same-Action($Action){return $null -ne $Action -and $Action['id'] -eq 'A12' -and [int]$Action['target'] -eq 0 -and [double]$Action['scale'] -eq 1}
function Receipt-Check($Table,$Client,$Data,[int]$Round,[string]$Status,[string]$Source){
 $receipt=$Data['receipt'];Check ($receipt -and $receipt['status'] -eq $Status -and $receipt['source'] -eq $Source -and [int]$receipt['round'] -eq $Round -and (Same-Action $receipt['action'])) "$($Table.Label) round $Round seat $($Client.Seat): $Status from $Source"
 $safe=[ordered]@{table=$Table.Label;seat=$Client.Seat;role=$Client.Role;round=$Round;status=$Status;source=$Source;action=$receipt['action'];cost=$receipt['cost'];acceptedAt=$receipt['acceptedAt']}
 if($Status -eq 'suggested'){[void]$script:Evidence.suggestions.Add($safe)}else{[void]$script:Evidence.acceptedActions.Add($safe)}
}
function Action-Task($Table,[int]$TableIndex,[int]$ClientIndex,[int]$Round,[bool]$Agent,[string]$Step){
 $c=$Table.Clients[$ClientIndex];$route=(Room-Path $Table)+'/action';$credential=$c.Token;if($Agent){$route=(Room-Path $Table)+'/agent/action';$credential=$c.AgentToken}
 return Request-Task "$Step-$($Table.Label)-$Round-$ClientIndex" $route -Method POST -Credential $credential -Body @{round=$Round;action=@{id='A12';target=0;scale=1};requestId=[Guid]::NewGuid().ToString();summary='公开课堂协议验证：固定等待观察动作，未调用外部玩家模型。'} -Table $TableIndex -Seat $ClientIndex
}
function Submit-Round([int]$Round){
 $tasks=@();for($ti=0;$ti -lt 2;$ti++){for($ci=0;$ci -lt 4;$ci++){$tasks+=Action-Task $script:Tables[$ti] $ti $ci $Round ($ci -ge 2) 'action'}}
 foreach($r in @(Request-Batch $tasks)){
  $data=Response-OK $r;$t=$script:Tables[$r.Table];$c=$t.Clients[$r.Seat];$status=if($r.Seat -eq 2){'suggested'}else{'accepted'};$source=if($r.Seat -ge 2){'agent'}else{'human'}
  Receipt-Check $t $c $data $Round $status $source
  if($r.Seat -eq 2){Check ($null -eq $data['state']['me']['action'] -and $data['state']['me']['suggestion']['status'] -eq 'suggested') "$($t.Label) round ${Round}: assist suggestion does not silently execute"}
  Apply-Response $r
 }
 $confirm=@();for($ti=0;$ti -lt 2;$ti++){$confirm+=Action-Task $script:Tables[$ti] $ti 2 $Round $false 'confirm'}
 foreach($r in @(Request-Batch $confirm)){$data=Response-OK $r;$t=$script:Tables[$r.Table];Receipt-Check $t $t.Clients[2] $data $Round 'accepted' 'human';Apply-Response $r}
 Poll-All $true
 foreach($t in $script:Tables){foreach($c in $t.Clients){Check ($c.State['phase'] -eq 'decision' -and [int]$c.State['round'] -eq $Round -and @($c.State['history']).Count -eq ($Round-1) -and @($c.State['players']|Where-Object {-not $_['submitted']}).Count -eq 0) "$($t.Label) round ${Round}: all four receipts held without early settlement"}}
 Progress-Row 'round-actions-accepted' @{round=$Round;accepted=8;suggestions=2;parallelRequests=8}
}
function Digest([string]$Text){$hash=[Security.Cryptography.SHA256]::Create();try{return -join ($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$Text))|ForEach-Object {$_.ToString('x2')})}finally{$hash.Dispose()}}
function Confirm-Ledgers([int]$Round){
 foreach($t in $script:Tables){$canonical=$null;$ledger=$null
  foreach($c in $t.Clients){$item=@($c.State['history']|Where-Object {[int]$_['round'] -eq $Round});Check ($item.Count -eq 1) "$($t.Label) round ${Round}: seat $($c.Seat) sees one authoritative ledger";$json=$item[0]|ConvertTo-Json -Depth 40 -Compress;if($null -eq $canonical){$canonical=$json;$ledger=$item[0]};Check ($json -eq $canonical) "$($t.Label) round ${Round}: four clients share identical ledger"}
  $rows=@();foreach($c in $t.Clients){$row=@($ledger['players']|Where-Object {[int]$_['seat'] -eq $c.Seat});Check ($row.Count -eq 1 -and (Same-Action $row[0]['action']) -and -not $row[0]['bankrupt']) "$($t.Label) round $Round seat $($c.Seat): fixed legal action settled without bankruptcy";$rows+=[ordered]@{seat=$c.Seat;role=$c.Role;action=$row[0]['action'];cash=$row[0]['cash'];users=$row[0]['users'];profit=$row[0]['profit'];score=$row[0]['score']}}
  [void]$t.Summary.rounds.Add([ordered]@{round=$Round;matchingClients=4;sha256=(Digest $canonical);players=$rows;deadline=$t.Deadlines[$Round]})
 }
 Progress-Row 'round-ledgers-match' @{round=$Round;tables=2;matchingClientsPerTable=4}
}
function Health-Safe($Data){return [ordered]@{status=$Data['status'];storage=$Data['storage'];online=$Data['online'];ruleVersion=$Data['ruleVersion'];provider=$Data['provider'];host=[ordered]@{enabled=$Data['host']['enabled'];configuredProvider=$Data['host']['configuredProvider'];calls=$Data['host']['calls'];limit=$Data['host']['limit'];model=$Data['host']['model'];budgetMode=$Data['host']['budgetMode']}}}
function Latency-Stats($Rows){$values=@($Rows|ForEach-Object {[double]$_['elapsedMs']}|Sort-Object);if(-not $values.Count){return @{count=0;p50Ms=$null;p95Ms=$null;maxMs=$null}};return [ordered]@{count=$values.Count;p50Ms=$values[[Math]::Max(0,[Math]::Ceiling($values.Count*.50)-1)];p95Ms=$values[[Math]::Max(0,[Math]::Ceiling($values.Count*.95)-1)];maxMs=$values[-1]}}
function Body-Stats($Rows){$count=0;[long]$total=0;foreach($row in $Rows){$count++;$total+=[long]$row['bodyBytes']};return [ordered]@{count=$count;totalBytes=$total}}
function Save-Evidence(){
 $script:Evidence['elapsedSeconds']=[Math]::Round($script:ExecutionClock.Elapsed.TotalSeconds,2);$script:Evidence['updatedAt']=[DateTime]::UtcNow.ToString('o')
 $actionMetrics=@($script:RequestMetrics|Where-Object {$_.key -match '^(action|confirm)-'})
 $script:Evidence['latency']=[ordered]@{all=(Latency-Stats $script:RequestMetrics);poll200=(Latency-Stats @($script:RequestMetrics|Where-Object {$_.key -like 'poll-*' -and $_.status -eq 200}));poll304=(Latency-Stats @($script:RequestMetrics|Where-Object {$_.key -like 'poll-*' -and $_.status -eq 304}));actionRequestsAll=(Latency-Stats $actionMetrics);acceptedActionRequests=(Latency-Stats @($actionMetrics|Where-Object {$_['receiptStatus'] -eq 'accepted'}));suggestionRequests=(Latency-Stats @($actionMetrics|Where-Object {$_['receiptStatus'] -eq 'suggested'}))}
 $script:Evidence['responseBodies']=[ordered]@{unit='decoded UTF-8 bytes, body only';status200=(Body-Stats @($script:RequestMetrics|Where-Object {$_.status -eq 200}));status304=(Body-Stats @($script:RequestMetrics|Where-Object {$_.status -eq 304}))}
 $script:Evidence['requests']=$script:RequestMetrics;$script:Evidence['networkErrorAttempts']=$script:Evidence.networkErrors.Count;$script:Evidence['zeroNetworkErrorsObserved']=($script:Evidence.networkErrors.Count -eq 0)
 $serialized=$script:Evidence|ConvertTo-Json -Depth 70;foreach($secret in $script:Secrets){$serialized=$serialized.Replace($secret,'[redacted]')}
 $serialized=$serialized -replace 'Bearer\s+[a-fA-F0-9]{64}','Bearer [redacted]' -replace 'sk-[A-Za-z0-9_-]+','[redacted]'
 [void][IO.Directory]::CreateDirectory((Split-Path -Parent $script:EvidencePath));[IO.File]::WriteAllText($script:EvidencePath,$serialized+"`n",[Text.UTF8Encoding]::new($false))
 $archive=Join-Path (Split-Path -Parent $script:EvidencePath) "classroom-online-v7-$($script:Evidence.runId).json";[IO.File]::WriteAllText($archive,$serialized+"`n",[Text.UTF8Encoding]::new($false))
}

if($NoNetworkSelfTest){
 # This branch exits before the first HTTP call and writes only into its own temp directory.
 $offlineDirectory=Join-Path ([IO.Path]::GetTempPath()) ('codex-v7-qa-offline-'+[Guid]::NewGuid().ToString())
 $script:EvidencePath=Join-Path $offlineDirectory 'offline-self-test.json';$script:Evidence['selfTestOnly']=$true
 Set-PublicOrigin $BaseUrl
 Check ($script:BaseOriginUrl -is [string]) 'Offline: base URL is a string distinct from parsed Uri'
 $task=Request-Task 'offline-uri' '/api/health';$resolvedUri=[Uri]::new([Uri]$task.Origin,$task.Route)
 Check ($resolvedUri.AbsoluteUri -eq ($script:BaseOriginUrl+'api/health')) 'Offline: task URI resolves correctly without requesting it'
 $empty=Body-Stats @();Check ($empty.count -eq 0 -and $empty.totalBytes -eq 0) 'Offline: empty response-body metrics are safe under StrictMode'
 $fixture=Body-Stats @(@{bodyBytes=7},@{bodyBytes=11});Check ($fixture.count -eq 2 -and $fixture.totalBytes -eq 18) 'Offline fixture: body aggregation sums actual values'
 $latency=Latency-Stats @();Check ($latency.count -eq 0 -and $null -eq $latency.p95Ms) 'Offline: empty latency metrics are safe'
 $script:Evidence['status']='offline-self-test-passed';Save-Evidence
 $saved=Get-Content -LiteralPath $script:EvidencePath -Raw|ConvertFrom-Json -AsHashtable
 Check ($saved['requests'].Count -eq 0 -and $saved['responseBodies']['status200']['count'] -eq 0 -and $saved['responseBodies']['status304']['totalBytes'] -eq 0) 'Offline: evidence saves with zero HTTP requests'
 $sessionTasks=@();for($i=0;$i -lt 8;$i++){$native=[Microsoft.PowerShell.Commands.WebRequestSession]::new();$sessionTasks+=[pscustomobject]@{Index=$i;Session=$native;Identity=[Runtime.CompilerServices.RuntimeHelpers]::GetHashCode($native)}}
 $passedSessions=@($sessionTasks|ForEach-Object -Parallel {[pscustomobject]@{Index=$_.Index;Session=$_.Session;IsNative=($_.Session -is [Microsoft.PowerShell.Commands.WebRequestSession]);Identity=[Runtime.CompilerServices.RuntimeHelpers]::GetHashCode($_.Session)}} -ThrottleLimit 8)
 Check ($passedSessions.Count -eq 8 -and @($passedSessions|Where-Object {-not $_.IsNative}).Count -eq 0) 'Offline: eight native sessions retain their type across ForEach-Parallel'
 foreach($result in $passedSessions){Check ([object]::ReferenceEquals($sessionTasks[$result.Index].Session,$result.Session) -and $sessionTasks[$result.Index].Identity -eq $result.Identity) 'Offline: native session reference survives the parallel task without serialization'}
 Check (@($sessionTasks.Identity|Sort-Object -Unique).Count -eq 8) 'Offline: independent identities do not share session objects'
 $postTask=Request-Task 'offline-post' '/api/rooms' -Method POST -Body @{}
 Check ($task.MaximumAttempts -eq 2 -and $postTask.MaximumAttempts -eq 1) 'Offline: GET permits one retry and POST never automatically retries'
 $fixtureMetrics=[Collections.Generic.List[object]]::new();$fixtureErrors=[Collections.Generic.List[object]]::new();$fixtureLogical=[Collections.Generic.List[object]]::new()
 $fixtureResponse=[pscustomobject]@{Key='offline-synthetic-get';Table=-1;Seat=-1;Method='GET';Route='/api/health';Expected=200;Status=200;ElapsedMs=5;Data=@{};Error=$null;Attempts=@([pscustomobject]@{Number=1;Status=0;ElapsedMs=2;StartedUtcMs=1;BodyBytes=0;HasETag=$false;ContentType='';Error='Explicit offline temporary transport fixture, not an HTTP request';Transient=$true},[pscustomobject]@{Number=2;Status=200;ElapsedMs=3;StartedUtcMs=3;BodyBytes=5;HasETag=$false;ContentType='application/json';Error=$null;Transient=$false})}
 Record-ResponseMetrics $fixtureResponse -Metrics $fixtureMetrics -Errors $fixtureErrors -Logical $fixtureLogical
 Check ($fixtureMetrics.Count -eq 2 -and $fixtureErrors.Count -eq 1 -and $fixtureErrors[0]['recoveredByLaterAttempt'] -eq $true -and $fixtureLogical[0]['attempts'] -eq 2) 'Offline synthetic fixture: failed GET attempt stays counted after successful retry'
 Check ($script:RequestMetrics.Count -eq 0 -and $script:Evidence.networkErrors.Count -eq 0) 'Offline: synthetic retry fixture never enters actual HTTP metrics'
 $worldFixture=[pscustomobject]@{SeenHosts=[Collections.Generic.HashSet[string]]::new();HostMessages=@{};SeenWorld=[Collections.Generic.HashSet[string]]::new();Summary=@{hostObservations=[Collections.Generic.List[object]]::new();worldSnapshots=[Collections.Generic.List[object]]::new()}}
 Observe-Host $worldFixture @{round=0;phase='lobby';serverTime=1;god=$null;godHistory=@();world=@()}
 Check ($worldFixture.Summary.worldSnapshots.Count -eq 1 -and $worldFixture.Summary.worldSnapshots[0]['world'].Count -eq 0) 'Offline: empty public world snapshot is safe'
 $script:Evidence['offlineSyntheticFixture']=[ordered]@{realHttpRequests=0;sessionTransfers=8;syntheticAttempts=2;retainedSyntheticErrors=1};Save-Evidence
 Write-Host (@{status='passed';mode='no-network-self-test';httpRequests=0;roomsCreated=0;sessionTransfers=8;syntheticRetryAttempts=2;retainedSyntheticErrors=1;evidence=$script:EvidencePath}|ConvertTo-Json -Compress)
 exit 0
}

try{
 Set-PublicOrigin $BaseUrl
 $previousPath=Join-Path (Split-Path -Parent $script:EvidencePath) 'classroom-online-v6.json';if(Test-Path -LiteralPath $previousPath){$script:Evidence['previousClientReport']=[ordered]@{file='docs/evidence/classroom-online-v6.json';sha256=(Get-FileHash -LiteralPath $previousPath -Algorithm SHA256).Hash;transport='V6 fresh implicit sessions per request';comparison='Preserved as failure evidence; not a frontend timing baseline for this persistent-session run'}}
 Progress-Row 'public-health-preflight'
 $preflight=@(Request-Batch @((Request-Task 'initial-health' '/api/health'),(Request-Task 'catalog' '/api/config')))
 $health=Response-OK ($preflight|Where-Object Key -eq 'initial-health');$catalog=Response-OK ($preflight|Where-Object Key -eq 'catalog')
 $script:Evidence['initialHealth']=Health-Safe $health
 Check ($health['status'] -eq 'ready' -and $health['storage'] -eq 'cloudflare-d1' -and $health['online'] -eq $true) 'Actual public shared D1 host is ready'
 Check ([int]$catalog['rules']['decisionSeconds'] -eq 45 -and [int]$catalog['rules']['rounds'] -eq 6) 'Original public rules retain 45 seconds and six rounds'
 $waitAction=@($catalog['actions']|Where-Object {$_['id'] -eq 'A12'});Check ($waitAction.Count -eq 1 -and [double]$waitAction[0]['cost'] -eq 0 -and @($waitAction[0]['scales']) -contains 1) 'A12 is a legal zero-action-fee choice'
 $created=@(Request-Batch @((Request-Task 'create-A' '/api/rooms' -Method POST -Body @{name='V6课堂A手动1';mode='multiplayer';authorization='assist'} -Expected 201),(Request-Task 'create-B' '/api/rooms' -Method POST -Body @{name='V6课堂B手动1';mode='multiplayer';authorization='assist'} -Expected 201)))
 foreach($label in @('A','B')){$creationResponse=$created|Where-Object Key -eq "create-$label";$data=Response-OK $creationResponse;$clients=[Collections.Generic.List[object]]::new();[void]$clients.Add((New-Client $data 'manual-1' 'assist' $creationResponse.Session));$summary=[ordered]@{label=$label;roomId=$data['roomId'];rounds=[Collections.Generic.List[object]]::new();hostObservations=[Collections.Generic.List[object]]::new();worldSnapshots=[Collections.Generic.List[object]]::new()};$table=[pscustomobject]@{Id=$data['roomId'];Label=$label;Clients=$clients;Summary=$summary;Deadlines=@{};SeenHosts=[Collections.Generic.HashSet[string]]::new();SeenWorld=[Collections.Generic.HashSet[string]]::new();HostMessages=@{}};[void]$script:Tables.Add($table);[void]$script:Evidence.tables.Add($summary)}
 $roles=@(@{role='manual-2';authorization='assist'},@{role='assist-protocol-agent';authorization='assist'},@{role='autopilot-protocol-agent';authorization='autopilot'})
 foreach($role in $roles){$tasks=@();for($ti=0;$ti -lt 2;$ti++){$t=$script:Tables[$ti];$tasks+=Request-Task "join-$($t.Label)-$($role.role)" ((Room-Path $t)+'/join') -Method POST -Body @{name="V6课堂$($t.Label)-$($role.role)";authorization=$role.authorization} -Expected 201 -Table $ti};foreach($r in @(Request-Batch $tasks)){$data=Response-OK $r;[void]$script:Tables[$r.Table].Clients.Add((New-Client $data $role.role $role.authorization $r.Session))}}
 $allClients=@($script:Tables|ForEach-Object {$_.Clients});Check (@($allClients.Id|Sort-Object -Unique).Count -eq 8 -and @($allClients.Token|Sort-Object -Unique).Count -eq 8 -and $script:Secrets.Count -eq 16) 'Eight independent seats and sixteen distinct human/Agent credentials exist'
 Poll-All $true
 foreach($t in $script:Tables){Check (@($t.Clients.Seat|Sort-Object -Unique).Count -eq 4) "$($t.Label): four distinct seat positions";foreach($c in $t.Clients){Check ($c.State['mode'] -eq 'multiplayer' -and $c.State['phase'] -eq 'lobby' -and @($c.State['players']).Count -eq 4 -and @($c.State['players']|Where-Object {$_['isBot']}).Count -eq 0) "$($t.Label): four genuine multiplayer seats, no script bots"}}
 $isolation=@();for($ti=0;$ti -lt 2;$ti++){$t=$script:Tables[$ti];$other=$script:Tables[1-$ti];$isolation+=Request-Task "isolation-$($t.Label)-human" (Room-Path $t) -Credential $other.Clients[0].Token -Expected 403;$isolation+=Request-Task "isolation-$($t.Label)-agent" ((Room-Path $t)+'/agent/state') -Credential $other.Clients[2].AgentToken -Expected 403;$isolation+=Request-Task "isolation-$($t.Label)-anonymous" (Room-Path $t) -Expected 401}
 foreach($r in @(Request-Batch $isolation)){$null=Response-OK $r};Check $true 'Both tables reject the other table human/Agent credentials and anonymous access with JSON API responses'
 $checks=@();for($ti=0;$ti -lt 2;$ti++){foreach($ci in @(2,3)){$t=$script:Tables[$ti];$checks+=Request-Task "agent-check-$($t.Label)-$ci" ((Room-Path $t)+'/agent/check') -Credential $t.Clients[$ci].AgentToken -Table $ti -Seat $ci}}
 foreach($r in @(Request-Batch $checks)){$data=Response-OK $r;$c=$script:Tables[$r.Table].Clients[$r.Seat];Check ($data['connected'] -eq $true -and $data['scope'] -eq 'own-seat' -and $data['state']['me']['id'] -eq $c.Id -and $data['state']['me']['authorization'] -eq $c.Authorization) "$($script:Tables[$r.Table].Label): real $($c.Role) protocol check";Apply-Response $r}
 Progress-Row 'two-tables-ready' @{tables=2;independentSeats=8;parallelPolls=8}
 $starts=@();for($ti=0;$ti -lt 2;$ti++){$t=$script:Tables[$ti];$starts+=Request-Task "start-$($t.Label)" ((Room-Path $t)+'/start') -Method POST -Body @{} -Credential $t.Clients[0].Token -Table $ti -Seat 0}
 foreach($r in @(Request-Batch $starts)){$null=Response-OK $r;Apply-Response $r}
 for($round=1;$round -le 6;$round++){
  $currentRound=$round
  Wait-All {foreach($t in $script:Tables){foreach($c in $t.Clients){if([int]$c.State['round'] -gt $currentRound){throw 'A real server round elapsed before its expected action; no clock was overridden'};if([int]$c.State['round'] -ne $currentRound -or $c.State['phase'] -ne 'decision'){return $false}}};return $true} "all eight decision views for round $round" 90000
  foreach($t in $script:Tables){$deadlines=@($t.Clients|ForEach-Object {[long]$_.State['deadline']}|Sort-Object -Unique);Check ($deadlines.Count -eq 1) "$($t.Label) round ${round}: four clients share one server deadline";$t.Deadlines[$round]=$deadlines[0];$remaining=@($t.Clients|ForEach-Object {[long]$_.State['deadline']-[long]$_.State['serverTime']}|Sort-Object -Descending)[0];Check ($remaining -gt 0 -and $remaining -le 45000) "$($t.Label) round ${round}: genuine decision window remains within original 45 seconds" @{observedRemainingMs=$remaining;deadline=$deadlines[0]}}
  Submit-Round $round
  Wait-All {foreach($t in $script:Tables){foreach($c in $t.Clients){if(@($c.State['history']).Count -lt $currentRound){return $false}}};return $true} "all eight settled ledgers for round $round" 90000
  foreach($t in $script:Tables){foreach($c in $t.Clients){Check ([long]$c.State['serverTime'] -ge $t.Deadlines[$round]) "$($t.Label) round ${round}: settlement occurred after the server deadline"}}
  Confirm-Ledgers $round;Save-Evidence
 }
 Wait-All {foreach($t in $script:Tables){$s=$t.Clients[0].State;if($s['phase'] -ne 'finished' -or @($s['godHistory']).Count -lt 6 -or $s['god']['status'] -eq 'generating' -or -not @($s['god']['knowledgeRefs']).Count){return $false}};return $true} 'final genuine host histories and references' 65000
 Poll-All $true
 foreach($t in $script:Tables){$canonical=$null;foreach($c in $t.Clients){Check ($c.State['phase'] -eq 'finished' -and @($c.State['history']).Count -eq 6) "$($t.Label): all four clients genuinely finished six rounds";$public=[ordered]@{history=$c.State['history'];players=@($c.State['players']|ForEach-Object {[ordered]@{seat=$_['seat'];score=$_['score'];cash=$_['cash'];profit=$_['profit'];users=$_['users'];bankrupt=$_['bankrupt']}});winners=$c.State['winners']};$json=$public|ConvertTo-Json -Depth 50 -Compress;if($null -eq $canonical){$canonical=$json};Check ($canonical -eq $json) "$($t.Label): all four final ledgers, scores and winners match"};$t.Summary['finalSha256']=Digest $canonical;$t.Summary['matchingFinalClients']=4;$t.Summary['hostHistory']=@($t.Clients[0].State['godHistory']|ForEach-Object {Safe-Host $_});$t.Summary['actualProviders']=@($t.Summary.hostHistory.provider|Sort-Object -Unique);$t.Summary['generatingObserved']=@($t.Summary.hostObservations|Where-Object {$_.status -eq 'generating'}).Count -gt 0;$t.Summary['maxPollStartGapMs']=@($t.Clients.MaxPollGap|Sort-Object -Descending)[0];$t.Summary['pollGapScope']='Includes setup and action batches; pure waiting intervals are in pollWindows; this is not HTTP latency';foreach($message in $t.Summary.hostHistory){Check (@($message.knowledgeRefs).Count -gt 0 -and [bool]$message.text) "$($t.Label): completed narration retains actual knowledge references"};if(-not $t.Summary.generatingObserved){[void]$script:Evidence.notVerified.Add("$($t.Label): no generating state was observed; completed providers/fallbacks are preserved without inference")}}
 Check ($script:Evidence.acceptedActions.Count -eq 48 -and @($script:Evidence.acceptedActions|ForEach-Object {"$($_.table):$($_.round):$($_.seat)"}|Sort-Object -Unique).Count -eq 48) 'Exactly 48 independent seat-round actions were explicitly accepted'
 Check ($script:Evidence.suggestions.Count -eq 12) 'Each assist seat received a suggestion before its human confirmation in all six rounds'
 $final=One-Request (Request-Task 'final-health' '/api/health');$script:Evidence['finalHealth']=Health-Safe $final
 $script:Evidence['godUsage']=[ordered]@{callsBefore=$health['host']['calls'];callsAfter=$final['host']['calls'];counterScope='Global deployed service, including other traffic; difference is not attributed entirely to this test';directProviderRequests=0}
 $script:Evidence['status']='passed';Progress-Row 'passed' @{tables=2;seats=8;roundsPerTable=6;accepted=48;directModelCalls=0}
}catch{
 $script:Evidence['status']='failed';$script:Evidence['error']=Safe-Text $_.Exception.Message;Progress-Row 'failed' @{message=$script:Evidence.error}
 if($script:Evidence.Contains('initialHealth') -and $script:ExecutionClock.Elapsed.TotalMilliseconds -lt ($script:MaximumMs-2000)){
  try{$last=@(Request-Batch @((Request-Task 'failure-health' '/api/health')))[0];if($last.Status -eq 200 -and $last.Data){$script:Evidence['finalHealth']=Health-Safe $last.Data;$script:Evidence['godUsage']=[ordered]@{callsBefore=$script:Evidence.initialHealth.host.calls;callsAfter=$last.Data['host']['calls'];counterScope='Global deployed service, including other traffic; not solely attributed to this test';directProviderRequests=0}}}catch{}
 }
}finally{
 $script:Evidence['finishedAt']=[DateTime]::UtcNow.ToString('o');Save-Evidence;Progress-Row 'evidence-written' @{path='docs/evidence/classroom-online-v7.json';status=$script:Evidence.status}
}
if($script:Evidence.status -ne 'passed'){exit 1}
