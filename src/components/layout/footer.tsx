import { HelpCircle } from "lucide-react";

export function Footer() {
  return (
    <footer className="flex h-10 items-center justify-between border-t border-gray-200 bg-white px-6 text-xs text-secondary">
      <div className="flex items-center gap-1.5">
        <HelpCircle className="h-3.5 w-3.5" />
        <span>Help Center</span>
      </div>
      <span>&copy; 2024 Kanban Flux. All rights reserved.</span>
      <div className="flex items-center gap-4">
        <span className="hover:text-neutral-900 cursor-pointer">Privacy Policy</span>
        <span className="hover:text-neutral-900 cursor-pointer">Terms of Service</span>
        <span className="hover:text-neutral-900 cursor-pointer">Status</span>
      </div>
    </footer>
  );
}
