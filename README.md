# Clod Helper

Десктопная утилита для установки **Claude Code (CLI)** и **Claude Desktop** через купленный HTTP-прокси. Нужна в регионах где Anthropic API заблокирован напрямую.

Tauri 2 + React 19 + Tailwind 4. Под капотом — обёртка над PowerShell-скриптами, прокинутыми в bundle.

## Для пользователя

1. Скачайте `Clod_Helper_*.exe` (NSIS-installer).
2. **Перед запуском:** ПКМ по файлу → Свойства → внизу галочка «Разблокировать» → ОК.
3. Двойной клик. Если Windows предупредит — нажмите «Подробнее» → «Выполнить в любом случае».
4. Дальше — 5 экранов мастера: выбор режима → ввод прокси → проверка зависимостей → установка.

Программа **легальная, без подписи** — Windows перестраховывается.

## Для разработчика

```powershell
# Один раз
npm install

# Разработка (горячая перезагрузка + Rust)
npm run tauri dev

# Релизный билд → .exe в src-tauri/target/release/bundle/nsis/
npm run tauri build
```

### Структура

```
src/                       — React (TypeScript) frontend
  wizard/                  — 5 шагов мастера
  components/              — общие компоненты (Button, WizardShell)
  lib/                     — типы, API к Rust, утилиты
src-tauri/                 — Rust backend
  src/commands.rs          — Tauri-команды
  src/proxy.rs             — парсинг + проверка прокси через reqwest
  src/system.rs            — детект Node/Python
  resources/               — bundled .ps1 + .py
  tauri.conf.json          — bundle-метаданные (VersionInfo для Defender)
```

### Anti-Defender тактики (применены)

- `tauri.conf.json` → `publisher`, `copyright`, `category`, `shortDescription` заполнены
- `Cargo.toml` → `lto=true`, `strip=true`, `opt-level="s"` (без UPX!)
- bundle target = только `nsis` (НЕ Startup folder)
- Submit каждого билда в https://www.microsoft.com/wdsi/filesubmission за 48ч до раздачи
- Раздача через Telegram (не ставит MOTW)

## TODO (post-MVP)

- [ ] Native Rust HTTP-bridge на `hudsucker` — заменить Python-скрипт (только если друзья жалуются)
- [ ] Несколько прокси + ротация
- [ ] System tray + auto-failover
- [ ] Tauri auto-updater (нужен code-signing)
