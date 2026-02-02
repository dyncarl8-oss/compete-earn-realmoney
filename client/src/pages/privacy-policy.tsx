import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button
            onClick={() => setLocation("/")}
            variant="ghost"
            className="text-white hover:bg-slate-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>

        <Card className="bg-slate-900/95 border-slate-700">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-white">Privacy Policy</CardTitle>
            <p className="text-slate-400 mt-2">Last Updated: October 14, 2025</p>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
              <p>
                Compete & Earn Real Money is a competitive real money gaming platform. We collect and use your personal information 
                to operate the platform, process payments, and manage your gaming account. This policy explains 
                what we collect and how we use it.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
              <p className="mb-2">We collect information when you use Compete & Earn Real Money:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Account information (username, email) provided through Whop authentication</li>
                <li>Payment information processed through Whop for deposits and withdrawals</li>
                <li>Game activity (scores, matches played, winnings/losses)</li>
                <li>Transaction history (deposits, withdrawals, entry fees, prizes)</li>
                <li>Device and usage data (IP address, browser type, pages visited)</li>
                <li>Support communications and feedback you provide</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
              <p className="mb-2">We use your information to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Operate the platform and provide gaming services</li>
                <li>Process entry fees, deposits, and withdrawal requests</li>
                <li>Track game results and distribute prize pools to winners</li>
                <li>Detect fraud, cheating, and rule violations</li>
                <li>Send you important notifications about your account and games</li>
                <li>Improve the platform and develop new features</li>
                <li>Comply with legal obligations and tax reporting requirements</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">4. Information Sharing</h2>
              <p className="mb-2">We share your information with:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Whop:</strong> Payment processing, authentication, and transaction management</li>
                <li><strong>Service Providers:</strong> Third-party tools that help us operate the platform</li>
                <li><strong>Legal Authorities:</strong> When required by law or to protect our rights</li>
              </ul>
              <p className="mt-3">
                We do not sell your personal information to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">5. Financial Data</h2>
              <p>
                All payment processing is handled securely through Whop. We store transaction records 
                (amounts, dates, types) but do not directly handle or store your credit card or banking details. 
                Your financial information is protected by Whop's security measures.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">6. Data Security</h2>
              <p>
                We implement security measures to protect your data from unauthorized access and breaches. 
                However, no online platform is 100% secure. You are responsible for keeping your account 
                credentials confidential.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">7. Cookies and Tracking</h2>
              <p>
                We use cookies and similar technologies to keep you logged in, remember your preferences, 
                and analyze platform usage. You can control cookies through your browser settings, but 
                some features may not work properly if cookies are disabled.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">8. Data Retention</h2>
              <p>
                We retain your account and transaction data for as long as your account is active and for 
                a period afterwards as required for legal, tax, and regulatory purposes. Game history and 
                transaction records may be retained indefinitely for audit and dispute resolution.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">9. Your Rights</h2>
              <p className="mb-2">You can:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Access your account data and transaction history through the platform</li>
                <li>Request correction of inaccurate information</li>
                <li>Request account deletion (subject to completing all pending transactions)</li>
                <li>Opt out of non-essential communications</li>
              </ul>
              <p className="mt-3">
                Contact us through the platform to exercise these rights.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">10. Age Requirement</h2>
              <p>
                Compete & Earn Real Money is only for users 18 years and older. We do not knowingly collect information from 
                anyone under 18. If we discover an underage user, we will terminate their account immediately.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">11. Policy Updates</h2>
              <p>
                We may update this Privacy Policy periodically. Continued use of the platform after updates 
                means you accept the changes. Check the "Last Updated" date to see when the policy was last revised.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">12. Contact</h2>
              <p>
                For privacy questions or concerns, contact us through the platform's support channels.
              </p>
            </section>

            <div className="mt-8 pt-6 border-t border-slate-700 text-center text-slate-400">
              <p>© 2025 Compete & Earn Real Money. All rights reserved.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
