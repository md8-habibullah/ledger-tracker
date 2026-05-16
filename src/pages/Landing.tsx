import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Lock,
  Database,
  ShieldCheck,
  Code2,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Landing = () => {
  const navigate = useNavigate();
  const { initializeVault } = useAuth();

  const handleGetStarted = () => {
    initializeVault();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden font-mono">
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-cyan-500"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Glow Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-40 right-1/3 w-96 h-96 bg-cyan-500 rounded-full mix-blend-screen filter blur-3xl opacity-10 animate-pulse"></div>
        <div className="absolute bottom-40 left-1/4 w-96 h-96 bg-emerald-500 rounded-full mix-blend-screen filter blur-3xl opacity-5 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10">
        {/* Navigation Header */}
        <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-3">
              <Lock className="w-8 h-8 text-cyan-400" />
              <h1 className="text-2xl font-bold text-cyan-400">LedgerTracker</h1>
              <span className="ml-auto text-xs text-slate-500 font-mono">v1.0.0-local</span>
            </div>
          </div>
        </header>

        {/* Hero Section - 60/40 Split */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
            {/* Left Side - 60% (2 out of 3 columns) */}
            <div className="lg:col-span-2 space-y-8">
              <div className="space-y-4">
                <h2 className="text-6xl sm:text-7xl font-bold tracking-tight text-slate-100 leading-tight">
                  Your Finances.
                  <br />
                  <span className="text-cyan-400">Zero Servers.</span>
                  <br />
                  <span className="text-emerald-400">100% Local.</span>
                </h2>
              </div>

              <div className="space-y-3 text-slate-300">
                <p className="text-lg flex items-start gap-3">
                  <Code2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                  <span>Powered by SQLite WASM</span>
                </p>
                <p className="text-lg flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-1" />
                  <span>Military-Grade Local Encryption</span>
                </p>
                <p className="text-lg flex items-start gap-3">
                  <Lock className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                  <span>No Telemetry. No Tracking.</span>
                </p>
              </div>

              <Button
                onClick={handleGetStarted}
                size="lg"
                className="bg-cyan-600 hover:bg-cyan-700 text-slate-950 font-bold border border-cyan-500 mt-6"
              >
                Initialize Local Vault
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            {/* Right Side - 40% (1 out of 3 columns) */}
            <div className="lg:col-span-1 flex items-center justify-center">
              {/* Security Graphic - Layered Icons with Glow */}
              <div className="relative w-full aspect-square max-w-sm">
                {/* Outer Ring */}
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-pulse"></div>

                {/* Middle Ring */}
                <div className="absolute inset-4 rounded-full border border-emerald-500/20"></div>

                {/* Inner Ring */}
                <div className="absolute inset-8 rounded-full border border-cyan-500/10"></div>

                {/* Center Icon with Glow */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    {/* Glow Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded-full blur-3xl"></div>

                    {/* Main Icon */}
                    <div className="relative bg-slate-900 border-2 border-cyan-500 rounded-full p-8 shadow-2xl shadow-cyan-500/50">
                      <ShieldCheck className="w-24 h-24 text-cyan-400" />
                    </div>
                  </div>
                </div>

                {/* Orbiting Elements */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4">
                  <div className="bg-slate-900 border border-cyan-500/50 rounded-full p-4 shadow-lg shadow-cyan-500/30">
                    <Database className="w-6 h-6 text-cyan-400" />
                  </div>
                </div>

                <div className="absolute right-0 top-1/2 translate-x-4 -translate-y-1/2">
                  <div className="bg-slate-900 border border-emerald-500/50 rounded-full p-4 shadow-lg shadow-emerald-500/30">
                    <Lock className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>

                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-4">
                  <div className="bg-slate-900 border border-cyan-500/50 rounded-full p-4 shadow-lg shadow-cyan-500/30">
                    <ShieldCheck className="w-6 h-6 text-cyan-400" />
                  </div>
                </div>

                {/* Hex Code Animation */}
                <div className="absolute top-1/4 left-1/4 text-xs text-cyan-500/40 font-mono animate-pulse">
                  0xDEADBEEF
                </div>
                <div className="absolute bottom-1/4 right-1/4 text-xs text-emerald-500/40 font-mono animate-pulse" style={{ animationDelay: '1s' }}>
                  0xCAFEBABE
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Timeline - How It Works */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-y border-slate-800/50">
          <h3 className="text-4xl font-bold text-center mb-16 text-slate-100">
            How It Works
          </h3>

          <div className="space-y-8">
            {/* Timeline Item 1 */}
            <div className="flex gap-8 items-start">
              <div className="flex flex-col items-center gap-4 flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 font-bold text-lg border-2 border-slate-800">
                  1
                </div>
                <div className="w-1 h-16 bg-gradient-to-b from-cyan-500/50 to-transparent hidden sm:block"></div>
              </div>
              <div className="pt-2">
                <h4 className="text-xl font-bold text-slate-100 mb-2">Data Input</h4>
                <p className="text-slate-400 font-mono text-sm">
                  User enters financial transactions, budgets, and categories directly into the application.
                </p>
              </div>
            </div>

            {/* Timeline Item 2 */}
            <div className="flex gap-8 items-start">
              <div className="flex flex-col items-center gap-4 flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 font-bold text-lg border-2 border-slate-800">
                  2
                </div>
                <div className="w-1 h-16 bg-gradient-to-b from-emerald-500/50 to-transparent hidden sm:block"></div>
              </div>
              <div className="pt-2">
                <h4 className="text-xl font-bold text-slate-100 mb-2">Encrypted in Memory</h4>
                <p className="text-slate-400 font-mono text-sm">
                  Data is encrypted using your master password. Encryption happens locally in the browser.
                </p>
              </div>
            </div>

            {/* Timeline Item 3 */}
            <div className="flex gap-8 items-start">
              <div className="flex flex-col items-center gap-4 flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 font-bold text-lg border-2 border-slate-800">
                  3
                </div>
                <div className="w-1 h-16 bg-gradient-to-b from-cyan-500/50 to-transparent hidden sm:block"></div>
              </div>
              <div className="pt-2">
                <h4 className="text-xl font-bold text-slate-100 mb-2">Stored in Local SQLite</h4>
                <p className="text-slate-400 font-mono text-sm">
                  Encrypted data persists in a local SQLite WASM database. Zero network transmission.
                </p>
              </div>
            </div>

            {/* Timeline Item 4 */}
            <div className="flex gap-8 items-start">
              <div className="flex flex-col items-center gap-4 flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 font-bold text-lg border-2 border-slate-800">
                  4
                </div>
              </div>
              <div className="pt-2">
                <h4 className="text-xl font-bold text-slate-100 mb-2">Auto-Lock on Inactivity</h4>
                <p className="text-slate-400 font-mono text-sm">
                  Vault automatically locks after configurable inactivity period. Complete control in your hands.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <h3 className="text-4xl font-bold text-center mb-16 text-slate-100">
            Frequently Asked Questions
          </h3>

          <Accordion type="single" collapsible className="space-y-3">
            <AccordionItem value="faq-1" className="border border-slate-800/50 rounded-lg px-6">
              <AccordionTrigger className="hover:text-cyan-400 transition text-left">
                <span className="flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-cyan-400" />
                  Is my data really private?
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-slate-400 font-mono text-sm pt-4">
                Yes. LedgerTracker runs entirely in your browser with zero network connectivity. Your data never touches a server or the cloud. All encryption happens locally.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-2" className="border border-slate-800/50 rounded-lg px-6">
              <AccordionTrigger className="hover:text-emerald-400 transition text-left">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  What if I forget my password?
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-slate-400 font-mono text-sm pt-4">
                There is no recovery mechanism. Your password is never stored or transmitted. If you forget it, your data cannot be accessed. Keep your password safe and secure.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-3" className="border border-slate-800/50 rounded-lg px-6">
              <AccordionTrigger className="hover:text-cyan-400 transition text-left">
                <span className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  Can I sync across devices?
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-slate-400 font-mono text-sm pt-4">
                Currently, LedgerTracker stores data locally on each device. Cross-device syncing is a planned feature for future releases while maintaining end-to-end encryption.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-4" className="border border-slate-800/50 rounded-lg px-6">
              <AccordionTrigger className="hover:text-emerald-400 transition text-left">
                <span className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-emerald-400" />
                  Is LedgerTracker free?
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-slate-400 font-mono text-sm pt-4">
                Yes. LedgerTracker is completely free and open-source. No subscriptions, no premium tiers, no ads, no tracking. Your privacy is our commitment.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-5" className="border border-slate-800/50 rounded-lg px-6">
              <AccordionTrigger className="hover:text-cyan-400 transition text-left">
                <span className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-cyan-400" />
                  What encryption standard is used?
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-slate-400 font-mono text-sm pt-4">
                LedgerTracker uses industry-standard encryption protocols to secure your data. All encryption operations occur locally within the browser before storage in SQLite.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* Final CTA Section */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center border-t border-slate-800/50">
          <h3 className="text-4xl font-bold mb-6 text-slate-100">
            Ready to Secure Your Finances?
          </h3>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto font-mono">
            Take control of your financial data. Zero servers. Zero telemetry. Zero compromises.
          </p>
          <Button
            onClick={handleGetStarted}
            size="lg"
            className="bg-cyan-600 hover:bg-cyan-700 text-slate-950 font-bold border border-cyan-500"
          >
            Initialize Local Vault
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-800/50 backdrop-blur-sm bg-slate-950/50 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-slate-500 font-mono text-sm">
              <p>LedgerTracker • 100% Local • Military-Grade Encryption • Always Free</p>
              <p className="mt-2 text-xs text-slate-600">
                Built with privacy-first engineering principles
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
