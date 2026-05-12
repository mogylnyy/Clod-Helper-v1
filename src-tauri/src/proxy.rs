use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProxyConfig {
    pub url: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub label: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ProxyCheckResult {
    pub reachable: bool,
    pub latency_ms: Option<u64>,
    pub status_code: Option<u16>,
    pub error: Option<String>,
}

pub fn parse(input: &str) -> Result<ProxyConfig, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Пустая строка".into());
    }
    let with_scheme = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("http://{trimmed}")
    };

    let parsed = Url::parse(&with_scheme).map_err(|e| format!("Не получилось разобрать URL: {e}"))?;

    let host = parsed
        .host_str()
        .ok_or_else(|| "В URL не указан адрес (host)".to_string())?
        .to_string();
    let port = parsed
        .port()
        .ok_or_else(|| "В URL не указан порт (например, :8000)".to_string())?;
    let username = parsed.username().to_string();
    let password = parsed.password().unwrap_or("").to_string();

    if username.is_empty() || password.is_empty() {
        return Err("В URL нет логина или пароля. Формат: http://user:pass@host:port".into());
    }

    Ok(ProxyConfig {
        url: with_scheme,
        host,
        port,
        username,
        password,
        label: "Основной".to_string(),
    })
}

pub async fn check(url: &str) -> ProxyCheckResult {
    let start = std::time::Instant::now();

    let proxy = match reqwest::Proxy::all(url) {
        Ok(p) => p,
        Err(e) => {
            return ProxyCheckResult {
                reachable: false,
                latency_ms: None,
                status_code: None,
                error: Some(format!("Неверный URL прокси: {e}")),
            }
        }
    };

    let client = match reqwest::Client::builder()
        .proxy(proxy)
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return ProxyCheckResult {
                reachable: false,
                latency_ms: None,
                status_code: None,
                error: Some(format!("Не удалось собрать клиент: {e}")),
            }
        }
    };

    match client.get("https://api.anthropic.com/").send().await {
        Ok(resp) => {
            let elapsed = start.elapsed().as_millis() as u64;
            let code = resp.status().as_u16();
            // Anthropic без auth отдаёт 401/403/404 — для нас это значит "прокси работает"
            let reachable = code < 500;
            ProxyCheckResult {
                reachable,
                latency_ms: Some(elapsed),
                status_code: Some(code),
                error: if reachable {
                    None
                } else {
                    Some(format!("Anthropic API вернул код {code}"))
                },
            }
        }
        Err(e) => {
            let msg = if e.is_timeout() {
                "Прокси не ответил за 10 секунд".to_string()
            } else if e.is_connect() {
                "Не удалось подключиться к прокси (проверьте адрес и порт)".to_string()
            } else {
                format!("Ошибка: {e}")
            };
            ProxyCheckResult {
                reachable: false,
                latency_ms: None,
                status_code: None,
                error: Some(msg),
            }
        }
    }
}
