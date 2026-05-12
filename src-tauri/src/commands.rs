use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::proxy::{self, ProxyCheckResult, ProxyConfig};
use crate::system::{self, NodeInfo, PythonInfo};

#[tauri::command]
pub fn detect_node() -> NodeInfo {
    system::detect_node()
}

#[tauri::command]
pub fn detect_python() -> PythonInfo {
    system::detect_python()
}

#[tauri::command]
pub fn parse_proxy(url: String) -> Result<ProxyConfig, String> {
    proxy::parse(&url)
}

#[tauri::command]
pub async fn check_proxy(url: String) -> ProxyCheckResult {
    proxy::check(&url).await
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallMode {
    Code,
    Desktop,
    Both,
}

#[tauri::command]
pub async fn run_install(
    app: AppHandle,
    mode: InstallMode,
    proxy_url: String,
) -> Result<(), String> {
    // Validate proxy first — fail fast with a friendly message.
    proxy::parse(&proxy_url)?;

    let resources_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Не удалось найти папку ресурсов: {e}"))?;

    let code_ps1 = resources_dir.join("resources").join("claude-setup.ps1");
    let desktop_ps1 = resources_dir
        .join("resources")
        .join("claude-desktop-setup.ps1");

    let need_code = matches!(mode, InstallMode::Code | InstallMode::Both);
    let need_desktop = matches!(mode, InstallMode::Desktop | InstallMode::Both);

    if need_code {
        emit(&app, "▸ Устанавливаем Claude Code…");
        run_ps_script(&app, &code_ps1, &["-ProxyUrl", &proxy_url, "-Yes"]).await?;
        emit(&app, "✓ Claude Code установлен");
    }
    if need_desktop {
        emit(&app, "▸ Настраиваем Claude Desktop…");
        run_ps_script(&app, &desktop_ps1, &["-ProxyUrl", &proxy_url, "-Yes"]).await?;
        emit(&app, "✓ Claude Desktop настроен");
    }

    emit(&app, "");
    emit(&app, "✓ Всё готово!");
    Ok(())
}

fn emit(app: &AppHandle, line: impl Into<String>) {
    let _ = app.emit("install:log", line.into());
}

async fn run_ps_script(
    app: &AppHandle,
    script: &std::path::Path,
    args: &[&str],
) -> Result<(), String> {
    if !script.exists() {
        return Err(format!(
            "Не найден скрипт: {}. Переустановите Clod Helper.",
            script.display()
        ));
    }

    // Запускаем через -Command + ampersand-call вместо -File, чтобы можно было
    // слить Write-Host (Information stream) в stdout через "*>&1". Без этого UI
    // не видит ни одной строки скрипта, потому что Write-Host идёт в host, а
    // host у дочернего PowerShell — буферизирующий и недоступный родителю.
    let script_str = script.to_string_lossy().replace('\'', "''");
    let mut quoted_args = String::new();
    for a in args {
        let escaped = a.replace('\'', "''");
        quoted_args.push_str(&format!(" '{}'", escaped));
    }
    let command_line = format!("& '{}'{} *>&1", script_str, quoted_args);

    let ps_args: Vec<String> = vec![
        "-NoProfile".into(),
        "-NonInteractive".into(),
        "-ExecutionPolicy".into(),
        "Bypass".into(),
        "-Command".into(),
        command_line,
    ];

    let app_clone = app.clone();
    let result = tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new("powershell.exe");
        cmd.args(&ps_args).stdout(Stdio::piped()).stderr(Stdio::piped());
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        let mut child = cmd.spawn().map_err(|e| format!("powershell.exe не запустился: {e}"))?;

        if let Some(stdout) = child.stdout.take() {
            let app_inner = app_clone.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = app_inner.emit("install:log", line);
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            let app_inner = app_clone.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = app_inner.emit("install:log", format!("[err] {line}"));
                }
            });
        }

        let status = child
            .wait()
            .map_err(|e| format!("Не получилось дождаться скрипта: {e}"))?;
        if status.success() {
            Ok(())
        } else {
            Err(format!(
                "Скрипт завершился с кодом {}",
                status.code().unwrap_or(-1)
            ))
        }
    })
    .await
    .map_err(|e| format!("Внутренняя ошибка: {e}"))?;

    result
}
