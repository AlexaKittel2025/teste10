@echo off
echo Cleaning Next.js cache...
if exist ".next" (
  rmdir /s /q .next
  echo Cache cleaned successfully.
) else (
  echo No cache found, continuing...
)

echo Setting up environment variables...
set NEXT_WEBPACK_DISABLE_COMPRESSION=true
set CHOKIDAR_USEPOLLING=true
set WATCHPACK_POLLING=true
set NODE_OPTIONS=--max-old-space-size=4096

echo Starting Next.js development server...
npx.cmd next dev