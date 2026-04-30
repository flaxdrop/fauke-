import { useState, useEffect, useCallback } from "react";
import { Project, TimeEntry, ViewMode, User } from "./types";
import * as api from "./api";
import { startOfMonth, endOfMonth } from "./dateUtils";
import Header from "./components/Header";
import CalendarView from "./components/CalendarView";
import TableView from "./components/TableView";
import EntryModal from "./components/EntryModal";
import ProjectManager from "./components/ProjectManager";
import SettingsPage from "./components/SettingsPage";
import Toast from "./components/Toast";
import LoginPage from "./components/LoginPage";
import AdminPanel from "./components/AdminPanel";

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(api.getSavedUser());
  const [authChecked, setAuthChecked] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  const [view, setView] = useState<ViewMode>("calendar");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  // Project manager
  const [projectManagerOpen, setProjectManagerOpen] = useState(false);

  // Admin panel
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Verify token / consume magic link on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get("magicToken");

    if (magicToken) {
      setMagicLinkLoading(true);
      api
        .exchangeMagicLink(magicToken)
        .then((res) => {
          api.setToken(res.token);
          api.saveUser(res.user);
          setUser(res.user);
        })
        .catch((err) => {
          console.error(err);
          api.clearToken();
          setUser(null);
          showToast("Magic link expired or invalid", "error");
        })
        .finally(() => {
          params.delete("magicToken");
          window.history.replaceState({}, document.title, window.location.pathname);
          setMagicLinkLoading(false);
          setAuthChecked(true);
        });
      return;
    }

    if (!api.isAuthenticated()) {
      setUser(null);
      setAuthChecked(true);
      return;
    }
    api.getMe()
      .then((u) => {
        setUser(u);
        api.saveUser(u);
      })
      .catch(() => {
        api.clearToken();
        setUser(null);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogin = async (username: string, password: string) => {
    const res = await api.login(username, password);
    api.setToken(res.token);
    api.saveUser(res.user);
    setUser(res.user);
  };

  const handleLogout = () => {
    api.clearToken();
    setUser(null);
    setProjects([]);
    setEntries([]);
  };

  const from = startOfMonth(year, month);
  const to = endOfMonth(year, month);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [p, e] = await Promise.all([api.getProjects(), api.getEntries(from, to)]);
      setProjects(p);
      setEntries(e);
    } catch (err) {
      console.error(err);
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }, [from, to, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const handleNextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const handleToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const handleDayClick = (date: string) => {
    setModalDate(date);
    setEditingEntry(null);
    setModalOpen(true);
  };

  const handleEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setModalDate(entry.date.split("T")[0]);
    setModalOpen(true);
  };

  const handleSaveEntry = async (data: {
    date: string;
    hours: number;
    note?: string;
    projectId: string;
  }) => {
    try {
      if (editingEntry) {
        await api.updateEntry(editingEntry.id, data);
        showToast("Entry updated");
      } else {
        await api.createEntry(data);
        showToast("Entry created");
      }
      setModalOpen(false);
      loadData();
    } catch {
      showToast("Failed to save entry", "error");
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await api.deleteEntry(id);
      showToast("Entry deleted");
      setModalOpen(false);
      loadData();
    } catch {
      showToast("Failed to delete entry", "error");
    }
  };

  const handleExportCsv = async () => {
    try {
      await api.exportCsv(from, to);
    } catch {
      showToast("Failed to export CSV", "error");
    }
  };

  const handleExportPdf = async () => {
    try {
      await api.exportPdf(from, to);
    } catch {
      showToast("Failed to export PDF", "error");
    }
  };

  // Loading auth state
  if (!authChecked) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage onLogin={handleLogin} onRequestMagicLink={api.requestMagicLink} />;
  }

  return (
    <div className="h-full flex flex-col">
      <Header
        view={view}
        onViewChange={setView}
        year={year}
        month={month}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        onManageProjects={() => setProjectManagerOpen(true)}
        onOpenSettings={() => setView("settings")}
        onOpenAdmin={() => setAdminPanelOpen(true)}
        user={user}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : view === "settings" ? (
          <SettingsPage onBack={() => setView("calendar")} showToast={showToast} />
        ) : view === "calendar" ? (
          <CalendarView
            year={year}
            month={month}
            entries={entries}
            projects={projects}
            onDayClick={handleDayClick}
            onEntryClick={handleEditEntry}
          />
        ) : (
          <TableView
            year={year}
            month={month}
            entries={entries}
            projects={projects}
            onCellClick={handleDayClick}
            onEntryClick={handleEditEntry}
          />
        )}
      </main>

      {modalOpen && (
        <EntryModal
          date={modalDate!}
          entry={editingEntry}
          projects={projects}
          onSave={handleSaveEntry}
          onDelete={editingEntry ? () => handleDeleteEntry(editingEntry.id) : undefined}
          onClose={() => setModalOpen(false)}
        />
      )}

      {projectManagerOpen && (
        <ProjectManager
          projects={projects}
          onClose={() => {
            setProjectManagerOpen(false);
            loadData();
          }}
          showToast={showToast}
        />
      )}

      {adminPanelOpen && (
        <AdminPanel
          onClose={() => setAdminPanelOpen(false)}
          showToast={showToast}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
