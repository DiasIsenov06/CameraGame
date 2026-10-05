@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Gesture Drive
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the LTS version, then run START-GAME.bat again.
  echo https://nodejs.org/
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)
node scripts\start-game.mjs
if errorlevel 1 pause
