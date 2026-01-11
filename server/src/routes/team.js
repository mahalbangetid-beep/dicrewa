/**
 * Team Routes (Phase 4)
 * Handles team collaboration API endpoints
 */

const express = require('express');
const router = express.Router();
const { protect: auth } = require('../middleware/auth');
const teamService = require('../services/team');

// ==================== TEAMS ====================

/**
 * GET /api/teams - Get user's teams
 */
router.get('/', auth, async (req, res) => {
    try {
        const teams = await teamService.getUserTeams(req.user.id);
        res.json({ success: true, data: teams });
    } catch (error) {
        console.error('[Team] Error getting teams:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/teams - Create new team
 */
router.post('/', auth, async (req, res) => {
    try {
        const { name, description, avatar } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Team name is required' });
        }

        const team = await teamService.createTeam(req.user.id, {
            name,
            description,
            avatar
        });

        res.json({ success: true, data: team });
    } catch (error) {
        console.error('[Team] Error creating team:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/teams/:id - Get team by ID
 */
router.get('/:id', auth, async (req, res) => {
    try {
        const team = await teamService.getTeamById(req.params.id);

        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // Check if user is a member
        const isMember = team.members.some(m => m.userId === req.user.id);
        if (!isMember) {
            return res.status(403).json({ error: 'Not a team member' });
        }

        res.json({ success: true, data: team });
    } catch (error) {
        console.error('[Team] Error getting team:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/teams/:id - Update team
 */
router.put('/:id', auth, async (req, res) => {
    try {
        const team = await teamService.updateTeam(req.params.id, req.user.id, req.body);
        res.json({ success: true, data: team });
    } catch (error) {
        console.error('[Team] Error updating team:', error);
        res.status(error.message.includes('permission') ? 403 : 500).json({ error: error.message });
    }
});

/**
 * DELETE /api/teams/:id - Delete team
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        await teamService.deleteTeam(req.params.id, req.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Team] Error deleting team:', error);
        res.status(error.message.includes('owner') ? 403 : 500).json({ error: error.message });
    }
});

// ==================== MEMBERS ====================

/**
 * GET /api/teams/:id/members - Get team members
 */
router.get('/:id/members', auth, async (req, res) => {
    try {
        const team = await teamService.getTeamById(req.params.id);

        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // Verify user is a member of this team (prevent IDOR)
        const isMember = team.members.some(m => m.userId === req.user.id);
        if (!isMember) {
            return res.status(403).json({ error: 'Not a team member' });
        }

        res.json({ success: true, data: team.members });
    } catch (error) {
        console.error('[Team] Error getting members:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/teams/:id/members/:userId/role - Update member role
 */
router.put('/:id/members/:userId/role', auth, async (req, res) => {
    try {
        const { role } = req.body;

        if (!role || !['admin', 'member'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const member = await teamService.updateMemberRole(
            req.params.id,
            req.params.userId,
            role,
            req.user.id
        );

        res.json({ success: true, data: member });
    } catch (error) {
        console.error('[Team] Error updating role:', error);
        res.status(error.message.includes('permission') ? 403 : 500).json({ error: error.message });
    }
});

/**
 * DELETE /api/teams/:id/members/:userId - Remove member
 */
router.delete('/:id/members/:userId', auth, async (req, res) => {
    try {
        await teamService.removeMember(req.params.id, req.params.userId, req.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Team] Error removing member:', error);
        res.status(error.message.includes('permission') ? 403 : 500).json({ error: error.message });
    }
});

/**
 * POST /api/teams/:id/leave - Leave team
 */
router.post('/:id/leave', auth, async (req, res) => {
    try {
        await teamService.removeMember(req.params.id, req.user.id, req.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Team] Error leaving team:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== INVITES ====================

/**
 * GET /api/teams/:id/invites - Get team invites
 */
router.get('/:id/invites', auth, async (req, res) => {
    try {
        const hasPermission = await teamService.checkTeamPermission(req.params.id, req.user.id, 'admin');
        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const invites = await teamService.getTeamInvites(req.params.id);
        res.json({ success: true, data: invites });
    } catch (error) {
        console.error('[Team] Error getting invites:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/teams/:id/invites - Create invite
 */
router.post('/:id/invites', auth, async (req, res) => {
    try {
        const { email, role = 'member' } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const invite = await teamService.createInvite(
            req.params.id,
            req.user.id,
            email,
            role
        );

        res.json({ success: true, data: invite });
    } catch (error) {
        console.error('[Team] Error creating invite:', error);
        res.status(error.message.includes('permission') ? 403 : 500).json({ error: error.message });
    }
});

/**
 * DELETE /api/teams/invites/:inviteId - Cancel invite
 */
router.delete('/invites/:inviteId', auth, async (req, res) => {
    try {
        await teamService.cancelInvite(req.params.inviteId, req.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Team] Error cancelling invite:', error);
        res.status(error.message.includes('permission') ? 403 : 500).json({ error: error.message });
    }
});

/**
 * POST /api/teams/invites/:inviteId/resend - Resend invite
 */
router.post('/invites/:inviteId/resend', auth, async (req, res) => {
    try {
        const invite = await teamService.resendInvite(req.params.inviteId, req.user.id);
        res.json({ success: true, data: invite });
    } catch (error) {
        console.error('[Team] Error resending invite:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/teams/invite/:token - Get invite by token (public)
 */
router.get('/invite/:token', async (req, res) => {
    try {
        const invite = await teamService.getInviteByToken(req.params.token);

        if (!invite) {
            return res.status(404).json({ error: 'Invalid invitation' });
        }

        if (invite.status !== 'pending') {
            return res.status(400).json({ error: 'Invitation is no longer valid' });
        }

        if (new Date() > invite.expiresAt) {
            return res.status(400).json({ error: 'Invitation has expired' });
        }

        res.json({
            success: true,
            data: {
                team: invite.team,
                email: invite.email,
                role: invite.role,
                expiresAt: invite.expiresAt
            }
        });
    } catch (error) {
        console.error('[Team] Error getting invite:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/teams/invite/:token/accept - Accept invite
 */
router.post('/invite/:token/accept', auth, async (req, res) => {
    try {
        const team = await teamService.acceptInvite(req.params.token, req.user.id);
        res.json({ success: true, data: team });
    } catch (error) {
        console.error('[Team] Error accepting invite:', error);
        res.status(400).json({ error: error.message });
    }
});

// ==================== OWNERSHIP ====================

/**
 * POST /api/teams/:id/transfer-ownership - Transfer ownership
 */
router.post('/:id/transfer-ownership', auth, async (req, res) => {
    try {
        const { newOwnerId } = req.body;

        if (!newOwnerId) {
            return res.status(400).json({ error: 'New owner ID is required' });
        }

        const team = await teamService.transferOwnership(
            req.params.id,
            req.user.id,
            newOwnerId
        );

        res.json({ success: true, data: team });
    } catch (error) {
        console.error('[Team] Error transferring ownership:', error);
        res.status(error.message.includes('owner') ? 403 : 500).json({ error: error.message });
    }
});

/**
 * GET /api/teams/:id/my-role - Get current user's role in team
 */
router.get('/:id/my-role', auth, async (req, res) => {
    try {
        const member = await teamService.getTeamMember(req.params.id, req.user.id);

        if (!member) {
            return res.status(404).json({ error: 'Not a team member' });
        }

        res.json({
            success: true,
            data: {
                role: member.role,
                permissions: member.permissions ? JSON.parse(member.permissions) : []
            }
        });
    } catch (error) {
        console.error('[Team] Error getting role:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
