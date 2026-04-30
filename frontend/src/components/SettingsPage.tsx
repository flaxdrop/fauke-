import { useEffect, useState } from "react";
import { ArrowLeft, Save, UserCircle2 } from "lucide-react";
import { getUserSettings, updateUserSettings } from "../api";
import { UserSettings } from "../types";
import Toast from "./Toast";

interface SettingsPageProps {
    onBack: () => void;
    showToast: (message: string, type?: "success" | "error") => void;
}

export default function SettingsPage({ onBack, showToast }: SettingsPageProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [form, setForm] = useState({
        displayName: "",
        email: "",
        avatar: "",
        language: "en",
        timezone: "UTC",
        emailNotifications: true,
    });
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            try {
                const data = await getUserSettings();
                if (!mounted) return;
                setSettings(data);
                setForm({
                    displayName: data.displayName,
                    email: data.email ?? "",
                    avatar: data.avatar ?? "",
                    language: data.preferences?.language ?? "en",
                    timezone: data.preferences?.timezone ?? "UTC",
                    emailNotifications: data.preferences?.emailNotifications ?? true,
                });
            } catch (error) {
                if (!mounted) return;
                const message = error instanceof Error ? error.message : "Failed to load settings";
                setToast({ message, type: "error" });
            } finally {
                if (mounted) setLoading(false);
            }
        };

        load();
        return () => {
            mounted = false;
        };
    }, []);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = event.target;
        const checked = (event.target as HTMLInputElement).checked;
        setForm((current) => ({
            ...current,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);

        try {
            const updated = await updateUserSettings({
                displayName: form.displayName,
                email: form.email || null,
                avatar: form.avatar || null,
                preferences: {
                    language: form.language,
                    timezone: form.timezone,
                    emailNotifications: form.emailNotifications,
                },
            });

            setSettings(updated);
            showToast("Settings saved", "success");
            setToast({ message: "Settings saved", type: "success" });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to save settings";
            setToast({ message, type: "error" });
            showToast(message, "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur p-6 shadow-sm">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="h-10 rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="h-10 rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="h-10 rounded bg-gray-200 dark:bg-gray-800" />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">User settings</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Profile and preferences for your account.</p>
                </div>
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur p-6 shadow-sm">
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300">
                            <UserCircle2 size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Profile</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Your public identity in Fauke.</p>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Username</span>
                            <input
                                value={settings?.username ?? ""}
                                disabled
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-500"
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Display name</span>
                            <input
                                name="displayName"
                                value={form.displayName}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Email</span>
                            <input
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Avatar URL</span>
                            <input
                                name="avatar"
                                value={form.avatar}
                                onChange={handleChange}
                                placeholder="https://..."
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
                            />
                        </label>
                    </div>
                </section>

                <section className="space-y-4 border-t border-gray-200 dark:border-gray-800 pt-6">
                    <div>
                        <h3 className="text-lg font-semibold">Preferences</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">A few basic defaults for your workflow.</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Language</span>
                            <select
                                name="language"
                                value={form.language}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
                            >
                                <option value="en">English</option>
                                <option value="sv">Svenska</option>
                            </select>
                        </label>

                        <label className="space-y-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Timezone</span>
                            <select
                                name="timezone"
                                value={form.timezone}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
                            >
                                <option value="UTC">UTC</option>
                                <option value="Europe/Stockholm">Europe/Stockholm</option>
                                <option value="Europe/London">Europe/London</option>
                                <option value="America/New_York">America/New_York</option>
                            </select>
                        </label>
                    </div>

                    <label className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 px-4 py-3">
                        <input
                            type="checkbox"
                            name="emailNotifications"
                            checked={form.emailNotifications}
                            onChange={handleChange}
                            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email notifications</span>
                    </label>
                </section>

                <div className="flex items-center justify-between gap-3 border-t border-gray-200 dark:border-gray-800 pt-6">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Changes are saved to your account immediately.</p>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
                    >
                        <Save size={16} />
                        {saving ? "Saving..." : "Save changes"}
                    </button>
                </div>
            </form>

            {toast && <Toast message={toast.message} type={toast.type} />}
        </div>
    );
}
