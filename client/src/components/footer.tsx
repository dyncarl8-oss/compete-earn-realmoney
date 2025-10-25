import { Link } from "wouter";
import BugFixesDialog from "./bug-fixes-dialog";
import BugReportDialog from "./bug-report-dialog";

export default function Footer() {
  return (
    <footer className="w-full py-4 px-6 border-t border-slate-700/50 bg-slate-900/50 mt-auto">
      <div className="max-w-7xl mx-auto flex justify-between items-center text-sm text-slate-400">
        <div className="flex items-center gap-6">
          <span>© 2025 Compete & Earn Real Money</span>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy Policy
          </Link>
        </div>
        <div className="flex items-center gap-6">
          <BugFixesDialog />
          <BugReportDialog />
        </div>
      </div>
    </footer>
  );
}
