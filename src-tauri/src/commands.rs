use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

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

    // Open a debug log file so we can read what actually happened even if the
    // UI shows nothing. Path is shown to the user too.
    let log_path = std::env::temp_dir().join("clod-helper-install.log");
    let log_file = Arc::new(Mutex::new(
        std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .ok(),
    ));
    log_line(&log_file, "");
    log_line(&log_file, "════════════════════════════════════════════");
    log_line(
        &log_file,
        &format!("run_install started at {:?}", std::time::SystemTime::now()),
    );
    log_line(&log_file, &format!("proxy_url = {proxy_url}"));

    emit(
        &app,
        format!("⓵ Полный лог: {}", log_path.display()),
    );

    let resources_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Не удалось найти папку ресурсов: {e}"))?;
    log_line(&log_file, &format!("resource_dir = {}", resources_dir.display()));
    emit(&app, format!("⓶ resources_dir = {}", resources_dir.display()));

    let code_ps1 = resources_dir.join("resources").join("claude-setup.ps1");
    let desktop_ps1 = resources_dir
        .join("resources")
        .join("claude-desktop-setup.ps1");

    // Если запустили из dev — папка `resources/` лежит не внутри resource_dir
    // (которая указывает на target/debug/), а в src-tauri/resources/. Делаем
    // fallback на CARGO_MANIFEST_DIR.
    let code_ps1 = ensure_exists(code_ps1, "resources/claude-setup.ps1");
    let desktop_ps1 = ensure_exists(desktop_ps1, "resources/claude-desktop-setup.ps1");

    log_line(&log_file, &format!("code_ps1     = {}", code_ps1.display()));
    log_line(&log_file, &format!("desktop_ps1  = {}", desktop_ps1.display()));
    emit(&app, format!("⓷ code_ps1    = {}", code_ps1.display()));
    emit(&app, format!("⓸ desktop_ps1 = {}", desktop_ps1.display()));

    let need_code = matches!(mode, InstallMode::Code | InstallMode::Both);
    let need_desktop = matches!(mode, InstallMode::Desktop | InstallMode::Both);

    if need_code {
        emit(&app, "");
        emit(&app, "▸ Устанавливаем Claude Code…");
        log_line(&log_file, "--- claude-setup.ps1 ---");
        run_ps_script(
            &app,
            &log_file,
            &code_ps1,
            &["-ProxyUrl", &proxy_url, "-Yes"],
        )
        .await?;
        emit(&app, "✓ Claude Code установлен");
    }
    if need_desktop {
        emit(&app, "");
        emit(&app, "▸ Настраиваем Claude Desktop…");
        log_line(&log_file, "--- claude-desktop-setup.ps1 ---");
        run_ps_script(
            &app,
            &log_file,
            &desktop_ps1,
            &["-ProxyUrl", &proxy_url, "-Yes"],
        )
        .await?;
        emit(&app, "✓ Claude Desktop настроен");
    }

    emit(&app, "");
    emit(&app, "✓ Всё готово!");
    log_line(&log_file, "run_install completed OK");
    Ok(())
}

fn ensure_exists(primary: std::path::PathBuf, relative: &str) -> std::path::PathBuf {
    if primary.exists() {
        return primary;
    }
    // Fallback to source-tree path used during `tauri dev`.
    let manifest = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dev_path = manifest.join(relative);
    if dev_path.exists() {
        return dev_path;
    }
    primary
}

fn log_line(file: &Arc<Mutex<Option<std::fs::File>>>, text: &str) {
    if let Ok(mut guard) = file.lock() {
        if let Some(f) = guard.as_mut() {
            let _ = writeln!(f, "{text}");
        }
    }
}

fn emit(app: &AppHandle, line: impl Into<String>) {
    let _ = app.emit("install:log", line.into());
}

async fn run_ps_script(
    app: &AppHandle,
    log_file: &Arc<Mutex<Option<std::fs::File>>>,
    script: &std::path::Path,
    args: &[&str],
) -> Result<(), String> {
    if !script.exists() {
        let msg = format!(
            "Не найден скрипт: {}. Переустановите Clod Helper.",
            script.display()
        );
        log_line(log_file, &msg);
        return Err(msg);
    }

    // Tauri's resource_dir() returns Windows UNC-extended paths like
    // `\\?\C:\...`. PowerShell refuses those — strip the prefix so the script
    // is invoked with a plain drive path.
    let raw = script.to_string_lossy();
    let cleaned = raw
        .strip_prefix(r"\\?\UNC\")
        .map(|s| format!(r"\\{s}"))
        .or_else(|| raw.strip_prefix(r"\\?\").map(String::from))
        .unwrap_or_else(|| raw.to_string());

    // Use -File mode (the script is in our trusted bundle). Args pass through
    // natively, no quoting dance with `-Command`. `Write-Host` would normally
    // bypass stdout, but we wrap the invocation with $InformationPreference=
    // Continue + 4>&1 *>&1 inside -Command... actually -Command is what bit
    // us last time. Trick: redirect host output by also using -OutputFormat
    // Text and piping host stream through Tee-Object... too much.
    //
    // Simpler approach that ACTUALLY works in CREATE_NO_WINDOW spawn: run
    // with -File, and rely on the fact that our scripts use Write-Host which
    // PowerShell 5.1 directs to the information stream — and since 5.1
    // launched without a real host, that stream IS written to stdout.
    let mut ps_args: Vec<String> = vec![
        "-NoProfile".into(),
        "-NonInteractive".into(),
        "-ExecutionPolicy".into(),
        "Bypass".into(),
        "-File".into(),
        cleaned.clone(),
    ];
    for a in args {
        ps_args.push((*a).to_string());
    }

    let exec_repr = format!(
        "powershell.exe -File '{}' {}",
        cleaned,
        args.join(" ")
    );
    log_line(log_file, &format!("[exec] {exec_repr}"));
    emit(app, format!("[exec] {exec_repr}"));

    let app_clone = app.clone();
    let log_clone = log_file.clone();
    let result = tokio::task::spawn_blocking(move || -> Result<(), String> {
        let mut cmd = Command::new("powershell.exe");
        cmd.args(&ps_args).stdout(Stdio::piped()).stderr(Stdio::piped());
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        let mut child = cmd.spawn().map_err(|e| {
            let msg = format!("powershell.exe не запустился: {e}");
            log_line(&log_clone, &msg);
            msg
        })?;

        let stdout_count = Arc::new(Mutex::new(0u64));
        let stderr_count = Arc::new(Mutex::new(0u64));

        let stdout_handle = if let Some(stdout) = child.stdout.take() {
            let app_inner = app_clone.clone();
            let log_inner = log_clone.clone();
            let count = stdout_count.clone();
            Some(std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    if let Ok(mut n) = count.lock() {
                        *n += 1;
                    }
                    log_line(&log_inner, &line);
                    let _ = app_inner.emit("install:log", line);
                }
            }))
        } else {
            None
        };

        let stderr_handle = if let Some(stderr) = child.stderr.take() {
            let app_inner = app_clone.clone();
            let log_inner = log_clone.clone();
            let count = stderr_count.clone();
            Some(std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines().map_while(Result::ok) {
                    if let Ok(mut n) = count.lock() {
                        *n += 1;
                    }
                    let tagged = format!("[stderr] {line}");
                    log_line(&log_inner, &tagged);
                    let _ = app_inner.emit("install:log", tagged);
                }
            }))
        } else {
            None
        };

        let status = child.wait().map_err(|e| {
            let msg = format!("Не получилось дождаться скрипта: {e}");
            log_line(&log_clone, &msg);
            msg
        })?;

        if let Some(h) = stdout_handle {
            let _ = h.join();
        }
        if let Some(h) = stderr_handle {
            let _ = h.join();
        }

        let n_out = stdout_count.lock().map(|g| *g).unwrap_or(0);
        let n_err = stderr_count.lock().map(|g| *g).unwrap_or(0);
        let code = status.code().unwrap_or(-1);

        let summary = format!(
            "[exit] code={code}, stdout_lines={n_out}, stderr_lines={n_err}"
        );
        log_line(&log_clone, &summary);
        let _ = app_clone.emit("install:log", summary);

        if status.success() {
            Ok(())
        } else {
            Err(format!(
                "Скрипт завершился с кодом {code} (см. полный лог в файле)"
            ))
        }
    })
    .await
    .map_err(|e| format!("Внутренняя ошибка: {e}"))?;

    result
}
