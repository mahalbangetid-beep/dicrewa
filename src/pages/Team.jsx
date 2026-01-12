import { useState, useEffect } from 'react';
import {
    Users,
    Plus,
    Settings,
    UserPlus,
    Crown,
    Shield,
    User as UserIcon,
    Mail,
    MoreVertical,
    Trash2,
    Edit,
    LogOut,
    RefreshCw,
    Check,
    X,
    Clock,
    Send,
    Copy,
    Loader,
    AlertCircle,
    ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { API_URL } from '../utils/config';
import { useConfirm } from '../components/ConfirmDialog';

// Role icons
const roleIcons = {
    owner: Crown,
    admin: Shield,
    member: UserIcon
};

const roleColors = {
    owner: 'var(--warning)',
    admin: 'var(--primary-500)',
    member: 'var(--text-muted)'
};

export default function Team() {
    const confirm = useConfirm();
    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [memberMenuOpen, setMemberMenuOpen] = useState(null);
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    // Form states
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamDescription, setNewTeamDescription] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('member');

    const getAuthHeader = () => ({
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    });

    useEffect(() => {
        fetchTeams();
    }, []);

    const fetchTeams = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/teams`, {
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success) {
                setTeams(data.data);
                // Auto-select first team if none selected
                if (data.data.length > 0 && !selectedTeam) {
                    fetchTeamDetails(data.data[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching teams:', error);
            toast.error('Failed to load teams');
        } finally {
            setLoading(false);
        }
    };

    const fetchTeamDetails = async (teamId) => {
        try {
            const res = await fetch(`${API_URL}/teams/${teamId}`, {
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success) {
                setSelectedTeam(data.data);
            }
        } catch (error) {
            console.error('Error fetching team details:', error);
        }
    };

    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) {
            toast.error('Team name is required');
            return;
        }

        setActionLoading(true);
        try {
            const res = await fetch(`${API_URL}/teams`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({
                    name: newTeamName,
                    description: newTeamDescription
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Team created successfully!');
                setShowCreateModal(false);
                setNewTeamName('');
                setNewTeamDescription('');
                fetchTeams();
                setSelectedTeam(data.data);
            } else {
                toast.error(data.error || 'Failed to create team');
            }
        } catch (error) {
            console.error('Error creating team:', error);
            toast.error('Failed to create team');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteTeam = async () => {
        const isConfirmed = await confirm({
            title: 'Delete Team?',
            message: 'Are you sure you want to delete this team? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        });
        if (!isConfirmed) return;

        setActionLoading(true);
        try {
            const res = await fetch(`${API_URL}/teams/${selectedTeam.id}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Team deleted');
                setSelectedTeam(null);
                setShowSettingsModal(false);
                fetchTeams();
            } else {
                toast.error(data.error || 'Failed to delete team');
            }
        } catch (error) {
            console.error('Error deleting team:', error);
            toast.error('Failed to delete team');
        } finally {
            setActionLoading(false);
        }
    };

    const handleInviteMember = async () => {
        if (!inviteEmail.trim()) {
            toast.error('Email is required');
            return;
        }

        setActionLoading(true);
        try {
            const res = await fetch(`${API_URL}/teams/${selectedTeam.id}/invites`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({
                    email: inviteEmail,
                    role: inviteRole
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Invitation sent to ${inviteEmail}`);
                setShowInviteModal(false);
                setInviteEmail('');
                setInviteRole('member');
                fetchTeamDetails(selectedTeam.id);
            } else {
                toast.error(data.error || 'Failed to send invitation');
            }
        } catch (error) {
            console.error('Error sending invite:', error);
            toast.error('Failed to send invitation');
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpdateMemberRole = async (userId, newRole) => {
        try {
            const res = await fetch(`${API_URL}/teams/${selectedTeam.id}/members/${userId}/role`, {
                method: 'PUT',
                headers: getAuthHeader(),
                body: JSON.stringify({ role: newRole })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Role updated');
                fetchTeamDetails(selectedTeam.id);
            } else {
                toast.error(data.error || 'Failed to update role');
            }
        } catch (error) {
            console.error('Error updating role:', error);
            toast.error('Failed to update role');
        }
        setMemberMenuOpen(null);
    };

    const handleRemoveMember = async (userId) => {
        const isConfirmed = await confirm({
            title: 'Remove Member?',
            message: 'Are you sure you want to remove this member from the team?',
            confirmText: 'Remove',
            cancelText: 'Cancel',
            danger: true
        });
        if (!isConfirmed) return;

        try {
            const res = await fetch(`${API_URL}/teams/${selectedTeam.id}/members/${userId}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Member removed');
                fetchTeamDetails(selectedTeam.id);
            } else {
                toast.error(data.error || 'Failed to remove member');
            }
        } catch (error) {
            console.error('Error removing member:', error);
            toast.error('Failed to remove member');
        }
        setMemberMenuOpen(null);
    };

    const handleLeaveTeam = async () => {
        const isConfirmed = await confirm({
            title: 'Leave Team?',
            message: 'Are you sure you want to leave this team?',
            confirmText: 'Yes, Leave',
            cancelText: 'Cancel',
            danger: false
        });
        if (!isConfirmed) return;

        try {
            const res = await fetch(`${API_URL}/teams/${selectedTeam.id}/leave`, {
                method: 'POST',
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Left team successfully');
                setSelectedTeam(null);
                fetchTeams();
            } else {
                toast.error(data.error || 'Failed to leave team');
            }
        } catch (error) {
            console.error('Error leaving team:', error);
            toast.error('Failed to leave team');
        }
    };

    const handleCancelInvite = async (inviteId) => {
        try {
            const res = await fetch(`${API_URL}/teams/invites/${inviteId}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Invitation cancelled');
                fetchTeamDetails(selectedTeam.id);
            }
        } catch (error) {
            console.error('Error cancelling invite:', error);
        }
    };

    const getCurrentUserRole = () => {
        if (!selectedTeam) return null;
        const member = selectedTeam.members.find(m => m.userId === currentUser.id);
        return member?.role || null;
    };

    const isAdmin = () => {
        const role = getCurrentUserRole();
        return role === 'owner' || role === 'admin';
    };

    const isOwner = () => {
        return getCurrentUserRole() === 'owner';
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Team Collaboration</h1>
                    <p className="page-subtitle">Manage your teams, members, and permissions</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    <Plus size={16} /> Create Team
                </button>
            </div>

            {loading ? (
                <div className="loading-container">
                    <Loader className="animate-spin" size={32} />
                </div>
            ) : teams.length === 0 ? (
                <div className="empty-state">
                    <Users size={64} className="empty-icon" />
                    <h3>No Teams Yet</h3>
                    <p>Create your first team to start collaborating with your colleagues</p>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <Plus size={16} /> Create Team
                    </button>
                </div>
            ) : (
                <div className="team-layout">
                    {/* Team List Sidebar */}
                    <div className="team-sidebar">
                        <h3 className="sidebar-title">Your Teams</h3>
                        <div className="team-list">
                            {teams.map((team) => (
                                <div
                                    key={team.id}
                                    className={`team-item ${selectedTeam?.id === team.id ? 'active' : ''}`}
                                    onClick={() => fetchTeamDetails(team.id)}
                                >
                                    <div className="team-avatar">
                                        {team.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="team-info">
                                        <span className="team-name">{team.name}</span>
                                        <span className="team-meta">
                                            {team.memberCount} member{team.memberCount !== 1 ? 's' : ''} • {team.role}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Team Details */}
                    {selectedTeam && (
                        <div className="team-content">
                            {/* Team Header */}
                            <div className="team-header">
                                <div className="team-header-info">
                                    <div className="team-avatar-large">
                                        {selectedTeam.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2>{selectedTeam.name}</h2>
                                        <p>{selectedTeam.description || 'No description'}</p>
                                    </div>
                                </div>
                                <div className="team-header-actions">
                                    {isAdmin() && (
                                        <>
                                            <button className="btn btn-secondary" onClick={() => setShowInviteModal(true)}>
                                                <UserPlus size={16} /> Invite
                                            </button>
                                            <button className="btn btn-ghost btn-icon" onClick={() => setShowSettingsModal(true)}>
                                                <Settings size={18} />
                                            </button>
                                        </>
                                    )}
                                    {!isOwner() && (
                                        <button className="btn btn-ghost" onClick={handleLeaveTeam}>
                                            <LogOut size={16} /> Leave
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Members List */}
                            <div className="card">
                                <div className="card-header">
                                    <div>
                                        <h3 className="card-title">Team Members</h3>
                                        <p className="card-subtitle">{selectedTeam.members.length} members</p>
                                    </div>
                                </div>
                                <div className="members-list">
                                    {selectedTeam.members.map((member) => {
                                        const RoleIcon = roleIcons[member.role] || UserIcon;
                                        return (
                                            <div key={member.id} className="member-item">
                                                <div className="member-info">
                                                    <div className="member-avatar">
                                                        {member.user.name?.substring(0, 2).toUpperCase() || '??'}
                                                    </div>
                                                    <div>
                                                        <span className="member-name">
                                                            {member.user.name}
                                                            {member.userId === currentUser.id && ' (You)'}
                                                        </span>
                                                        <span className="member-email">{member.user.email}</span>
                                                    </div>
                                                </div>
                                                <div className="member-role">
                                                    <span className="role-badge" style={{ color: roleColors[member.role] }}>
                                                        <RoleIcon size={14} />
                                                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                                                    </span>
                                                </div>
                                                {isAdmin() && member.role !== 'owner' && member.userId !== currentUser.id && (
                                                    <div className="member-actions">
                                                        <button
                                                            className="btn btn-ghost btn-icon"
                                                            onClick={() => setMemberMenuOpen(memberMenuOpen === member.id ? null : member.id)}
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>
                                                        {memberMenuOpen === member.id && (
                                                            <div className="dropdown-menu">
                                                                {isOwner() && member.role === 'member' && (
                                                                    <button onClick={() => handleUpdateMemberRole(member.userId, 'admin')}>
                                                                        <Shield size={14} /> Make Admin
                                                                    </button>
                                                                )}
                                                                {isOwner() && member.role === 'admin' && (
                                                                    <button onClick={() => handleUpdateMemberRole(member.userId, 'member')}>
                                                                        <UserIcon size={14} /> Remove Admin
                                                                    </button>
                                                                )}
                                                                <button className="danger" onClick={() => handleRemoveMember(member.userId)}>
                                                                    <Trash2 size={14} /> Remove
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Pending Invites */}
                            {isAdmin() && selectedTeam.invites && selectedTeam.invites.length > 0 && (
                                <div className="card mt-lg">
                                    <div className="card-header">
                                        <div>
                                            <h3 className="card-title">Pending Invitations</h3>
                                            <p className="card-subtitle">{selectedTeam.invites.length} pending</p>
                                        </div>
                                    </div>
                                    <div className="invites-list">
                                        {selectedTeam.invites.map((invite) => (
                                            <div key={invite.id} className="invite-item">
                                                <div className="invite-info">
                                                    <Mail size={16} />
                                                    <span>{invite.email}</span>
                                                    <span className="badge badge-neutral">{invite.role}</span>
                                                </div>
                                                <div className="invite-meta">
                                                    <Clock size={14} />
                                                    <span>Expires {format(new Date(invite.expiresAt), 'MMM d, yyyy')}</span>
                                                </div>
                                                <button
                                                    className="btn btn-ghost btn-icon btn-sm"
                                                    onClick={() => handleCancelInvite(invite.id)}
                                                    title="Cancel invitation"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Create Team Modal */}
            <div className={`modal-overlay ${showCreateModal ? 'open' : ''}`} onClick={() => setShowCreateModal(false)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3 className="modal-title">Create New Team</h3>
                        <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Team Name *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Enter team name"
                                value={newTeamName}
                                onChange={(e) => setNewTeamName(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea
                                className="form-textarea"
                                rows="3"
                                placeholder="What's this team about?"
                                value={newTeamDescription}
                                onChange={(e) => setNewTeamDescription(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" onClick={handleCreateTeam} disabled={actionLoading}>
                            {actionLoading ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
                            Create Team
                        </button>
                    </div>
                </div>
            </div>

            {/* Invite Modal */}
            <div className={`modal-overlay ${showInviteModal ? 'open' : ''}`} onClick={() => setShowInviteModal(false)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3 className="modal-title">Invite Team Member</h3>
                        <button className="modal-close" onClick={() => setShowInviteModal(false)}>
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Email Address *</label>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="colleague@company.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Role</label>
                            <select
                                className="form-select"
                                value={inviteRole}
                                onChange={(e) => setInviteRole(e.target.value)}
                            >
                                <option value="member">Member - Can send messages and use templates</option>
                                {isOwner() && <option value="admin">Admin - Can manage team settings and members</option>}
                            </select>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" onClick={handleInviteMember} disabled={actionLoading}>
                            {actionLoading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                            Send Invitation
                        </button>
                    </div>
                </div>
            </div>

            {/* Team Settings Modal */}
            <div className={`modal-overlay ${showSettingsModal ? 'open' : ''}`} onClick={() => setShowSettingsModal(false)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3 className="modal-title">Team Settings</h3>
                        <button className="modal-close" onClick={() => setShowSettingsModal(false)}>
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Team Name</label>
                            <input
                                type="text"
                                className="form-input"
                                value={selectedTeam?.name || ''}
                                readOnly
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Created</label>
                            <input
                                type="text"
                                className="form-input"
                                value={selectedTeam ? format(new Date(selectedTeam.createdAt), 'MMMM d, yyyy') : ''}
                                readOnly
                            />
                        </div>

                        {isOwner() && (
                            <div className="danger-zone">
                                <h4>Danger Zone</h4>
                                <p>Deleting a team is permanent and cannot be undone.</p>
                                <button className="btn btn-error" onClick={handleDeleteTeam} disabled={actionLoading}>
                                    <Trash2 size={16} /> Delete Team
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={() => setShowSettingsModal(false)}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
