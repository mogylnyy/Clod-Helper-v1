import { invoke } from "@tauri-apps/api/core";
import type {
  NodeInfo,
  ProxyCheckResult,
  ProxyConfig,
  PythonInfo,
} from "./types";

export async function detectNode(): Promise<NodeInfo> {
  return invoke<NodeInfo>("detect_node");
}

export async function detectPython(): Promise<PythonInfo> {
  return invoke<PythonInfo>("detect_python");
}

export async function parseProxy(url: string): Promise<ProxyConfig> {
  return invoke<ProxyConfig>("parse_proxy", { url });
}

export async function checkProxy(url: string): Promise<ProxyCheckResult> {
  return invoke<ProxyCheckResult>("check_proxy", { url });
}

export async function runInstall(params: {
  mode: "code" | "desktop" | "both";
  proxy_url: string;
}): Promise<void> {
  return invoke<void>("run_install", params);
}
