export type InstallMode = "code" | "desktop" | "both";

export interface ProxyConfig {
  url: string;
  host: string;
  port: number;
  username: string;
  password: string;
  label: string;
}

export interface NodeInfo {
  installed: boolean;
  version?: string;
  npm_prefix?: string;
  prefix_in_program_files: boolean;
}

export interface PythonInfo {
  installed: boolean;
  version?: string;
  command?: string;
}

export interface ProxyCheckResult {
  reachable: boolean;
  latency_ms?: number;
  status_code?: number;
  error?: string;
  ip?: string;
  country_code?: string;
  country_name?: string;
  isp?: string;
}

export interface WizardState {
  step: WizardStep;
  mode: InstallMode | null;
  proxy: ProxyConfig | null;
  proxy_check: ProxyCheckResult | null;
  node: NodeInfo | null;
  python: PythonInfo | null;
  install_log: string[];
  install_done: boolean;
  install_error: string | null;
}

export type WizardStep =
  | "welcome"
  | "mode"
  | "proxy"
  | "deps"
  | "install"
  | "done";
