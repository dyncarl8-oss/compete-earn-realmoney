import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsOfService() {
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
            <CardTitle className="text-3xl font-bold text-white">Terms of Service</CardTitle>
            <p className="text-slate-400 mt-2">Last Updated: October 14, 2025</p>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">1. Service Overview</h2>
              <p>
                Compete & Earn Real Money is a competitive real money gaming platform where users participate in skill-based games 
                (Yahtzee, Chess, Plinko, and Dice) with entry fees and prize pools. By using Compete & Earn Real Money, you accept these terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">2. Eligibility</h2>
              <p>
                You must be at least 18 years old to use this platform. By registering, you confirm that 
                you meet the age requirement and are legally permitted to participate in real money gaming 
                in your jurisdiction. It is your responsibility to ensure compliance with local laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">3. Real Money Gaming</h2>
              <p className="mb-2">
                Compete & Earn Real Money operates as a real money gaming platform:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Entry fees range from $0.50 to $50.00 per game</li>
                <li>Prize pools consist of 95% of total entry fees collected</li>
                <li>Compete & Earn Real Money retains a 5% platform fee from each game</li>
                <li>Winner-takes-all: the highest scorer or sole winner receives the entire prize pool</li>
                <li>All games are skill-based competitive matches</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">4. Payments and Withdrawals</h2>
              <p className="mb-2">
                Payment processing is handled through Whop:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>You can deposit funds to your Compete & Earn Real Money balance via secure payment methods</li>
                <li>Withdrawals are processed manually within 24-48 hours</li>
                <li>You can withdraw your available balance at any time</li>
                <li>Minimum withdrawal amounts may apply</li>
                <li>Payment processing fees may be deducted from withdrawals</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">5. Game Rules and Fair Play</h2>
              <p className="mb-2">
                All games must be played fairly:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use of bots, automation, or unfair advantages is strictly prohibited</li>
                <li>Collusion with other players to manipulate outcomes is forbidden</li>
                <li>Game results are final once a match is completed</li>
                <li>We reserve the right to investigate suspicious activity and void results if necessary</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">6. Account Security</h2>
              <p>
                You are responsible for maintaining the security of your account credentials. Compete & Earn Real Money is 
                not liable for unauthorized access to your account due to your failure to keep login 
                information secure. You must not share your account with others.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">7. Risks and Liability</h2>
              <p className="mb-2">
                By participating in real money gaming on Compete & Earn Real Money:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>You acknowledge that you may lose money when participating in games</li>
                <li>Compete & Earn Real Money is not responsible for financial losses from gameplay</li>
                <li>You play at your own risk and should only wager amounts you can afford to lose</li>
                <li>Compete & Earn Real Money is not liable for technical issues that may affect gameplay</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">8. Dispute Resolution</h2>
              <p>
                In the event of a dispute regarding game results or transactions, please contact our support 
                team. We will review all disputes on a case-by-case basis. Our decision in dispute matters 
                is final.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">9. Service Modifications</h2>
              <p>
                Compete & Earn Real Money reserves the right to modify, suspend, or discontinue any aspect of the service at 
                any time. We may update these terms periodically, and continued use of the platform 
                constitutes acceptance of any changes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">10. Account Termination</h2>
              <p>
                We reserve the right to suspend or terminate accounts that violate these terms, engage in 
                fraudulent activity, or otherwise abuse the platform. Upon termination, any remaining balance 
                may be subject to review and potential forfeiture in cases of terms violations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">11. Contact</h2>
              <p>
                For questions about these terms, please contact our support team through the platform.
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
