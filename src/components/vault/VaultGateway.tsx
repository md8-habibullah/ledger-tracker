import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface VaultGatewayProps {
  children: React.ReactNode;
}

/**
 * VaultGateway component that checks if the vault has been initialized.
 * If not, redirects to the landing page. Otherwise, renders the children.
 */
export const VaultGateway = ({ children }: VaultGatewayProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const vaultInitialized = localStorage.getItem("vault_initialized");

    // If vault is not initialized and user is not on landing page, redirect to landing
    if (!vaultInitialized && location.pathname !== "/landing") {
      navigate("/landing", { replace: true });
    }
  }, [navigate, location.pathname]);

  return <>{children}</>;
};
