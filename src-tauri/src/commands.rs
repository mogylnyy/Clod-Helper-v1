use std::io::Write;
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

    emit_verbose(
        &app,
        format!("⓵ Полный лог: {}", log_path.display()),
    );

    let resources_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Не удалось найти папку ресурсов: {e}"))?;
    log_line(&log_file, &format!("resource_dir = {}", resources_dir.display()));
    emit_verbose(&app, format!("⓶ resources_dir = {}", resources_dir.display()));

    // ─── DIAGNOSTIC: prove powershell.exe actually works from this process ──
    // (verbose-only — hidden from default UI; still written to file log)
    emit_verbose(&app, "");
    emit_verbose(&app, "── ДИАГНОСТИКА ──");
    log_line(&log_file, "--- diagnostic ---");
    run_diagnostic(&app, &log_file).await;
    emit_verbose(&app, "── /ДИАГНОСТИКА ──");
    emit_verbose(&app, "");

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
    emit_verbose(&app, format!("⓷ code_ps1    = {}", code_ps1.display()));
    emit_verbose(&app, format!("⓸ desktop_ps1 = {}", desktop_ps1.display()));

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

fn emit_verbose(app: &AppHandle, line: impl Into<String>) {
    let _ = app.emit("install:log", format!("__verbose__:{}", line.into()));
}

async fn run_diagnostic(
    app: &AppHandle,
    log_file: &Arc<Mutex<Option<std::fs::File>>>,
) {
    let app_c = app.clone();
    let log_c = log_file.clone();
    let _ = tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new("powershell.exe");
        cmd.args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Write-Output 'D1: hello from powershell'; \
             Write-Output ('D2: PSVersion = ' + $PSVersionTable.PSVersion.ToString()); \
             Write-Output ('D3: ExecutionPolicy = ' + (Get-ExecutionPolicy -Scope Process) + ' / ' + (Get-ExecutionPolicy -Scope CurrentUser) + ' / ' + (Get-ExecutionPolicy -Scope LocalMachine)); \
             Write-Output ('D4: script exists = ' + (Test-Path 'C:\\clod-helper\\src-tauri\\target\\debug\\resources\\claude-desktop-setup.ps1')); \
             Write-Output ('D5: pwd = ' + (Get-Location).Path); \
             Write-Output 'D6: done'",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        let output = cmd.output();
        match output {
            Ok(o) => {
                let out = String::from_utf8_lossy(&o.stdout);
                let err = String::from_utf8_lossy(&o.stderr);
                for line in out.lines() {
                    emit_verbose(&app_c, line.to_string());
                    log_line(&log_c, line);
                }
                for line in err.lines() {
                    let tagged = format!("[stderr] {line}");
                    emit_verbose(&app_c, tagged.clone());
                    log_line(&log_c, &tagged);
                }
                let s = format!(
                    "[diag-exit] code={:?}, stdout_bytes={}, stderr_bytes={}",
                    o.status.code(),
                    o.stdout.len(),
                    o.stderr.len()
                );
                emit_verbose(&app_c, s.clone());
                log_line(&log_c, &s);
            }
            Err(e) => {
                let s = format!("[diag-error] {e}");
                emit_verbose(&app_c, s.clone());
                log_line(&log_c, &s);
            }
        }
    })
    .await;
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

    // Use -Command with a UTF-8 prelude so Cyrillic Write-Host output isn't
    // mangled to OEM (cp866) when there's no real console host attached.
    // We escape the script path and only quote VALUE args (flag names like
    // -ProxyUrl must remain bare or PowerShell binds them positionally).
    let script_escaped = cleaned.replace('\'', "''");
    let mut tail = String::new();
    for a in args {
        if a.starts_with('-') {
            tail.push(' ');
            tail.push_str(a);
        } else {
            let escaped = a.replace('\'', "''");
            tail.push_str(&format!(" '{escaped}'"));
        }
    }
    let command_line = format!(
        "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; \
         $OutputEncoding=[System.Text.Encoding]::UTF8; \
         $ErrorActionPreference='Continue'; \
         & '{script_escaped}'{tail}; \
         exit $LASTEXITCODE"
    );

    let mut ps_args: Vec<String> = vec![
        "-NoProfile".into(),
        "-NonInteractive".into(),
        "-ExecutionPolicy".into(),
        "Bypass".into(),
        "-OutputFormat".into(),
        "Text".into(),
        "-Command".into(),
        command_line.clone(),
    ];
    // Avoid unused warning if future refactor drops args.
    let _ = &mut ps_args;

    let exec_repr = format!("powershell.exe -Command {command_line}");
    log_line(log_file, &format!("[exec] {exec_repr}"));
    emit_verbose(app, format!("[exec] {exec_repr}"));

    // Use synchronous full capture via .output() instead of streaming. Reason:
    // when PowerShell finishes very quickly (e.g. fails on early validation),
    // the streaming reader thread can be torn down before drainage completes,
    // resulting in stdout_lines=1 / "empty" output despite real content. With
    // .output() we get the entire stdout/stderr atomically AFTER the child
    // exited — no race possible. Cost: no live-streaming progress; the user
    // sees the full output as one block. Acceptable for ~2-3 second scripts.
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

        let output = cmd.output().map_err(|e| {
            let msg = format!("powershell.exe не запустился: {e}");
            log_line(&log_clone, &msg);
            msg
        })?;

        // Windows PowerShell 5.1 outputs in OEM/UTF-16-with-BOM depending on
        // console. Try UTF-8 first, then UTF-16 LE/BE, then fall back to lossy.
        let stdout_text = decode_ps_output(&output.stdout);
        let stderr_text = decode_ps_output(&output.stderr);

        let mut n_out: u64 = 0;
        for line in stdout_text.lines() {
            n_out += 1;
            log_line(&log_clone, line);
            let _ = app_clone.emit("install:log", line.to_string());
        }
        let mut n_err: u64 = 0;
        for line in stderr_text.lines() {
            n_err += 1;
            let tagged = format!("[stderr] {line}");
            log_line(&log_clone, &tagged);
            emit_verbose(&app_clone, tagged);
        }

        let code = output.status.code().unwrap_or(-1);
        let summary = format!(
            "[exit] code={code}, stdout_lines={n_out}, stderr_lines={n_err}, stdout_bytes={}, stderr_bytes={}",
            output.stdout.len(),
            output.stderr.len()
        );
        log_line(&log_clone, &summary);
        emit_verbose(&app_clone, summary);

        if output.status.success() {
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

fn decode_ps_output(bytes: &[u8]) -> String {
    if bytes.is_empty() {
        return String::new();
    }
    // UTF-8 BOM
    let payload = if bytes.len() >= 3
        && bytes[0] == 0xEF
        && bytes[1] == 0xBB
        && bytes[2] == 0xBF
    {
        &bytes[3..]
    } else {
        bytes
    };
    String::from_utf8_lossy(payload).into_owned()
}
