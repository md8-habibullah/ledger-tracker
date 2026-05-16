import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthContext";

interface VaultGatewayProps {
  children: React.ReactNode;
}

/**
 * VaultGateway component that enforces the vault routing state machine:
 * 1. If vault not initialized: redirect to /landing
 * 2. If vault locked (isLocked = true): redirect to /login
 * 3. If vault unlocked: allow access to protected routes
 */
export const VaultGateway = ({ children }: VaultGatewayProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { vaultInitialized, isLocked, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const currentPath = location.pathname;

    // Allow landing page and login page to be accessed without restrictions
    if (currentPath === "/landing" || currentPath === "/login") {
      return;
    }

    // If vault is not initialized, redirect to landing
    if (!vaultInitialized) {
      navigate("/landing", { replace: true });
      return;
    }

    // If vault is locked, redirect to login
    if (isLocked) {
      navigate("/login", { replace: true });
      return;
    }

    // All checks passed - allow access to the requested route
  }, [navigate, location.pathname, vaultInitialized, isLocked, isLoading]);

  return <>{children}</>;
};
