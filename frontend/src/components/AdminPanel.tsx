// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { Project, AdminUser } from "../types";
import * as api from "../api";
import {
  X,
  UserPlus,
  Pencil,
  Trash2,
  Shield,
  User as UserIcon,
  Loader2,
  Save,
  Users,
  Plug,
  Package2,
} from "lucide-react";
import IntegrationsPanel from "./IntegrationsPanel";
import PluginBrowser from "./PluginBrowser";

interface AdminPanelProps {
  onClose: () => void;
  showToast: (message: string, type: "success" | "error") => void;
}

interface UserFormData {
  username: string;
  password: string;
  displayName: string;
  role: string;
  projectIds: string[];
}

const emptyForm: UserFormData = {
  username: "",
  password: "",
  displayName: "",
  role: "user",
  projectIds: [],
};

export default function AdminPanel({ onClose, showToast }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "integrations" | "plugins">("users");

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([api.getAdminUsers(), api.getProjects()]);
      setUsers(u);
      setProjects(p);
    } catch {
      showToast("Failed to load admin data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateForm = () => {
    setEditingUserId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEditForm = (user: AdminUser) => {
    setEditingUserId(user.id);
    setForm({
      username: user.username,
      password: "",
      displayName: user.displayName,
      role: user.role,
      projectIds: user.projects.map((p) => p.id),
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUserId) {
        const updateData: Parameters<typeof api.updateAdminUser>[1] = {
          displayName: form.displayName,
          role: form.role,
          projectIds: form.projectIds,
        };
        if (form.password) updateData.password = form.password;
        await api.updateAdminUser(editingUserId, updateData);
        showToast("User updated", "success");
      } else {
        if (!form.username || !form.password || !form.displayName) {
          showToast("All fields are required", "error");
          setSaving(false);
          return;
        }
        await api.createAdminUser(form);
        showToast("User created", "success");
      }
      setFormOpen(false);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save user";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAdminUser(id);
      showToast("User deleted", "success");
      setDeleteConfirm(null);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete user";
      showToast(message, "error");
    }
  };

  const toggleProject = (projectId: string) => {
    setForm((prev) => ({
      ...prev,
      projectIds: prev.projectIds.includes(projectId)
        ? prev.projectIds.filter((id) => id !== projectId)
        : [...prev.projectIds, projectId],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 w-full max-w-4xl mx-4 my-8 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <h2 className="text-lg font-semibold">Admin Panel</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 px-6">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "users"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
          >
            <Users size={16} />
            Users
          </button>
          <button
            onClick={() => setActiveTab("integrations")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "integrations"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
          >
            <Plug size={16} />
            Integrations
          </button>
          <button
            onClick={() => setActiveTab("plugins")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "plugins"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
          >
            <Package2 size={16} />
            Plugins
          </button>
        </div>

        <div className="p-6">
          {activeTab === "plugins" ? (
            <PluginBrowser showToast={showToast} />
          ) : activeTab === "integrations" ? (
            <IntegrationsPanel showToast={showToast} />
          ) : loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={24} className="animate-spin text-brand-500" />
            </div>
          ) : (
            <>
              {/* Action bar */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Users ({users.length})
                </h3>
                <button
                  onClick={openCreateForm}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <UserPlus size={16} />
                  Add User
                </button>
              </div>

              {/* Users table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        User
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Username
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Role
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Assigned Projects
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
                              <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                                {u.displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium">{u.displayName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                          {u.username}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.role === "admin"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              }`}
                          >
                            {u.role === "admin" ? (
                              <Shield size={12} />
                            ) : (
                              <UserIcon size={12} />
                            )}
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {u.projects.length === 0 ? (
                            <span className="text-gray-400 text-xs">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {u.projects.map((p) => (
                                <span
                                  key={p.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: `${p.color}20`,
                                    color: p.color,
                                  }}
                                >
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: p.color }}
                                  />
                                  {p.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditForm(u)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-brand-500 transition-colors"
                              title="Edit user"
                            >
                              <Pencil size={14} />
                            </button>
                            {deleteConfirm === u.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(u.id)}
                                  className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(u.id)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors"
                                title="Delete user"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Create / Edit user form modal */}
        {formOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <form
              onSubmit={handleSubmit}
              className="bg-white dark:bg-gray-900 w-full max-w-lg mx-4 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-base font-semibold">
                  {editingUserId ? "Edit User" : "Create User"}
                </h3>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    disabled={!!editingUserId}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter username"
                  />
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder="Enter display name"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Password {editingUserId && "(leave blank to keep current)"}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder={editingUserId ? "••••••••" : "Enter password"}
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Role
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, role: "user" })}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${form.role === "user"
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                        }`}
                    >
                      <UserIcon size={14} />
                      User
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, role: "admin" })}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${form.role === "admin"
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                        }`}
                    >
                      <Shield size={14} />
                      Admin
                    </button>
                  </div>
                </div>

                {/* Project Assignments */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Assigned Projects
                  </label>
                  {projects.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      No projects created yet
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {projects.map((p) => (
                        <label
                          key={p.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${form.projectIds.includes(p.id)
                            ? "border-brand-300 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-700"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={form.projectIds.includes(p.id)}
                            onChange={() => toggleProject(p.id)}
                            className="sr-only"
                          />
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="text-sm">{p.name}</span>
                          {form.projectIds.includes(p.id) && (
                            <span className="ml-auto text-brand-500 text-xs font-medium">
                              ✓
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {editingUserId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
