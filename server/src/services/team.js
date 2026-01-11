/**
 * Team Collaboration Service (Phase 4)
 * Handles team management, member roles, and invite system
 */

const prisma = require('../utils/prisma');
const crypto = require('crypto');

// Role hierarchy for permission checks
const ROLE_HIERARCHY = {
    owner: 3,
    admin: 2,
    member: 1
};

// Default permissions by role
const DEFAULT_PERMISSIONS = {
    owner: ['all'],
    admin: ['manage_members', 'manage_devices', 'manage_broadcasts', 'manage_chatbots', 'view_analytics'],
    member: ['send_messages', 'view_contacts', 'use_templates']
};

/**
 * Generate invite token
 */
const generateToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Create a new team
 */
const createTeam = async (ownerId, teamData) => {
    const { name, description, avatar } = teamData;

    // Create team
    const team = await prisma.team.create({
        data: {
            name,
            description,
            avatar,
            ownerId
        }
    });

    // Add owner as team member with owner role
    await prisma.teamMember.create({
        data: {
            teamId: team.id,
            userId: ownerId,
            role: 'owner',
            permissions: JSON.stringify(DEFAULT_PERMISSIONS.owner)
        }
    });

    return getTeamById(team.id);
};

/**
 * Get team by ID with members
 */
const getTeamById = async (teamId) => {
    return prisma.team.findUnique({
        where: { id: teamId },
        include: {
            owner: {
                select: { id: true, name: true, email: true, avatar: true }
            },
            members: {
                include: {
                    user: {
                        select: { id: true, name: true, email: true, avatar: true }
                    }
                },
                orderBy: [
                    { role: 'desc' },
                    { joinedAt: 'asc' }
                ]
            },
            invites: {
                where: { status: 'pending' }
            }
        }
    });
};

/**
 * Get user's teams
 */
const getUserTeams = async (userId) => {
    const memberships = await prisma.teamMember.findMany({
        where: { userId },
        include: {
            team: {
                include: {
                    owner: {
                        select: { id: true, name: true, email: true }
                    },
                    members: {
                        select: { id: true, role: true }
                    }
                }
            }
        },
        orderBy: { joinedAt: 'desc' }
    });

    return memberships.map(m => ({
        ...m.team,
        role: m.role,
        joinedAt: m.joinedAt,
        memberCount: m.team.members.length
    }));
};

/**
 * Update team
 */
const updateTeam = async (teamId, userId, updates) => {
    // Check if user has permission
    const hasPermission = await checkTeamPermission(teamId, userId, 'admin');
    if (!hasPermission) {
        throw new Error('Insufficient permissions');
    }

    const { name, description, avatar, settings } = updates;

    return prisma.team.update({
        where: { id: teamId },
        data: {
            name,
            description,
            avatar,
            settings: settings ? JSON.stringify(settings) : undefined
        }
    });
};

/**
 * Delete team (owner only)
 */
const deleteTeam = async (teamId, userId) => {
    const team = await prisma.team.findUnique({
        where: { id: teamId }
    });

    if (!team) throw new Error('Team not found');
    if (team.ownerId !== userId) throw new Error('Only team owner can delete team');

    await prisma.team.delete({
        where: { id: teamId }
    });

    return { success: true };
};

/**
 * Check if user has permission in team
 */
const checkTeamPermission = async (teamId, userId, requiredRole = 'member') => {
    const membership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } }
    });

    if (!membership) return false;

    const userRoleLevel = ROLE_HIERARCHY[membership.role] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole] || 0;

    return userRoleLevel >= requiredRoleLevel;
};

/**
 * Get team member
 */
const getTeamMember = async (teamId, userId) => {
    return prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
        include: {
            user: {
                select: { id: true, name: true, email: true, avatar: true }
            }
        }
    });
};

/**
 * Update member role
 */
const updateMemberRole = async (teamId, targetUserId, newRole, requesterId) => {
    // Check requester has admin/owner permission
    const hasPermission = await checkTeamPermission(teamId, requesterId, 'admin');
    if (!hasPermission) {
        throw new Error('Insufficient permissions');
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });

    // Can't change owner's role
    if (targetUserId === team.ownerId) {
        throw new Error('Cannot change owner role');
    }

    // Only owner can make someone admin
    if (newRole === 'admin' && team.ownerId !== requesterId) {
        throw new Error('Only owner can assign admin role');
    }

    return prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId: targetUserId } },
        data: {
            role: newRole,
            permissions: JSON.stringify(DEFAULT_PERMISSIONS[newRole] || [])
        },
        include: {
            user: {
                select: { id: true, name: true, email: true }
            }
        }
    });
};

/**
 * Remove member from team
 */
const removeMember = async (teamId, targetUserId, requesterId) => {
    // Check requester has admin permission (or is removing themselves)
    if (targetUserId !== requesterId) {
        const hasPermission = await checkTeamPermission(teamId, requesterId, 'admin');
        if (!hasPermission) {
            throw new Error('Insufficient permissions');
        }
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });

    // Can't remove owner
    if (targetUserId === team.ownerId) {
        throw new Error('Cannot remove team owner');
    }

    await prisma.teamMember.delete({
        where: { teamId_userId: { teamId, userId: targetUserId } }
    });

    return { success: true };
};

/**
 * Create team invite
 */
const createInvite = async (teamId, inviterId, email, role = 'member') => {
    // Check inviter has admin permission
    const hasPermission = await checkTeamPermission(teamId, inviterId, 'admin');
    if (!hasPermission) {
        throw new Error('Insufficient permissions');
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        const existingMember = await prisma.teamMember.findUnique({
            where: { teamId_userId: { teamId, userId: existingUser.id } }
        });
        if (existingMember) {
            throw new Error('User is already a team member');
        }
    }

    // Check for existing pending invite
    const existingInvite = await prisma.teamInvite.findFirst({
        where: {
            teamId,
            email,
            status: 'pending'
        }
    });
    if (existingInvite) {
        throw new Error('Invitation already sent to this email');
    }

    // Create invite (valid for 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await prisma.teamInvite.create({
        data: {
            teamId,
            email,
            role,
            token: generateToken(),
            invitedBy: inviterId,
            expiresAt
        },
        include: {
            team: {
                select: { id: true, name: true }
            }
        }
    });

    // TODO: Send invitation email

    return invite;
};

/**
 * Get team invites
 */
const getTeamInvites = async (teamId) => {
    return prisma.teamInvite.findMany({
        where: { teamId },
        orderBy: { createdAt: 'desc' }
    });
};

/**
 * Accept invite by token
 */
const acceptInvite = async (token, userId) => {
    const invite = await prisma.teamInvite.findUnique({
        where: { token },
        include: { team: true }
    });

    if (!invite) throw new Error('Invalid invitation');
    if (invite.status !== 'pending') throw new Error('Invitation is no longer valid');
    if (new Date() > invite.expiresAt) {
        await prisma.teamInvite.update({
            where: { id: invite.id },
            data: { status: 'expired' }
        });
        throw new Error('Invitation has expired');
    }

    // Get user email
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.email !== invite.email) {
        throw new Error('This invitation is for a different email address');
    }

    // Add user to team
    await prisma.teamMember.create({
        data: {
            teamId: invite.teamId,
            userId,
            role: invite.role,
            permissions: JSON.stringify(DEFAULT_PERMISSIONS[invite.role] || [])
        }
    });

    // Update invite status
    await prisma.teamInvite.update({
        where: { id: invite.id },
        data: {
            status: 'accepted',
            acceptedAt: new Date()
        }
    });

    return getTeamById(invite.teamId);
};

/**
 * Cancel invite
 */
const cancelInvite = async (inviteId, requesterId) => {
    const invite = await prisma.teamInvite.findUnique({
        where: { id: inviteId }
    });

    if (!invite) throw new Error('Invite not found');

    // Check permission
    const hasPermission = await checkTeamPermission(invite.teamId, requesterId, 'admin');
    if (!hasPermission) {
        throw new Error('Insufficient permissions');
    }

    await prisma.teamInvite.update({
        where: { id: inviteId },
        data: { status: 'cancelled' }
    });

    return { success: true };
};

/**
 * Resend invite
 */
const resendInvite = async (inviteId, requesterId) => {
    const invite = await prisma.teamInvite.findUnique({
        where: { id: inviteId }
    });

    if (!invite) throw new Error('Invite not found');

    // Check permission
    const hasPermission = await checkTeamPermission(invite.teamId, requesterId, 'admin');
    if (!hasPermission) {
        throw new Error('Insufficient permissions');
    }

    // Reset expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const updatedInvite = await prisma.teamInvite.update({
        where: { id: inviteId },
        data: {
            token: generateToken(),
            expiresAt,
            status: 'pending'
        }
    });

    // TODO: Resend email

    return updatedInvite;
};

/**
 * Transfer team ownership
 */
const transferOwnership = async (teamId, currentOwnerId, newOwnerId) => {
    const team = await prisma.team.findUnique({ where: { id: teamId } });

    if (!team) throw new Error('Team not found');
    if (team.ownerId !== currentOwnerId) throw new Error('Only current owner can transfer ownership');

    // Check new owner is a member
    const newOwnerMembership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: newOwnerId } }
    });
    if (!newOwnerMembership) throw new Error('New owner must be a team member');

    // Update team owner
    await prisma.team.update({
        where: { id: teamId },
        data: { ownerId: newOwnerId }
    });

    // Update roles
    await prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId: newOwnerId } },
        data: {
            role: 'owner',
            permissions: JSON.stringify(DEFAULT_PERMISSIONS.owner)
        }
    });

    await prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId: currentOwnerId } },
        data: {
            role: 'admin',
            permissions: JSON.stringify(DEFAULT_PERMISSIONS.admin)
        }
    });

    return getTeamById(teamId);
};

/**
 * Get invite by token (for validation)
 */
const getInviteByToken = async (token) => {
    return prisma.teamInvite.findUnique({
        where: { token },
        include: {
            team: {
                select: { id: true, name: true, description: true }
            }
        }
    });
};

module.exports = {
    createTeam,
    getTeamById,
    getUserTeams,
    updateTeam,
    deleteTeam,
    checkTeamPermission,
    getTeamMember,
    updateMemberRole,
    removeMember,
    createInvite,
    getTeamInvites,
    acceptInvite,
    cancelInvite,
    resendInvite,
    transferOwnership,
    getInviteByToken,
    ROLE_HIERARCHY,
    DEFAULT_PERMISSIONS
};
