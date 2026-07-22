$ErrorActionPreference = "Stop"
$helperRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Set-Location -LiteralPath $helperRoot

node server.js
