# Lane H2b (H2b-8): an advisory intelligibility check with the Windows recognizer (System.Speech, offline).
# For each wav, a closed grammar of phrases (the right one plus every other line of the language and the known
# mis-hearings) — the recognizer must pick the right phrase. It does not replace the owner's ear.
#   powershell -File asr-choice.ps1 -culture zh-CN -choices "a|b|c" -list files.txt
param([string]$culture, [string]$choices, [string]$list)
Add-Type -AssemblyName System.Speech
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ci = New-Object System.Globalization.CultureInfo($culture)
$ch = New-Object System.Speech.Recognition.Choices
foreach ($c in $choices.Split('|')) { $ch.Add($c) }
foreach ($f in (Get-Content -Encoding UTF8 $list)) {
  if (-not $f) { continue }
  $gb = New-Object System.Speech.Recognition.GrammarBuilder
  $gb.Culture = $ci
  $gb.Append($ch)
  $g = New-Object System.Speech.Recognition.Grammar($gb)
  $eng = New-Object System.Speech.Recognition.SpeechRecognitionEngine($ci)
  $eng.LoadGrammar($g)
  $eng.SetInputToWaveFile($f)
  $out = ""
  try {
    $r = $eng.Recognize()
    if ($r -ne $null) { $out = "{0}`t{1:N2}" -f $r.Text, $r.Confidence } else { $out = "-`t0" }
  } catch { $out = "ERR`t0" }
  $eng.Dispose()
  Write-Output ((Split-Path $f -Leaf) + "`t" + $out)
}
