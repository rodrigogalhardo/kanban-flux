import { HelpCircle } from "lucide-react";

export function Footer() {
  return (
    <footer className="flex h-10 items-center justify-between border-t border-gray-200 bg-white px-6 text-xs text-secondary">
      <a
        href="#"
        className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-900 transition-colors"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        <span>Help Center</span>
      </a>
      <span>&copy; 2024 Kanban Flux. by ENI Ethereal Nexus Institute - A Think Tank &amp; Science - All rights reserved.</span>
      <div className="flex items-center gap-4">
        <a href="#" className="hover:text-neutral-900 cursor-pointer transition-colors">Privacy Policy</a>
        <a href="#" className="hover:text-neutral-900 cursor-pointer transition-colors">Terms of Service</a>
        <a href="#" className="hover:text-neutral-900 cursor-pointer transition-colors">Status</a>
      </div>
    </footer>
  );
}
