mod commands;
mod proxy;
mod system;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "clod_helper_lib=info".into()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::detect_node,
            commands::detect_python,
            commands::parse_proxy,
            commands::check_proxy,
            commands::run_install,
            commands::launch_claude_desktop,
            commands::launch_claude_code,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
