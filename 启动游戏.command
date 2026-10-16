#!/bin/zsh
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.n/bin:/opt/homebrew/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo '请先安装 Node.js 22 或更新版本。'
  read '?按回车关闭'
  exit 1
fi
if [ ! -d node_modules ]; then npm ci; fi
echo '游戏正在启动。打开 http://127.0.0.1:5173/game/index.html'
echo '关闭此终端或按 Ctrl+C 可停止服务器。'
npm run dev
