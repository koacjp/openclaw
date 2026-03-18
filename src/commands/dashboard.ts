import { readConfigFileSnapshot, resolveGatewayPort } from "../config/config.js";
import { copyToClipboard } from "../infra/clipboard.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { formatCliCommand } from "../cli/command-format.js";
import {
  detectBrowserOpenSupport,
  formatControlUiSshHint,
  openUrl,
  probeGatewayReachable,
  resolveControlUiLinks,
  waitForGatewayReachable,
} from "./onboard-helpers.js";

type DashboardOptions = {
  noOpen?: boolean;
};

export async function dashboardCommand(
  runtime: RuntimeEnv = defaultRuntime,
  options: DashboardOptions = {},
) {
  const snapshot = await readConfigFileSnapshot();
  const cfg = snapshot.valid ? snapshot.config : {};
  const port = resolveGatewayPort(cfg);
  const bind = cfg.gateway?.bind ?? "loopback";
  const basePath = cfg.gateway?.controlUi?.basePath;
  const customBindHost = cfg.gateway?.customBindHost;
  const token = cfg.gateway?.auth?.token ?? process.env.OPENCLAW_GATEWAY_TOKEN ?? "";

  // LAN URLs fail secure-context checks in browsers.
  // Coerce only lan->loopback and preserve other bind modes.
  const links = resolveControlUiLinks({
    port,
    bind: bind === "lan" ? "loopback" : bind,
    customBindHost,
    basePath,
  });
  // Prefer URL fragment to avoid leaking auth tokens via query params.
  const dashboardUrl = token
    ? `${links.httpUrl}#token=${encodeURIComponent(token)}`
    : links.httpUrl;

  runtime.log(`Dashboard URL: ${dashboardUrl}`);

  const copied = await copyToClipboard(dashboardUrl).catch(() => false);
  runtime.log(copied ? "Copied to clipboard." : "Copy to clipboard unavailable.");

  // Quick probe to check if gateway is already up.
  const quickProbe = await probeGatewayReachable({
    url: links.wsUrl,
    token: token || undefined,
    timeoutMs: 1_000,
  });

  // If gateway is not reachable, wait a bit to handle the case where it is
  // still starting up. If it never becomes reachable, abort with a clear error.
  if (!quickProbe.ok) {
    runtime.log("Gateway not detected. Waiting for it to start (up to 10s)...");
    const waited = await waitForGatewayReachable({
      url: links.wsUrl,
      token: token || undefined,
      deadlineMs: 10_000,
      pollMs: 400,
      probeTimeoutMs: 1_500,
    });
    if (!waited.ok) {
      runtime.log(
        [
          "Gateway is not running. Start it first:",
          `  ${formatCliCommand("openclaw gateway run")}`,
          "Then open the dashboard again:",
          `  ${formatCliCommand("openclaw dashboard")}`,
        ].join("\n"),
      );
      return;
    }
  }

  let opened = false;
  let hint: string | undefined;
  if (!options.noOpen) {
    const browserSupport = await detectBrowserOpenSupport();
    if (browserSupport.ok) {
      opened = await openUrl(dashboardUrl);
    }
    if (!opened) {
      hint = formatControlUiSshHint({
        port,
        basePath,
        token: token || undefined,
      });
    }
  } else {
    hint = "Browser launch disabled (--no-open). Use the URL above.";
  }

  if (opened) {
    runtime.log("Opened in your browser. Keep that tab to control OpenClaw.");
  } else if (hint) {
    runtime.log(hint);
  }
}
