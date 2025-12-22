import { ReactNode, useState } from 'react';
import { Sidebar, navItems } from './Sidebar'; // Import navItems
import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"; // Import Sheet components
import { Button } from "@/components/ui/button";
import { Menu, Wallet } from "lucide-react";
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Background grid pattern */}
      <div
        className="fixed inset-0 bg-grid-pattern opacity-5 pointer-events-none"
        style={{ backgroundSize: '50px 50px' }}
      />

      {/* Gradient orbs */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-secondary/5 blur-[100px] pointer-events-none" />

      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
            <Wallet className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold">Ledger Tracker</span>
        </div>

        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] bg-sidebar border-r border-border/50 p-0">
            <div className="flex h-full flex-col">
              {/* Mobile Menu Logo */}
              <div className="flex h-16 items-center gap-3 border-b border-border/50 px-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary">
                  <Wallet className="h-5 w-5 text-primary-foreground" />
                </div>
                <NavLink to="/" onClick={() => setIsMobileOpen(false)}>
                  <div>
                    <h1 className="text-lg font-semibold text-gradient">Ledger Tracker</h1>
                    <p className="text-xs text-muted-foreground">Secure Finance</p>
                  </div>
                </NavLink>
              </div>

              {/* Mobile Menu Links */}
              <nav className="flex-1 space-y-1 p-4">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn(
                        "h-5 w-5 transition-colors",
                        isActive && "text-primary"
                      )} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content Area - Updated margins */}
      <main className="md:ml-64 min-h-screen transition-all duration-300">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="p-4 md:p-8" // Smaller padding on mobile
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}