import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Splash } from "@/components/layout/Splash";
import { todayLocal } from "@/lib/dates";
import { buildDemoData } from "@/vault/demo";
import { useStartVault, useVault } from "@/vault/VaultProvider";

/** Opens the in-memory demo vault: sample data, no password, nothing written to this device. */
export default function Demo() {
  useStartVault();
  const { phase, service } = useVault();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (phase !== "ready" || !service || started.current) return;
    started.current = true;
    void service.openDemo((db) => buildDemoData(db, todayLocal())).then(() => navigate("/app", { replace: true }));
  }, [phase, service, navigate]);

  return <Splash message="Opening the demo vault…" />;
}
