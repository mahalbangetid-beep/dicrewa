import { useState, useEffect } from 'react';
import {
    Users,
    RefreshCw,
    Search,
    MessageSquare,
    MoreVertical,
    Trash2,
    Eye,
    Send,
    Loader,
    ChevronLeft,
    Shield,
    Crown,
    User as UserIcon,
    Phone,
    Volume2,
    VolumeX,
    X,
    Check,
    AlertCircle,
    Info
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { API_URL } from '../utils/config';

export default function Groups() {
    const [groups, setGroups] = useState([]);
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState(null);
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendMessage, setSendMessage] = useState('');
    const [sending, setSending] = useState(false);

    const getAuthHeader = () => ({
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    });

    useEffect(() => {
        fetchDevices();
    }, []);

    useEffect(() => {
        if (selectedDevice) {
            fetchGroups();
            fetchStats();
        }
    }, [selectedDevice, searchQuery]);

    const fetchDevices = async () => {
        try {
            const res = await fetch(`${API_URL}/devices`, {
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                setDevices(data.data);
                setSelectedDevice(data.data[0].id);
            }
        } catch (error) {
            console.error('Error fetching devices:', error);
            toast.error('Failed to load devices');
        } finally {
            setLoading(false);
        }
    };

    const fetchGroups = async () => {
        if (!selectedDevice) return;

        try {
            const params = new URLSearchParams({ limit: '100' });
            if (searchQuery) params.append('search', searchQuery);

            const res = await fetch(`${API_URL}/groups/device/${selectedDevice}?${params}`, {
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success) {
                setGroups(data.data);
            }
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    };

    const fetchStats = async () => {
        if (!selectedDevice) return;

        try {
            const res = await fetch(`${API_URL}/groups/stats/${selectedDevice}`, {
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success) {
                setStats(data.data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchGroupDetails = async (groupId) => {
        try {
            const res = await fetch(`${API_URL}/groups/${groupId}`, {
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success) {
                setSelectedGroup(data.data);
            }
        } catch (error) {
            console.error('Error fetching group details:', error);
            toast.error('Failed to load group details');
        }
    };

    const handleSyncGroups = async () => {
        if (!selectedDevice) return;

        setSyncing(true);
        try {
            const res = await fetch(`${API_URL}/groups/sync/${selectedDevice}`, {
                method: 'POST',
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchGroups();
                fetchStats();
            } else {
                toast.error(data.error || 'Sync failed');
            }
        } catch (error) {
            console.error('Error syncing groups:', error);
            toast.error('Failed to sync groups');
        } finally {
            setSyncing(false);
        }
    };

    const handleSyncMembers = async () => {
        if (!selectedGroup) return;

        setSyncing(true);
        try {
            const res = await fetch(`${API_URL}/groups/${selectedGroup.id}/sync-members`, {
                method: 'POST',
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchGroupDetails(selectedGroup.id);
            } else {
                toast.error(data.error || 'Sync failed');
            }
        } catch (error) {
            console.error('Error syncing members:', error);
            toast.error('Failed to sync members');
        } finally {
            setSyncing(false);
        }
    };

    const handleDeleteGroup = async (groupId) => {
        if (!confirm('Remove this group from the list?')) return;

        try {
            const res = await fetch(`${API_URL}/groups/${groupId}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Group removed');
                setGroups(groups.filter(g => g.id !== groupId));
                if (selectedGroup?.id === groupId) {
                    setSelectedGroup(null);
                }
            }
        } catch (error) {
            console.error('Error deleting group:', error);
            toast.error('Failed to remove group');
        }
    };

    const handleSendMessage = async () => {
        if (!sendMessage.trim() || !selectedGroup) return;

        setSending(true);
        try {
            const res = await fetch(`${API_URL}/groups/${selectedGroup.id}/send`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({ message: sendMessage })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Message sent to group');
                setShowSendModal(false);
                setSendMessage('');
            } else {
                toast.error(data.error || 'Failed to send');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const getDeviceStatus = () => {
        const device = devices.find(d => d.id === selectedDevice);
        return device?.status || 'unknown';
    };

    if (loading) {
        return (
            <div className="loading-container">
                <Loader className="animate-spin" size={32} />
            </div>
        );
    }

    if (devices.length === 0) {
        return (
            <div className="animate-fade-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Group Management</h1>
                        <p className="page-subtitle">Manage your WhatsApp groups</p>
                    </div>
                </div>
                <div className="empty-state">
                    <Users size={64} className="empty-icon" />
                    <h3>No Devices Found</h3>
                    <p>Add a WhatsApp device first to manage groups</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Group Management</h1>
                    <p className="page-subtitle">Manage your WhatsApp groups and send messages</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                    <select
                        className="form-select"
                        value={selectedDevice}
                        onChange={(e) => {
                            setSelectedDevice(e.target.value);
                            setSelectedGroup(null);
                        }}
                        style={{ width: '200px' }}
                    >
                        {devices.map(device => (
                            <option key={device.id} value={device.id}>
                                {device.name} ({device.status})
                            </option>
                        ))}
                    </select>
                    <button
                        className="btn btn-primary"
                        onClick={handleSyncGroups}
                        disabled={syncing || getDeviceStatus() !== 'connected'}
                    >
                        {syncing ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Sync Groups
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="stats-grid" style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'var(--primary-500)' }}>
                            <Users size={20} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.totalGroups}</span>
                            <span className="stat-label">Total Groups</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'var(--warning)' }}>
                            <Shield size={20} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.adminGroups}</span>
                            <span className="stat-label">Admin In</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'var(--info)' }}>
                            <UserIcon size={20} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.totalMembers?.toLocaleString()}</span>
                            <span className="stat-label">Total Members</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="groups-layout">
                {/* Groups List */}
                <div className="groups-list-panel">
                    <div className="panel-header">
                        <h3>Groups ({groups.length})</h3>
                        <div className="groups-search-input">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Search groups..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="groups-list">
                        {groups.length === 0 ? (
                            <div className="empty-list">
                                <Users size={32} />
                                <p>No groups found</p>
                                <button className="btn btn-primary btn-sm" onClick={handleSyncGroups}>
                                    <RefreshCw size={14} /> Sync Now
                                </button>
                            </div>
                        ) : (
                            groups.map(group => (
                                <div
                                    key={group.id}
                                    className={`group-item ${selectedGroup?.id === group.id ? 'active' : ''}`}
                                    onClick={() => fetchGroupDetails(group.id)}
                                >
                                    <div className="group-avatar">
                                        {group.profilePicUrl ? (
                                            <img src={group.profilePicUrl} alt={group.name} />
                                        ) : (
                                            <Users size={20} />
                                        )}
                                    </div>
                                    <div className="group-info">
                                        <span className="group-name">{group.name}</span>
                                        <span className="group-meta">
                                            {group._count?.members || group.memberCount} members
                                            {group.isAdmin && <span className="admin-badge">Admin</span>}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Group Details */}
                <div className="group-details-panel">
                    {selectedGroup ? (
                        <>
                            <div className="group-header">
                                <button
                                    className="btn btn-ghost btn-icon mobile-back"
                                    onClick={() => setSelectedGroup(null)}
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <div className="group-header-info">
                                    <div className="group-avatar-large">
                                        {selectedGroup.profilePicUrl ? (
                                            <img src={selectedGroup.profilePicUrl} alt={selectedGroup.name} />
                                        ) : (
                                            <Users size={32} />
                                        )}
                                    </div>
                                    <div>
                                        <h2>{selectedGroup.name}</h2>
                                        <p>{selectedGroup.members?.length || selectedGroup.memberCount} members</p>
                                    </div>
                                </div>
                                <div className="group-header-actions">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setShowSendModal(true)}
                                        disabled={getDeviceStatus() !== 'connected'}
                                    >
                                        <Send size={16} /> Send Message
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={handleSyncMembers}
                                        disabled={syncing || getDeviceStatus() !== 'connected'}
                                    >
                                        {syncing ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                        Sync
                                    </button>
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        onClick={() => handleDeleteGroup(selectedGroup.id)}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            {selectedGroup.description && (
                                <div className="group-description">
                                    <Info size={16} />
                                    <span>{selectedGroup.description}</span>
                                </div>
                            )}

                            <div className="group-members">
                                <h4>Members ({selectedGroup.members?.length || 0})</h4>
                                <div className="members-grid">
                                    {selectedGroup.members?.map(member => (
                                        <div key={member.id} className="member-card">
                                            <div className="member-avatar-small">
                                                {member.isSuperAdmin ? (
                                                    <Crown size={14} />
                                                ) : member.isAdmin ? (
                                                    <Shield size={14} />
                                                ) : (
                                                    <UserIcon size={14} />
                                                )}
                                            </div>
                                            <div className="member-details">
                                                <span className="member-name">
                                                    {member.name || member.memberJid.split('@')[0]}
                                                </span>
                                                <span className="member-role">
                                                    {member.isSuperAdmin ? 'Super Admin' : member.isAdmin ? 'Admin' : 'Member'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="group-meta-info">
                                <div className="meta-item">
                                    <span className="meta-label">Group JID</span>
                                    <code>{selectedGroup.groupJid}</code>
                                </div>
                                <div className="meta-item">
                                    <span className="meta-label">Last Synced</span>
                                    <span>{format(new Date(selectedGroup.lastSyncAt), 'PPp')}</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="no-selection">
                            <Users size={48} />
                            <p>Select a group to view details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Send Message Modal */}
            <div className={`modal-overlay ${showSendModal ? 'open' : ''}`} onClick={() => setShowSendModal(false)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3 className="modal-title">Send Message to {selectedGroup?.name}</h3>
                        <button className="modal-close" onClick={() => setShowSendModal(false)}>
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Message</label>
                            <textarea
                                className="form-textarea"
                                rows="5"
                                placeholder="Type your message..."
                                value={sendMessage}
                                onChange={(e) => setSendMessage(e.target.value)}
                            />
                        </div>
                        <div className="info-box">
                            <AlertCircle size={16} />
                            <span>This message will be sent to all {selectedGroup?.memberCount} members in the group.</span>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={() => setShowSendModal(false)}>
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleSendMessage}
                            disabled={sending || !sendMessage.trim()}
                        >
                            {sending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                            Send Message
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
