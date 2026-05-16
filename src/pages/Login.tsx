import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Wallet, AlertTriangle, Trash2 } from 'lucide-react';
import { getDb, saveDb, type Transaction, type Category, type Budget } from '@/db';

const Login: React.FC = () => {
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNukeWarning, setShowNukeWarning] = useState(false);
  const [nukeConfirmText, setNukeConfirmText] = useState('');
  const [showNukeCountdown, setShowNukeCountdown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(10);
  
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = location.state?.from?.pathname || '/';

  // Countdown timer effect
  React.useEffect(() => {
    if (!showNukeCountdown) return;
    
    if (countdownValue <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setCountdownValue(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showNukeCountdown, countdownValue]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const success = await login(loginUsername, loginPassword);
    setIsLoading(false);
    
    if (success) {
      toast({
        title: "Vault unlocked!",
        description: "Successfully unlocked your vault.",
      });
      navigate(from, { replace: true });
    } else {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: "Invalid username or password.",
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const success = await register(regUsername, regPassword);
    setIsLoading(false);
    
    if (success) {
      toast({
        title: "Vault created!",
        description: "Your encrypted vault has been created.",
      });
      navigate(from, { replace: true });
    } else {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: "Username might already be taken.",
      });
    }
  };

  const handleNukeStep1Confirm = () => {
    if (nukeConfirmText.toUpperCase() === 'DELETE') {
      setShowNukeWarning(false);
      setNukeConfirmText('');
      setShowNukeCountdown(true);
      setCountdownValue(10);
    } else {
      toast({
        variant: "destructive",
        title: "Invalid input",
        description: "Please type 'DELETE' to proceed.",
      });
    }
  };

  const handleNukeStep2Confirm = async () => {
    try {
      const db = await getDb();
      
      // Drop all tables
      const tables = ['transactions', 'categories', 'budgets', 'users'];
      for (const table of tables) {
        try {
          db.run(`DROP TABLE IF EXISTS ${table}`);
        } catch (e) {
          // Table might not exist, continue
        }
      }
      
      await saveDb();
      
      // Clear all localStorage
      localStorage.clear();
      
      toast({
        title: "Vault destroyed",
        description: "All data has been permanently deleted. Redirecting to initialization...",
      });
      
      // Reset state and redirect
      setTimeout(() => {
        navigate('/landing', { replace: true });
      }, 1000);
    } catch (error) {
      console.error('Nuke sequence error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reset vault. Please try again.",
      });
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">LedgerTracker</h1>
          <p className="text-muted-foreground">Manage your expenses with ease and security</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          {/* Reset/Forgot Password Link */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowNukeWarning(true)}
              className="text-sm text-red-500 hover:text-red-400 font-medium transition"
            >
              Forgot password? Destructive Reset
            </button>
          </div>
          
          <TabsContent value="login">
            <Card className="border-none shadow-xl">
              <CardHeader>
                <CardTitle>Sign In</CardTitle>
                <CardDescription>Enter your credentials to access your account</CardDescription>
              </CardHeader>
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username" 
                      placeholder="johndoe" 
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required 
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" type="submit" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
          
          <TabsContent value="register">
            <Card className="border-none shadow-xl">
              <CardHeader>
                <CardTitle>Create Account</CardTitle>
                <CardDescription>Sign up for a new account to start tracking</CardDescription>
              </CardHeader>
              <form onSubmit={handleRegister}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-username">Username</Label>
                    <Input 
                      id="reg-username" 
                      placeholder="johndoe" 
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input 
                      id="reg-password" 
                      type="password" 
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required 
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" type="submit" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Nuke Sequence - Step 1: Warning Dialog */}
      <AlertDialog open={showNukeWarning} onOpenChange={setShowNukeWarning}>
        <AlertDialogContent className="border-red-500/50 bg-red-950/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Destructive Reset
            </AlertDialogTitle>
            <AlertDialogDescription className="text-red-300 mt-4">
              This action will permanently delete all your data and reset the vault to its initial state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-200 font-mono bg-slate-900/50 p-3 rounded border border-red-500/20">
              WARNING: This will DROP all local SQLite tables and clear all localStorage. Your vault and all financial data will be PERMANENTLY DELETED.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="nuke-confirm" className="text-sm">
                Type &apos;DELETE&apos; to confirm:
              </Label>
              <Input
                id="nuke-confirm"
                type="text"
                placeholder="Type DELETE to proceed"
                value={nukeConfirmText}
                onChange={(e) => setNukeConfirmText(e.target.value)}
                className="border-red-500/50 focus-visible:border-red-500"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNukeConfirmText('')}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleNukeStep1Confirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Proceed to Confirmation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Nuke Sequence - Step 2: Countdown Dialog */}
      <Dialog open={showNukeCountdown} onOpenChange={setShowNukeCountdown}>
        <DialogContent className="border-red-600 bg-gradient-to-b from-red-950 to-red-900/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="h-5 w-5" />
              Final Confirmation
            </DialogTitle>
            <DialogDescription className="text-red-200 mt-4">
              This is your last chance. In {countdownValue} seconds, your vault will be permanently destroyed.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-6">
            <div className="text-6xl font-mono font-bold text-red-500">
              {countdownValue}
            </div>
            <p className="text-center text-sm text-red-300 max-w-xs">
              All data will be deleted. This cannot be undone.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowNukeCountdown(false);
                setNukeConfirmText('');
                setCountdownValue(10);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleNukeStep2Confirm}
              disabled={countdownValue > 0}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:text-slate-400"
            >
              {countdownValue > 0 ? `Wait ${countdownValue}s` : 'Destroy Vault'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
