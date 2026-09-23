@echo off
cd /d "C:\Users\arthu\segundo-cerebro"
if not exist logs mkdir logs
npx tsx scripts\run-plan-local.ts --cron >> logs\motor.log 2>&1
