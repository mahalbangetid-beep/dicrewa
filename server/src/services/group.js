/**
 * Group Management Service (Phase 7)
 * Handles WhatsApp group fetching, management, and messaging
 */

const prisma = require('../utils/prisma');

/**
 * Sync groups from WhatsApp connection
 */
const syncGroups = async (deviceId, whatsappGroups) => {
    const syncResults = {
        synced: 0,
        added: 0,
        updated: 0,
        errors: []
    };

    for (const waGroup of whatsappGroups) {
        try {
            const existingGroup = await prisma.groupInfo.findUnique({
                where: {
                    deviceId_groupJid: {
                        deviceId,
                        groupJid: waGroup.id
                    }
                }
            });

            const groupData = {
                name: waGroup.subject || waGroup.name || 'Unknown Group',
                description: waGroup.desc || waGroup.description || null,
                subject: waGroup.subject || null,
                owner: waGroup.owner || waGroup.subjectOwner || null,
                memberCount: waGroup.participants?.length || waGroup.size || 0,
                isAdmin: waGroup.isAdmin || false,
                profilePicUrl: waGroup.profilePicUrl || null,
                lastSyncAt: new Date()
            };

            if (existingGroup) {
                await prisma.groupInfo.update({
                    where: { id: existingGroup.id },
                    data: groupData
                });
                syncResults.updated++;
            } else {
                await prisma.groupInfo.create({
                    data: {
                        deviceId,
                        groupJid: waGroup.id,
                        ...groupData
                    }
                });
                syncResults.added++;
            }
            syncResults.synced++;
        } catch (error) {
            console.error(`[Group] Error syncing group ${waGroup.id}:`, error);
            syncResults.errors.push({ groupJid: waGroup.id, error: error.message });
        }
    }

    return syncResults;
};

/**
 * Sync group members
 */
const syncGroupMembers = async (groupId, participants) => {
    const syncResults = {
        synced: 0,
        added: 0,
        updated: 0
    };

    for (const participant of participants) {
        try {
            const existingMember = await prisma.groupMember.findUnique({
                where: {
                    groupId_memberJid: {
                        groupId,
                        memberJid: participant.id
                    }
                }
            });

            const memberData = {
                name: participant.name || participant.notify || null,
                isAdmin: participant.admin === 'admin',
                isSuperAdmin: participant.admin === 'superadmin'
            };

            if (existingMember) {
                await prisma.groupMember.update({
                    where: { id: existingMember.id },
                    data: memberData
                });
                syncResults.updated++;
            } else {
                await prisma.groupMember.create({
                    data: {
                        groupId,
                        memberJid: participant.id,
                        ...memberData
                    }
                });
                syncResults.added++;
            }
            syncResults.synced++;
        } catch (error) {
            console.error(`[Group] Error syncing member ${participant.id}:`, error);
        }
    }

    return syncResults;
};

/**
 * Get all groups for a device
 */
const getDeviceGroups = async (deviceId, options = {}) => {
    const { search, sortBy = 'name', sortOrder = 'asc', limit = 50, offset = 0 } = options;

    const where = { deviceId };

    if (search) {
        where.OR = [
            { name: { contains: search } },
            { description: { contains: search } }
        ];
    }

    const [groups, total] = await Promise.all([
        prisma.groupInfo.findMany({
            where,
            orderBy: { [sortBy]: sortOrder },
            take: limit,
            skip: offset,
            include: {
                _count: {
                    select: { members: true }
                }
            }
        }),
        prisma.groupInfo.count({ where })
    ]);

    return { groups, total };
};

/**
 * Get group by ID
 */
const getGroupById = async (groupId) => {
    return prisma.groupInfo.findUnique({
        where: { id: groupId },
        include: {
            device: {
                select: { id: true, name: true, phone: true, status: true }
            },
            members: {
                orderBy: [
                    { isSuperAdmin: 'desc' },
                    { isAdmin: 'desc' },
                    { name: 'asc' }
                ]
            }
        }
    });
};

/**
 * Get group by JID
 */
const getGroupByJid = async (deviceId, groupJid) => {
    return prisma.groupInfo.findUnique({
        where: {
            deviceId_groupJid: { deviceId, groupJid }
        },
        include: {
            members: true
        }
    });
};

/**
 * Get group members
 */
const getGroupMembers = async (groupId, options = {}) => {
    const { search, filter, limit = 100, offset = 0 } = options;

    const where = { groupId };

    if (search) {
        where.OR = [
            { name: { contains: search } },
            { memberJid: { contains: search } }
        ];
    }

    if (filter === 'admins') {
        where.OR = [
            { isAdmin: true },
            { isSuperAdmin: true }
        ];
    }

    return prisma.groupMember.findMany({
        where,
        orderBy: [
            { isSuperAdmin: 'desc' },
            { isAdmin: 'desc' },
            { name: 'asc' }
        ],
        take: limit,
        skip: offset
    });
};

/**
 * Update group info
 */
const updateGroup = async (groupId, data) => {
    const { isMuted } = data;

    return prisma.groupInfo.update({
        where: { id: groupId },
        data: { isMuted }
    });
};

/**
 * Delete group from database (doesn't leave WhatsApp group)
 */
const deleteGroup = async (groupId) => {
    await prisma.groupInfo.delete({
        where: { id: groupId }
    });
    return { success: true };
};

/**
 * Get group statistics for a device
 */
const getGroupStats = async (deviceId) => {
    const [totalGroups, adminGroups, totalMembers] = await Promise.all([
        prisma.groupInfo.count({ where: { deviceId } }),
        prisma.groupInfo.count({ where: { deviceId, isAdmin: true } }),
        prisma.groupMember.count({
            where: {
                group: { deviceId }
            }
        })
    ]);

    // Get largest groups
    const largestGroups = await prisma.groupInfo.findMany({
        where: { deviceId },
        orderBy: { memberCount: 'desc' },
        take: 5,
        select: {
            id: true,
            name: true,
            memberCount: true
        }
    });

    return {
        totalGroups,
        adminGroups,
        totalMembers,
        largestGroups
    };
};

/**
 * Get all groups for a user (across all devices)
 */
const getUserGroups = async (userId, options = {}) => {
    const { search, deviceId, limit = 50, offset = 0 } = options;

    const where = {
        device: { userId }
    };

    if (deviceId) {
        where.deviceId = deviceId;
    }

    if (search) {
        where.name = { contains: search };
    }

    const [groups, total] = await Promise.all([
        prisma.groupInfo.findMany({
            where,
            orderBy: { name: 'asc' },
            take: limit,
            skip: offset,
            include: {
                device: {
                    select: { id: true, name: true, status: true }
                },
                _count: {
                    select: { members: true }
                }
            }
        }),
        prisma.groupInfo.count({ where })
    ]);

    return { groups, total };
};

/**
 * Bulk delete groups
 */
const bulkDeleteGroups = async (groupIds) => {
    const result = await prisma.groupInfo.deleteMany({
        where: {
            id: { in: groupIds }
        }
    });
    return { deleted: result.count };
};

/**
 * Search members across all groups
 */
const searchMembers = async (deviceId, query) => {
    return prisma.groupMember.findMany({
        where: {
            group: { deviceId },
            OR: [
                { name: { contains: query } },
                { memberJid: { contains: query } }
            ]
        },
        include: {
            group: {
                select: { id: true, name: true }
            }
        },
        take: 50
    });
};

module.exports = {
    syncGroups,
    syncGroupMembers,
    getDeviceGroups,
    getGroupById,
    getGroupByJid,
    getGroupMembers,
    updateGroup,
    deleteGroup,
    getGroupStats,
    getUserGroups,
    bulkDeleteGroups,
    searchMembers
};
