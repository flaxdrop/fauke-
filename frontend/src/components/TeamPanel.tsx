import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Users, Building2, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import * as api from "../api";
import { AdminUser, Organization, PendingApproval } from "../types";

interface TeamPanelProps {
    showToast: (message: string, type: "success" | "error") => void;
}

interface OrganizationForm {
    name: string;
    approvalRequired: boolean;
}

interface MemberFormState {
    userId: string;
    organizationRole: string;
}

const emptyOrganizationForm: OrganizationForm = {
    name: "",
    approvalRequired: false,
};

export default function TeamPanel({ showToast }: TeamPanelProps) {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [approvals, setApprovals] = useState<PendingApproval[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingOrg, setSavingOrg] = useState(false);
    const [organizationForm, setOrganizationForm] = useState<OrganizationForm>(emptyOrganizationForm);
    const [memberForm, setMemberForm] = useState<Record<string, MemberFormState>>({});

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [organizationData, userData, approvalData] = await Promise.all([
                api.getAdminOrganizations(),
                api.getAdminUsers(),
                api.getPendingApprovals(),
            ]);
            setOrganizations(organizationData);
            setUsers(userData);
            setApprovals(approvalData);
        } catch (error) {
            console.error(error);
            showToast("Failed to load team data", "error");
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const unassignedUsers = useMemo(
        () => users.filter((user) => !user.organization),
        [users]
    );

    const handleCreateOrganization = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!organizationForm.name.trim()) {
            showToast("Organization name is required", "error");
            return;
        }

        setSavingOrg(true);
        try {
            await api.createAdminOrganization({
                name: organizationForm.name.trim(),
                approvalRequired: organizationForm.approvalRequired,
            });
            setOrganizationForm(emptyOrganizationForm);
            showToast("Organization created", "success");
            await loadData();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create organization";
            showToast(message, "error");
        } finally {
            setSavingOrg(false);
        }
    };

    const handleUpdateOrganization = async (organization: Organization, changes: Partial<OrganizationForm>) => {
        try {
            await api.updateAdminOrganization(organization.id, {
                name: changes.name ?? organization.name,
                approvalRequired: changes.approvalRequired ?? organization.approvalRequired,
            });
            showToast("Organization updated", "success");
            await loadData();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update organization";
            showToast(message, "error");
        }
    };

    const handleAssignUser = async (organizationId: string) => {
        const form = memberForm[organizationId];
        if (!form?.userId) {
            showToast("Choose a user first", "error");
            return;
        }

        try {
            await api.assignUserToOrganization(organizationId, {
                userId: form.userId,
                organizationRole: form.organizationRole || "member",
            });
            setMemberForm((current) => ({
                ...current,
                [organizationId]: { userId: "", organizationRole: "member" },
            }));
            showToast("User assigned to organization", "success");
            await loadData();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to assign user";
            showToast(message, "error");
        }
    };

    const handleRemoveUser = async (organizationId: string, userId: string) => {
        try {
            await api.removeUserFromOrganization(organizationId, userId);
            showToast("User removed from organization", "success");
            await loadData();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to remove user";
            showToast(message, "error");
        }
    };

    const handleApprove = async (entryId: string) => {
        try {
            await api.approveTimeEntry(entryId);
            showToast("Time entry approved", "success");
            await loadData();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to approve time entry";
            showToast(message, "error");
        }
    };

    const handleReject = async (entryId: string) => {
        const note = window.prompt("Reason for rejection (optional)", "");
        try {
            await api.rejectTimeEntry(entryId, note || undefined);
            showToast("Time entry rejected", "success");
            await loadData();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to reject time entry";
            showToast(message, "error");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 size={24} className="animate-spin text-brand-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 bg-gray-50/70 dark:bg-gray-900/50">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center text-white">
                        <Building2 size={18} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Organizations</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Create teams, assign users, and enable approval rules.</p>
                    </div>
                </div>

                <form onSubmit={handleCreateOrganization} className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end mb-5">
                    <label className="space-y-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Organization name</span>
                        <input
                            value={organizationForm.name}
                            onChange={(event) => setOrganizationForm((current) => ({ ...current, name: event.target.value }))}
                            className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
                            placeholder="e.g. Product Team"
                        />
                    </label>

                    <label className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 h-[42px]">
                        <input
                            type="checkbox"
                            checked={organizationForm.approvalRequired}
                            onChange={(event) => setOrganizationForm((current) => ({ ...current, approvalRequired: event.target.checked }))}
                            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-sm">Require approval</span>
                    </label>

                    <button
                        type="submit"
                        disabled={savingOrg}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors h-[42px]"
                    >
                        {savingOrg ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Create
                    </button>
                </form>

                <div className="grid gap-4">
                    {organizations.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400">
                            No organizations yet. Create one above to start grouping users.
                        </div>
                    ) : (
                        organizations.map((organization) => {
                            const assignedUserIds = new Set(organization.users.map((member) => member.id));
                            const availableUsers = users.filter((user) => !assignedUserIds.has(user.id) || user.organization?.id === organization.id);
                            const currentMemberForm = memberForm[organization.id] || { userId: "", organizationRole: "member" };

                            return (
                                <div key={organization.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-base font-semibold">{organization.name}</h4>
                                                {organization.approvalRequired && (
                                                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                                                        Approval required
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {organization._count?.users || 0} users · {organization._count?.pendingApprovals || 0} pending approvals
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <input
                                                defaultValue={organization.name}
                                                onBlur={(event) => {
                                                    const nextName = event.target.value.trim();
                                                    if (nextName && nextName !== organization.name) {
                                                        handleUpdateOrganization(organization, { name: nextName });
                                                    }
                                                }}
                                                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateOrganization(organization, { approvalRequired: !organization.approvalRequired })}
                                                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${organization.approvalRequired
                                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                    }`}
                                            >
                                                {organization.approvalRequired ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                                {organization.approvalRequired ? "Approvals on" : "Approvals off"}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                                            <Users size={14} /> Members
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {organization.users.length === 0 ? (
                                                <span className="text-sm text-gray-500 dark:text-gray-400">No users assigned</span>
                                            ) : (
                                                organization.users.map((member) => (
                                                    <span key={member.id} className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-800 px-3 py-1 text-sm">
                                                        <span>{member.displayName}</span>
                                                        <span className="text-xs text-gray-500">{member.organizationRole}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveUser(organization.id, member.id)}
                                                            className="text-gray-400 hover:text-red-500"
                                                            title="Remove member"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                                        <label className="space-y-1">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Add or move user</span>
                                            <select
                                                value={currentMemberForm.userId}
                                                onChange={(event) =>
                                                    setMemberForm((current) => ({
                                                        ...current,
                                                        [organization.id]: {
                                                            ...currentMemberForm,
                                                            userId: event.target.value,
                                                        },
                                                    }))
                                                }
                                                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
                                            >
                                                <option value="">Select user</option>
                                                {availableUsers.map((user) => (
                                                    <option key={user.id} value={user.id}>
                                                        {user.displayName} ({user.username})
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="space-y-1">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Role</span>
                                            <select
                                                value={currentMemberForm.organizationRole}
                                                onChange={(event) =>
                                                    setMemberForm((current) => ({
                                                        ...current,
                                                        [organization.id]: {
                                                            ...currentMemberForm,
                                                            organizationRole: event.target.value,
                                                        },
                                                    }))
                                                }
                                                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
                                            >
                                                <option value="member">Member</option>
                                                <option value="manager">Manager</option>
                                                <option value="owner">Owner</option>
                                            </select>
                                        </label>

                                        <button
                                            type="button"
                                            onClick={() => handleAssignUser(organization.id)}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                                        >
                                            <Save size={16} />
                                            Assign
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>

            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 bg-gray-50/70 dark:bg-gray-900/50">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white">
                        <CheckCircle2 size={18} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Pending approvals</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Review submitted time entries when an organization requires approval.</p>
                    </div>
                </div>

                {approvals.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400">
                        No pending approvals right now.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {approvals.map((approval) => (
                            <div key={approval.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <strong>{approval.user.displayName}</strong>
                                            {approval.user.organization && (
                                                <span className="text-xs rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-gray-600 dark:text-gray-300">
                                                    {approval.user.organization.name}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {approval.project.name} · {new Date(approval.date).toLocaleDateString()} · {approval.hours} h
                                        </p>
                                        {approval.note && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{approval.note}</p>}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleApprove(approval.id)}
                                            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                                        >
                                            <CheckCircle2 size={14} />
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleReject(approval.id)}
                                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                                        >
                                            <XCircle size={14} />
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
