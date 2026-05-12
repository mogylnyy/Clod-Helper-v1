import { useState } from "react";
import { WizardShell } from "./components/WizardShell";
import { StepWelcome } from "./wizard/StepWelcome";
import { StepMode } from "./wizard/StepMode";
import { StepProxy } from "./wizard/StepProxy";
import { StepDeps } from "./wizard/StepDeps";
import { StepInstall } from "./wizard/StepInstall";
import type {
  InstallMode,
  NodeInfo,
  ProxyCheckResult,
  ProxyConfig,
  PythonInfo,
  WizardStep,
} from "./lib/types";

function App() {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [mode, setMode] = useState<InstallMode | null>(null);
  const [proxy, setProxy] = useState<ProxyConfig | null>(null);
  const [proxyCheck, setProxyCheck] = useState<ProxyCheckResult | null>(null);
  const [node, setNode] = useState<NodeInfo | null>(null);
  const [python, setPython] = useState<PythonInfo | null>(null);

  return (
    <WizardShell step={step}>
      {step === "welcome" && (
        <StepWelcome onNext={() => setStep("mode")} />
      )}
      {step === "mode" && (
        <StepMode
          value={mode}
          onChange={setMode}
          onBack={() => setStep("welcome")}
          onNext={() => setStep("proxy")}
        />
      )}
      {step === "proxy" && (
        <StepProxy
          proxy={proxy}
          check={proxyCheck}
          onChange={(p, c) => {
            setProxy(p);
            setProxyCheck(c);
          }}
          onBack={() => setStep("mode")}
          onNext={() => setStep("deps")}
        />
      )}
      {step === "deps" && mode && (
        <StepDeps
          mode={mode}
          node={node}
          python={python}
          onChange={(n, p) => {
            setNode(n);
            setPython(p);
          }}
          onBack={() => setStep("proxy")}
          onNext={() => setStep("install")}
        />
      )}
      {step === "install" && mode && proxy && (
        <StepInstall
          mode={mode}
          proxyUrl={proxy.url}
          onBack={() => setStep("deps")}
          onDone={() => {
            window.close();
          }}
          onRestartWithCode={
            mode === "desktop"
              ? () => {
                  setMode("code");
                  setStep("mode");
                }
              : undefined
          }
        />
      )}
    </WizardShell>
  );
}

export default App;
