import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Eye, Zap, Shield, HelpCircle, CheckCircle2 } from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    localStorage.setItem("vault_initialized", "true");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-2">
              <Lock className="w-8 h-8 text-cyan-400" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Ledger Tracker
              </h1>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center space-y-8">
            <h2 className="text-5xl sm:text-6xl font-bold leading-tight">
              Your Finances.
              <br />
              <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Completely Private.
              </span>
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              A local encrypted vault for your financial data. No cloud, no servers, no data collection.
              Everything stays on your device, completely under your control.
            </p>
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white border-0"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h3 className="text-3xl font-bold text-center mb-16">Why Choose Ledger Tracker?</h3>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg p-8 hover:border-cyan-500/50 transition">
              <Eye className="w-12 h-12 text-cyan-400 mb-4" />
              <h4 className="text-xl font-semibold mb-3">100% Local Privacy</h4>
              <p className="text-slate-300">
                All your financial data stays on your device. We don't store, sync, or transmit anything to external servers.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg p-8 hover:border-emerald-500/50 transition">
              <Shield className="w-12 h-12 text-emerald-400 mb-4" />
              <h4 className="text-xl font-semibold mb-3">Military-Grade Encryption</h4>
              <p className="text-slate-300">
                Protected by a master password that only you know. Your data is encrypted and locked down tight.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg p-8 hover:border-cyan-500/50 transition">
              <Zap className="w-12 h-12 text-cyan-400 mb-4" />
              <h4 className="text-xl font-semibold mb-3">Lightning Fast</h4>
              <p className="text-slate-300">
                Instant access to all your financial data. No network latency, no loading screens, just pure performance.
              </p>
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-emerald-500/20 rounded-lg p-12">
            <h3 className="text-3xl font-bold mb-8 flex items-center gap-3">
              <Shield className="w-8 h-8 text-emerald-400" />
              100% Local, Completely Encrypted
            </h3>
            <div className="space-y-4 text-slate-300">
              <p>
                Ledger Tracker operates entirely on your device. There is no backend server, no cloud sync, and no data transmission. Your financial information never leaves your control.
              </p>
              <p>
                Every piece of data is protected by a master password that you set and only you know. Even if someone gains access to your device, your vault remains locked and unreadable without your password.
              </p>
              <p>
                You have complete autonomy over your data. At any time, you can view, export, or permanently delete everything with a single action.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h3 className="text-3xl font-bold text-center mb-16">How It Works</h3>
          <div className="space-y-8">
            {/* Step 1 */}
            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500">
                  <span className="text-white font-bold text-lg">1</span>
                </div>
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2">Set Your Master Password</h4>
                <p className="text-slate-300">
                  Create a strong, unique master password. This is the only key to your vault. Write it down somewhere safe—if you lose it, your data cannot be recovered.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500">
                  <span className="text-white font-bold text-lg">2</span>
                </div>
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2">Track Your Finances</h4>
                <p className="text-slate-300">
                  Add transactions, categorize expenses, set budgets, and visualize your spending. All in real-time, with zero network dependency.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500">
                  <span className="text-white font-bold text-lg">3</span>
                </div>
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2">Auto-Lock for Security</h4>
                <p className="text-slate-300">
                  Your vault automatically locks after a period of inactivity. When you step away, your data is immediately secured.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500">
                  <span className="text-white font-bold text-lg">4</span>
                </div>
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2">Your Data, Your Rules</h4>
                <p className="text-slate-300">
                  Export, backup, or delete your data anytime. Complete control, complete transparency.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h3 className="text-3xl font-bold text-center mb-16">Frequently Asked Questions</h3>
          <div className="space-y-6">
            {/* FAQ 1 */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg p-6">
              <div className="flex gap-4 items-start">
                <HelpCircle className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h4 className="text-lg font-semibold mb-2">Is my data really private?</h4>
                  <p className="text-slate-300">
                    Yes. Ledger Tracker runs entirely on your device with zero network connectivity. Your data never touches a server or the cloud.
                  </p>
                </div>
              </div>
            </div>

            {/* FAQ 2 */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg p-6">
              <div className="flex gap-4 items-start">
                <HelpCircle className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h4 className="text-lg font-semibold mb-2">What if I forget my password?</h4>
                  <p className="text-slate-300">
                    There is no recovery mechanism. Your password is never stored or transmitted. If you forget it, your data cannot be accessed. Keep your password safe.
                  </p>
                </div>
              </div>
            </div>

            {/* FAQ 3 */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg p-6">
              <div className="flex gap-4 items-start">
                <HelpCircle className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h4 className="text-lg font-semibold mb-2">Can I sync across devices?</h4>
                  <p className="text-slate-300">
                    Currently, Ledger Tracker stores data locally on each device. Syncing across devices is a future enhancement.
                  </p>
                </div>
              </div>
            </div>

            {/* FAQ 4 */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg p-6">
              <div className="flex gap-4 items-start">
                <HelpCircle className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h4 className="text-lg font-semibold mb-2">Is Ledger Tracker free?</h4>
                  <p className="text-slate-300">
                    Yes, Ledger Tracker is completely free. No subscriptions, no premium tiers, no ads.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h3 className="text-3xl font-bold mb-6">Ready to Take Control of Your Finances?</h3>
          <p className="text-lg text-slate-300 mb-8">
            Start using Ledger Tracker today. All your data stays encrypted and local.
          </p>
          <Button
            onClick={handleGetStarted}
            size="lg"
            className="bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white border-0"
          >
            Get Started Now
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-700/50 backdrop-blur-sm bg-slate-900/50 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-slate-400">
            <p>Ledger Tracker • 100% Local • Completely Private • Always Free</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
