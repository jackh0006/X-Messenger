@echo off
REM SPDX-License-Identifier: MIT
REM X Messenger Windows launcher (no admin, portable).
REM Usage: x-messenger.cmd gui | setup | encrypt ... | version
setlocal
set "HERE=%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo X Messenger needs Node.js 18+ on PATH. Install Node 20 LTS from nodejs.org, then retry.
  exit /b 2
)
node "%HERE%app\bin\cipherlink" %*
