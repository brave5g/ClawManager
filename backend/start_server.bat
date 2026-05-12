@echo off
cd /d "d:\openclaw\ClawManager-main\ClawManager\backend"
go run cmd/server/main.go > server.log 2>&1