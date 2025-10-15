import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="w-full py-4 px-6 border-t border-slate-700/50 bg-slate-900/50 mt-auto">
      <div className="max-w-7xl mx-auto flex justify-center items-center gap-6 text-sm text-slate-400">
        <span>© 2025 Compete & Earn Real Money</span>
        <Link href="/terms" className="hover:text-white transition-colors">
          Terms of Service
        </Link>
        <Link href="/privacy" className="hover:text-white transition-colors">
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}
