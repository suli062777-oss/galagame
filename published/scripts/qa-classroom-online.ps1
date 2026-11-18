#requires -Version 7.0
<#
Explicit post-deployment public-HTTP smoke test. Example:
  pwsh -NoProfile -File scripts/qa-classroom-online.ps1 -BaseUrl https://PUBLIC-HOST
Uses the genuine PowerShell Invoke-RestMethod default User-Agent. No owner
bypass, browser impersonation, WAF changes, external model, or advance route.
#>
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$BaseUrl)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$script:ProjectRoot=Split-Path -Parent $PSScriptRoot
$script:EvidencePath=Join-Path $script:ProjectRoot 'docs/evidence/classroom-online-2tables.json'
$script:Secrets=[System.Collections.Generic.HashSet[string]]::new()
$script:PollMs=1500
$script:StopAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+180000
$script:BaseOrigin=$null
$script:Evidence=[ordered]@{
    startedAt=[DateTime]::UtcNow.ToString('o');status='running';
    transport='PowerShell 7 Invoke-RestMethod; native default User-Agent; no owner bypass or spoofed browser identity';
    priorNodeObservation='Node fetch received Cloudflare HTTP403 HTML at health before any room creation. This native PowerShell smoke does not prove Node-based Agent access works.';
    scope='Two deployed four-seat rooms, one real production-timed round. Eight HTTP seat credentials and fixed protocol clients, not eight humans or external LLM Agents.';
    limits=@('Not six-round verification.','Not classroom capacity or load validation.','External Agent application/model compatibility is not tested.','Existing global cap and Secret are preserved.');
    modelRequestsDirectlyMade=0;advanceRequestsMade=0;pollIntervalMs=1500;
    checks=[System.Collections.Generic.List[object]]::new();tables=[System.Collections.Generic.List[object]]::new()
}

function Write-SafeProgress([string]$Event,[hashtable]$Details=@{}) {
    $row=[ordered]@{task='classroom-online-smoke';transport='native-powershell';event=$Event}
    foreach($key in $Details.Keys){$row[$key]=$Details[$key]}
    Write-Host ($row|ConvertTo-Json -Compress -Depth 5)
}
function Protect-Text([string]$Value) {
    $safe=$Value -replace 'Bearer\s+\S+','Bearer [redacted]' -replace '\b[a-fA-F0-9]{64}\b','[redacted]' -replace 'sk-[A-Za-z0-9_-]+','[redacted]'
    foreach($secret in $script:Secrets){$safe=$safe.Replace($secret,'[redacted]')}
    if($safe.Length -gt 400){$safe=$safe.Substring(0,400)}
    return $safe
}
function Assert-Check([bool]$Condition,[string]$Name,$Details=$null) {
    $row=[ordered]@{name=$Name;passed=$Condition}
    if($null -ne $Details){$row['details']=$Details}
    [void]$script:Evidence['checks'].Add($row)
    if(-not $Condition){throw $Name}
}
function Invoke-PublicApi {
    param([string]$Route,[string]$Method='GET',$Body=$null,[string]$Credential='',[int]$ExpectedStatus=200)
    if([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge $script:StopAt){throw 'Smoke test exceeded its bounded runtime'}
    if($Route -match '/advance(?:[/?]|$)'){throw 'Advance requests are prohibited'}
    $parameters=@{Uri=[Uri]::new($script:BaseOrigin,$Route);Method=$Method;TimeoutSec=15;MaximumRedirection=0;SkipHttpErrorCheck=$true;StatusCodeVariable='apiStatus'}
    if($Credential){$parameters['Headers']=@{Authorization='Bearer '+$Credential}}
    if($null -ne $Body){$parameters['ContentType']='application/json';$parameters['Body']=($Body|ConvertTo-Json -Compress -Depth 15)}
    $apiStatus=0
    try {$raw=Invoke-RestMethod @parameters}
    catch {throw "PowerShell public transport failure on $Method $Route"}
    if($raw -is [string] -or $null -eq $raw){throw "Non-JSON response HTTP $apiStatus on $Method $Route"}
    if([int]$apiStatus -ne $ExpectedStatus){throw "Unexpected HTTP $apiStatus on $Method $Route (expected $ExpectedStatus)"}
    $data=$raw|ConvertTo-Json -Depth 45 -Compress|ConvertFrom-Json -AsHashtable
    if($ExpectedStatus -lt 400 -and $data['ok'] -eq $false){throw "API rejected $Method $Route"}
    return $data
}
function Get-ExhaustedHealth([string]$Label) {
    $data=Invoke-PublicApi '/api/health'
    $safe=[ordered]@{status=$data['status'];storage=$data['storage'];online=$data['online'];ruleVersion=$data['ruleVersion'];host=[ordered]@{calls=$data['host']['calls'];limit=$data['host']['limit'];enabled=$data['host']['enabled'];configuredProvider=$data['host']['configuredProvider']}}
    Assert-Check ($data['status'] -eq 'ready' -and $data['storage'] -eq 'cloudflare-d1' -and $data['online'] -eq $true) "$Label`: shared deployed D1 is ready"
    Assert-Check ($data['host']['calls'] -eq 12 -and $data['host']['limit'] -eq 12) "$Label`: original budget is exhausted at exactly 12/12" $safe
    return $safe
}
function New-SeatClient($Data,[string]$Role,[string]$Authorization) {
    if(-not $Data['token'] -or -not $Data['agentToken'] -or -not $Data['state']['me']){throw 'Independent seat credentials were not returned'}
    [void]$script:Secrets.Add([string]$Data['token']);[void]$script:Secrets.Add([string]$Data['agentToken'])
    return [pscustomobject]@{Role=$Role;Authorization=$Authorization;Token=$Data['token'];AgentToken=$Data['agentToken'];Id=$Data['state']['me']['id'];Seat=$Data['state']['me']['seat']}
}
function Get-RoomPath($Table){return '/api/rooms/'+[Uri]::EscapeDataString($Table.Id)}
function New-SmokeTable([string]$Label) {
    $created=Invoke-PublicApi '/api/rooms' -Method POST -Body @{name="课堂烟测-$Label-手动1";mode='multiplayer';authorization='assist'} -ExpectedStatus 201
    $clients=[System.Collections.Generic.List[object]]::new()
    [void]$clients.Add((New-SeatClient $created 'manual-1' 'assist'))
    $safe=[ordered]@{label=$Label;roomId=$created['roomId'];roles=@('manual-1','manual-2','assist-protocol-agent','autopilot-protocol-agent');receipts=[System.Collections.Generic.List[object]]::new();polls=0;maxPollStartGapMs=0;lastPollStartMs=0}
    $table=[pscustomobject]@{Id=$created['roomId'];Label=$Label;Clients=$clients;Summary=$safe;State=$created['state']}
    [void]$script:Evidence['tables'].Add($safe)
    foreach($definition in @(@{role='manual-2';authorization='assist'},@{role='assist-protocol-agent';authorization='assist'},@{role='autopilot-protocol-agent';authorization='autopilot'})){
        $joined=Invoke-PublicApi ((Get-RoomPath $table)+'/join') -Method POST -Body @{name="课堂烟测-$Label-$($definition.role)";authorization=$definition.authorization} -ExpectedStatus 201
        [void]$clients.Add((New-SeatClient $joined $definition.role $definition.authorization))
    }
    Assert-Check (@($clients.Id|Sort-Object -Unique).Count -eq 4 -and @($clients.Token|Sort-Object -Unique).Count -eq 4 -and @($clients.Seat|Sort-Object -Unique).Count -eq 4) "$Label`: four independent human-seat credentials"
    foreach($client in $clients){
        $view=Invoke-PublicApi (Get-RoomPath $table) -Credential $client.Token
        Assert-Check ($view['state']['me']['id'] -eq $client.Id -and @($view['state']['players']).Count -eq 4 -and @($view['state']['players']|Where-Object {$_['isBot']}).Count -eq 0 -and $view['state']['phase'] -eq 'lobby') "$Label`: $($client.Role) reads the shared real multiplayer lobby"
    }
    foreach($client in @($clients[2],$clients[3])){
        $result=Invoke-PublicApi ((Get-RoomPath $table)+'/agent/check') -Credential $client.AgentToken
        Assert-Check ($result['connected'] -eq $true -and $result['scope'] -eq 'own-seat' -and $result['state']['me']['id'] -eq $client.Id -and $result['state']['me']['authorization'] -eq $client.Authorization) "$Label`: $($client.Role) completes real protocol self-check"
    }
    Write-SafeProgress 'table-created' @{table=$Label;roomId=$table.Id;seats=4}
    return $table
}
function Get-TestAction([string]$Id,$Catalog) {
    $definition=@($Catalog|Where-Object {$_['id'] -eq $Id})
    if($definition.Count -ne 1 -or @($definition[0]['scales']) -notcontains 1){throw "Standard action is unavailable: $Id"}
    $target=1;if($definition[0]['scope'] -eq 'all'){$target=0}
    return @{id=$Id;target=$target;scale=1}
}
function Test-SameAction($Left,$Right){return $null -ne $Left -and $Left['id'] -eq $Right['id'] -and [int]$Left['target'] -eq [int]$Right['target'] -and [double]$Left['scale'] -eq [double]$Right['scale']}
function Add-SafeReceipt($Table,[string]$Role,[string]$Step,$Receipt) {
    [void]$Table.Summary['receipts'].Add([ordered]@{role=$Role;step=$Step;status=$Receipt['status'];source=$Receipt['source'];round=$Receipt['round'];action=$Receipt['action'];cost=$Receipt['cost']})
}
function Send-TestAction($Table,$Client,[bool]$Agent,$Action) {
    $route=(Get-RoomPath $Table)+'/action';$credential=$Client.Token
    if($Agent){$route=(Get-RoomPath $Table)+'/agent/action';$credential=$Client.AgentToken}
    return Invoke-PublicApi $route -Method POST -Credential $credential -Body @{round=1;action=$Action;requestId=[Guid]::NewGuid().ToString();summary='课堂协议烟测固定动作；没有调用外部模型。'}
}
function Wait-Tables($Tables,[string]$Target) {
    $complete=$false;$lastProgress=@{}
    foreach($table in $Tables){$table.Summary['lastPollStartMs']=0}
    while(-not $complete){
        $cycleStart=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();$complete=$true
        foreach($table in $Tables){
            $state=$table.State
            $ready=if($Target -eq 'decision'){$state['round'] -eq 1 -and $state['phase'] -eq 'decision'}else{@($state['history']).Count -ge 1}
            if($ready){continue}
            $complete=$false;$now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            if($table.Summary['lastPollStartMs'] -gt 0){$table.Summary['maxPollStartGapMs']=[Math]::Max($table.Summary['maxPollStartGapMs'],$now-$table.Summary['lastPollStartMs'])}
            $table.Summary['lastPollStartMs']=$now
            $view=Invoke-PublicApi (Get-RoomPath $table) -Credential $table.Clients[0].Token
            $table.State=$view['state'];$table.Summary['polls']++
            $remaining=[Math]::Max(0,[Math]::Ceiling(($table.State['deadline']-$table.State['serverTime'])/1000))
            $key="$($table.State['phase']):$($table.State['round']):$([Math]::Ceiling($remaining/10))"
            if($lastProgress[$table.Label] -ne $key){Write-SafeProgress 'waiting' @{table=$table.Label;phase=$table.State['phase'];round=$table.State['round'];remainingSeconds=$remaining;for=$Target};$lastProgress[$table.Label]=$key}
        }
        if(-not $complete){$delay=[Math]::Max(0,$script:PollMs-([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-$cycleStart));if($delay -gt 0){Start-Sleep -Milliseconds $delay}}
    }
}
function Submit-FirstRound($Table,$Catalog) {
    $clients=$Table.Clients;$actions=@{}
    $actions[$clients[0].Id]=Get-TestAction 'A02' $Catalog;$actions[$clients[1].Id]=Get-TestAction 'A12' $Catalog
    $actions[$clients[2].Id]=Get-TestAction 'A10' $Catalog;$actions[$clients[3].Id]=Get-TestAction 'A03' $Catalog
    $Table|Add-Member -NotePropertyName ExpectedActions -NotePropertyValue $actions
    foreach($client in @($clients[0],$clients[1])){
        $result=Send-TestAction $Table $client $false $actions[$client.Id]
        Assert-Check ($result['receipt']['status'] -eq 'accepted' -and $result['receipt']['source'] -eq 'human' -and (Test-SameAction $result['receipt']['action'] $actions[$client.Id])) "$($Table.Label): $($client.Role) is accepted"
        Add-SafeReceipt $Table $client.Role 'manual' $result['receipt']
    }
    $assist=$clients[2];$view=Invoke-PublicApi ((Get-RoomPath $Table)+'/agent/state') -Credential $assist.AgentToken
    Assert-Check ($view['state']['me']['authorization'] -eq 'assist' -and $null -eq $view['state']['me']['action']) "$($Table.Label): assist reads its undecided seat"
    $suggestion=Send-TestAction $Table $assist $true $actions[$assist.Id]
    Assert-Check ($suggestion['receipt']['status'] -eq 'suggested' -and $suggestion['receipt']['source'] -eq 'agent' -and $null -eq $suggestion['state']['me']['action']) "$($Table.Label): assist stays a suggestion"
    Add-SafeReceipt $Table $assist.Role 'suggestion' $suggestion['receipt']
    $confirmation=Send-TestAction $Table $assist $false $actions[$assist.Id]
    Assert-Check ($confirmation['receipt']['status'] -eq 'accepted' -and $confirmation['receipt']['source'] -eq 'human' -and (Test-SameAction $confirmation['receipt']['action'] $actions[$assist.Id])) "$($Table.Label): owner confirms assist suggestion"
    Add-SafeReceipt $Table $assist.Role 'owner-confirmation' $confirmation['receipt']
    $autonomous=$clients[3];$view=Invoke-PublicApi ((Get-RoomPath $Table)+'/agent/state') -Credential $autonomous.AgentToken
    Assert-Check ($view['state']['me']['authorization'] -eq 'autopilot') "$($Table.Label): autonomous seat is authorized"
    $result=Send-TestAction $Table $autonomous $true $actions[$autonomous.Id]
    Assert-Check ($result['receipt']['status'] -eq 'accepted' -and $result['receipt']['source'] -eq 'agent' -and (Test-SameAction $result['receipt']['action'] $actions[$autonomous.Id])) "$($Table.Label): autonomous action is accepted directly"
    Add-SafeReceipt $Table $autonomous.Role 'autonomous' $result['receipt']
    $view=Invoke-PublicApi (Get-RoomPath $Table) -Credential $clients[0].Token;$Table.State=$view['state']
    Assert-Check ($Table.State['round'] -eq 1 -and @($Table.State['history']).Count -eq 0 -and @($Table.State['players']|Where-Object {-not $_['submitted']}).Count -eq 0) "$($Table.Label): four actions held without early settlement"
    Write-SafeProgress 'four-actions-accepted' @{table=$Table.Label;round=1}
}
function Confirm-FirstLedger($Table) {
    Assert-Check (@($Table.State['history']).Count -eq 1 -and $Table.State['history'][0]['round'] -eq 1 -and $Table.State['serverTime'] -ge $Table.Summary['decision']['deadline']) "$($Table.Label): exactly one round settled after its deadline"
    $canonical=$null;$ledger=$null
    foreach($client in $Table.Clients){
        $view=Invoke-PublicApi (Get-RoomPath $Table) -Credential $client.Token
        Assert-Check ($view['state']['me']['id'] -eq $client.Id -and @($view['state']['history']).Count -eq 1) "$($Table.Label): $($client.Role) reads its own view after one round"
        $serialized=$view['state']['history'][0]|ConvertTo-Json -Compress -Depth 30
        if($null -eq $canonical){$canonical=$serialized;$ledger=$view['state']['history'][0]}
        Assert-Check ($serialized -eq $canonical) "$($Table.Label): $($client.Role) has identical authoritative ledger"
        Assert-Check ($view['state']['god']['provider'] -eq 'template') "$($Table.Label): exhausted-budget narration is template"
    }
    $rows=[System.Collections.Generic.List[object]]::new()
    foreach($client in $Table.Clients){
        $row=@($ledger['players']|Where-Object {$_['seat'] -eq $client.Seat})
        Assert-Check ($row.Count -eq 1 -and (Test-SameAction $row[0]['action'] $Table.ExpectedActions[$client.Id])) "$($Table.Label): $($client.Role) settled its expected action"
        [void]$rows.Add([ordered]@{seat=$client.Seat;role=$client.Role;action=$row[0]['action'];cash=$row[0]['cash'];users=$row[0]['users'];profit=$row[0]['profit'];score=$row[0]['score']})
    }
    $hasher=[Security.Cryptography.SHA256]::Create()
    try {$digest=-join ($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical))|ForEach-Object {$_.ToString('x2')})}
    finally {$hasher.Dispose()}
    $Table.Summary['ledger']=[ordered]@{round=1;sha256=$digest;players=$rows};$Table.Summary['passed']=$true
    Write-SafeProgress 'table-passed' @{table=$Table.Label;settledRounds=1;matchingClients=4}
}

try {
    $parsed=[Uri]::new($BaseUrl)
    if($parsed.Scheme -ne 'https' -or $parsed.UserInfo -or $parsed.Query -or $parsed.Fragment -or $parsed.AbsolutePath -ne '/'){throw 'Supply only a public HTTPS origin without path, credentials, query or fragment'}
    $script:BaseOrigin=[Uri]::new($parsed.GetLeftPart([UriPartial]::Authority)+'/');$script:Evidence['origin']=$script:BaseOrigin.GetLeftPart([UriPartial]::Authority)
    # Preserve prior failed Node evidence instead of hiding its Cloudflare403.
    if(Test-Path -LiteralPath $script:EvidencePath){
        $previous=Get-Content -LiteralPath $script:EvidencePath -Raw|ConvertFrom-Json -AsHashtable
        if($previous['status'] -eq 'failed' -and -not $previous.Contains('transport')){
            $archive=Join-Path (Split-Path -Parent $script:EvidencePath) 'classroom-online-node-preflight.json'
            Copy-Item -LiteralPath $script:EvidencePath -Destination $archive
            $script:Evidence['priorNodeEvidence']='docs/evidence/classroom-online-node-preflight.json'
        }
    }
    Write-SafeProgress 'budget-preflight'
    $script:Evidence['initialHealth']=Get-ExhaustedHealth 'Initial preflight'
    $config=Invoke-PublicApi '/api/config'
    $tables=@((New-SmokeTable 'A'),(New-SmokeTable 'B'))
    for($i=0;$i -lt 2;$i++){
        $table=$tables[$i];$other=$tables[1-$i]
        $null=Invoke-PublicApi (Get-RoomPath $table) -Credential $other.Clients[0].Token -ExpectedStatus 403
        $null=Invoke-PublicApi ((Get-RoomPath $table)+'/agent/state') -Credential $other.Clients[2].AgentToken -ExpectedStatus 403
        $null=Invoke-PublicApi (Get-RoomPath $table) -ExpectedStatus 401
        Assert-Check $true "$($table.Label): cross-room human/Agent and unauthenticated access rejected"
    }
    $script:Evidence['beforeStartHealth']=Get-ExhaustedHealth 'Before starting either table'
    foreach($table in $tables){$started=Invoke-PublicApi ((Get-RoomPath $table)+'/start') -Method POST -Body @{} -Credential $table.Clients[0].Token;$table.State=$started['state']}
    Wait-Tables $tables 'decision'
    foreach($table in $tables){
        $window=$table.State['deadline']-$table.State['serverTime']
        Assert-Check ($table.State['round'] -eq 1 -and @($table.State['history']).Count -eq 0 -and $window -ge 43000 -and $window -le 45000) "$($table.Label): real approximately45-second production decision window"
        $table.Summary['decision']=[ordered]@{observedRemainingMs=$window;serverTime=$table.State['serverTime'];deadline=$table.State['deadline']}
        Submit-FirstRound $table $config['actions']
    }
    Wait-Tables $tables 'settlement'
    foreach($table in $tables){Confirm-FirstLedger $table}
    $script:Evidence['finalHealth']=Get-ExhaustedHealth 'Final health'
    Assert-Check ($script:Evidence['initialHealth']['host']['calls'] -eq $script:Evidence['finalHealth']['host']['calls']) 'Global usage remained12/12 with no budget reset'
    $script:Evidence['status']='passed'
    Write-SafeProgress 'passed' @{tables=2;seats=8;settledRoundsPerTable=1;modelCallsBefore=12;modelCallsAfter=12}
}
catch {
    $script:Evidence['status']='failed';$script:Evidence['error']=Protect-Text $_.Exception.Message
    Write-SafeProgress 'failed' @{message=$script:Evidence['error']}
}
finally {
    $script:Evidence['finishedAt']=[DateTime]::UtcNow.ToString('o')
    $serialized=$script:Evidence|ConvertTo-Json -Depth 45
    foreach($secret in $script:Secrets){$serialized=$serialized.Replace($secret,'[redacted]')}
    [void][IO.Directory]::CreateDirectory((Split-Path -Parent $script:EvidencePath))
    [IO.File]::WriteAllText($script:EvidencePath,$serialized+"`n",[Text.UTF8Encoding]::new($false))
    Write-SafeProgress 'evidence-written' @{path='docs/evidence/classroom-online-2tables.json';status=$script:Evidence['status']}
}
if($script:Evidence['status'] -ne 'passed'){exit 1}
