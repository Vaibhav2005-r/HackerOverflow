@echo off
cd /d "%~dp0"
where python >nul 2>nul && (python serve.py %1 & goto :eof)
where node >nul 2>nul && (npx --yes serve -s apps\web\dist -l 4173 & goto :eof)
echo Need Python 3 or Node.js to serve apps\web\dist
