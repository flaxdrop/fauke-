import { ViewMode, User } from "../types";
import { MONTH_NAMES } from "../dateUtils";
import {
  Calendar,
  Table,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  FolderKanban,
  LogOut,
  Settings,
  Shield,
} from "lucide-react";

interface HeaderProps {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onManageProjects: () => void;
  onOpenSettings: () => void;
  onOpenAdmin?: () => void;
  user: User;
  onLogout: () => void;
}

export default function Header({
  view,
  onViewChange,
  year,
  month,
  onPrevMonth,
  onNextMonth,
  onToday,
  onExportCsv,
  onExportPdf,
  onManageProjects,
  onOpenSettings,
  onOpenAdmin,
  user,
  onLogout,
}: HeaderProps) {
  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Fauke</h1>
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={onToday}
            className="px-3 py-1 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Today
          </button>
          <button
            onClick={onNextMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <span className="ml-2 text-base font-medium min-w-[160px]">
            {MONTH_NAMES[month]} {year}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => onViewChange("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === "calendar"
                  ? "bg-white dark:bg-gray-700 shadow-sm text-brand-600 dark:text-brand-400"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              <Calendar size={14} />
              Calendar
            </button>
            <button
              onClick={() => onViewChange("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === "table"
                  ? "bg-white dark:bg-gray-700 shadow-sm text-brand-600 dark:text-brand-400"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              <Table size={14} />
              Table
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

          <button
            onClick={onManageProjects}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <FolderKanban size={14} />
            Projects
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Settings size={14} />
            Settings
          </button>

          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Download size={14} />
            CSV
          </button>
          <button
            onClick={onExportPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <FileText size={14} />
            PDF
          </button>

          {user.role === "admin" && onOpenAdmin && (
            <>
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
              <button
                onClick={onOpenAdmin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              >
                <Shield size={14} />
                Admin
              </button>
            </>
          )}

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

          {/* User */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 hidden sm:block">
              {user.displayName}
            </span>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
