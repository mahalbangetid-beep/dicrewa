/**
 * Scheduler Service - Advanced Scheduling (Phase 8)
 * Handles recurring broadcasts, timezone support, and queue management
 */

const cron = require('node-cron');
const { formatInTimeZone, toZonedTime, fromZonedTime } = require('date-fns-tz');
const prisma = require('../utils/prisma');

// Store active cron jobs
const activeJobs = new Map();

// Common timezones
const TIMEZONES = [
    { value: 'Asia/Jakarta', label: 'WIB (Jakarta, GMT+7)' },
    { value: 'Asia/Makassar', label: 'WITA (Makassar, GMT+8)' },
    { value: 'Asia/Jayapura', label: 'WIT (Jayapura, GMT+9)' },
    { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
    { value: 'Asia/Kuala_Lumpur', label: 'Malaysia (GMT+8)' },
    { value: 'Asia/Bangkok', label: 'Thailand (GMT+7)' },
    { value: 'Asia/Tokyo', label: 'Japan (GMT+9)' },
    { value: 'Asia/Seoul', label: 'South Korea (GMT+9)' },
    { value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
    { value: 'Europe/London', label: 'London (GMT+0/+1)' },
    { value: 'Europe/Paris', label: 'Paris (GMT+1/+2)' },
    { value: 'America/New_York', label: 'New York (GMT-5/-4)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8/-7)' },
    { value: 'Australia/Sydney', label: 'Sydney (GMT+10/+11)' },
    { value: 'UTC', label: 'UTC (GMT+0)' }
];

/**
 * Initialize scheduler - loads pending broadcasts and sets up cron jobs
 */
const initialize = async () => {
    console.log('[Scheduler] Initializing...');

    // Check for missed scheduled broadcasts
    await processMissedBroadcasts();

    // Set up recurring broadcast checker (runs every minute)
    cron.schedule('* * * * *', async () => {
        await checkRecurringBroadcasts();
    });

    // Set up scheduled broadcast checker (runs every minute)
    cron.schedule('* * * * *', async () => {
        await processScheduledBroadcasts();
    });

    console.log('[Scheduler] Initialized successfully');
};

/**
 * Process any broadcasts that were scheduled but missed (e.g., server was down)
 */
const processMissedBroadcasts = async () => {
    try {
        const now = new Date();
        const missedBroadcasts = await prisma.broadcast.findMany({
            where: {
                status: 'scheduled',
                scheduledAt: { lte: now },
                isRecurring: false
            }
        });

        for (const broadcast of missedBroadcasts) {
            console.log(`[Scheduler] Processing missed broadcast: ${broadcast.name}`);
            await startBroadcast(broadcast.id);
        }
    } catch (error) {
        console.error('[Scheduler] Error processing missed broadcasts:', error);
    }
};

/**
 * Check and process scheduled (non-recurring) broadcasts
 */
const processScheduledBroadcasts = async () => {
    try {
        const now = new Date();
        const thirtySecondsFromNow = new Date(now.getTime() + 30000);

        const dueBroadcasts = await prisma.broadcast.findMany({
            where: {
                status: 'scheduled',
                isRecurring: false,
                scheduledAt: {
                    gte: now,
                    lte: thirtySecondsFromNow
                }
            },
            orderBy: { priority: 'desc' }
        });

        for (const broadcast of dueBroadcasts) {
            console.log(`[Scheduler] Starting scheduled broadcast: ${broadcast.name}`);
            await startBroadcast(broadcast.id);
        }
    } catch (error) {
        console.error('[Scheduler] Error processing scheduled broadcasts:', error);
    }
};

/**
 * Check and process recurring broadcasts
 */
const checkRecurringBroadcasts = async () => {
    try {
        const now = new Date();

        const recurringBroadcasts = await prisma.broadcast.findMany({
            where: {
                isRecurring: true,
                status: { in: ['scheduled', 'completed'] },
                OR: [
                    { nextRunAt: { lte: now } },
                    { nextRunAt: null }
                ]
            },
            orderBy: { priority: 'desc' }
        });

        for (const broadcast of recurringBroadcasts) {
            const shouldRun = shouldRecurringBroadcastRun(broadcast, now);

            if (shouldRun) {
                // Check max runs
                if (broadcast.maxRuns && broadcast.runCount >= broadcast.maxRuns) {
                    console.log(`[Scheduler] Recurring broadcast ${broadcast.name} reached max runs`);
                    await prisma.broadcast.update({
                        where: { id: broadcast.id },
                        data: { status: 'completed', isRecurring: false }
                    });
                    continue;
                }

                console.log(`[Scheduler] Running recurring broadcast: ${broadcast.name}`);
                await runRecurringBroadcast(broadcast);
            }
        }
    } catch (error) {
        console.error('[Scheduler] Error checking recurring broadcasts:', error);
    }
};

/**
 * Check if a recurring broadcast should run now
 */
const shouldRecurringBroadcastRun = (broadcast, now) => {
    if (!broadcast.recurringTime) return false;

    const timezone = broadcast.timezone || 'Asia/Jakarta';
    const [hours, minutes] = broadcast.recurringTime.split(':').map(Number);

    // Get current time in broadcast's timezone
    const zonedNow = toZonedTime(now, timezone);
    const currentHour = zonedNow.getHours();
    const currentMinute = zonedNow.getMinutes();
    const currentDay = zonedNow.getDay(); // 0 = Sunday

    // Check if time matches (within 1 minute window)
    if (currentHour !== hours || currentMinute !== minutes) {
        return false;
    }

    // Check if already ran this period
    if (broadcast.lastRunAt) {
        const lastRun = toZonedTime(broadcast.lastRunAt, timezone);
        const minutesSinceLastRun = (now.getTime() - broadcast.lastRunAt.getTime()) / 60000;
        if (minutesSinceLastRun < 2) return false; // Prevent double-run
    }

    // Check recurring type
    switch (broadcast.recurringType) {
        case 'daily':
            return true;

        case 'weekly':
            if (!broadcast.recurringDays) return false;
            const days = JSON.parse(broadcast.recurringDays);
            return days.includes(currentDay);

        case 'monthly':
            const currentDate = zonedNow.getDate();
            if (!broadcast.recurringDays) return currentDate === 1;
            const dates = JSON.parse(broadcast.recurringDays);
            return dates.includes(currentDate);

        default:
            return false;
    }
};

/**
 * Run a recurring broadcast (creates a copy and runs it)
 */
const runRecurringBroadcast = async (broadcast) => {
    try {
        // Update broadcast tracking
        await prisma.broadcast.update({
            where: { id: broadcast.id },
            data: {
                lastRunAt: new Date(),
                runCount: { increment: 1 },
                nextRunAt: calculateNextRun(broadcast)
            }
        });

        // Start the broadcast
        await startBroadcast(broadcast.id);
    } catch (error) {
        console.error(`[Scheduler] Error running recurring broadcast ${broadcast.id}:`, error);
    }
};

/**
 * Calculate next run time for recurring broadcast
 */
const calculateNextRun = (broadcast) => {
    const timezone = broadcast.timezone || 'Asia/Jakarta';
    const [hours, minutes] = (broadcast.recurringTime || '09:00').split(':').map(Number);
    const now = new Date();

    switch (broadcast.recurringType) {
        case 'daily': {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(hours, minutes, 0, 0);
            return fromZonedTime(tomorrow, timezone);
        }

        case 'weekly': {
            if (!broadcast.recurringDays) return null;
            const days = JSON.parse(broadcast.recurringDays);
            let currentDay = now.getDay();

            // Find next matching day
            for (let i = 1; i <= 7; i++) {
                const nextDay = (currentDay + i) % 7;
                if (days.includes(nextDay)) {
                    const next = new Date(now);
                    next.setDate(next.getDate() + i);
                    next.setHours(hours, minutes, 0, 0);
                    return fromZonedTime(next, timezone);
                }
            }
            return null;
        }

        case 'monthly': {
            const nextMonth = new Date(now);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            if (broadcast.recurringDays) {
                const dates = JSON.parse(broadcast.recurringDays);
                nextMonth.setDate(dates[0] || 1);
            } else {
                nextMonth.setDate(1);
            }
            nextMonth.setHours(hours, minutes, 0, 0);
            return fromZonedTime(nextMonth, timezone);
        }

        default:
            return null;
    }
};

/**
 * Start a broadcast (trigger the actual sending)
 */
const startBroadcast = async (broadcastId) => {
    try {
        // Update status to running
        await prisma.broadcast.update({
            where: { id: broadcastId },
            data: { status: 'running', startedAt: new Date() }
        });

        // Emit event for broadcast service to pick up
        const broadcast = await prisma.broadcast.findUnique({
            where: { id: broadcastId },
            include: { recipients: true }
        });

        if (!broadcast) return;

        // Import broadcast service and run
        const broadcastService = require('./broadcast');
        await broadcastService.executeBroadcast(broadcastId);
    } catch (error) {
        console.error(`[Scheduler] Error starting broadcast ${broadcastId}:`, error);
        await prisma.broadcast.update({
            where: { id: broadcastId },
            data: { status: 'failed' }
        });
    }
};

/**
 * Schedule a one-time broadcast
 */
const scheduleBroadcast = async (broadcastId, scheduledAt, timezone = 'Asia/Jakarta') => {
    try {
        const scheduledDate = new Date(scheduledAt);

        await prisma.broadcast.update({
            where: { id: broadcastId },
            data: {
                status: 'scheduled',
                scheduledAt: scheduledDate,
                timezone
            }
        });

        console.log(`[Scheduler] Broadcast ${broadcastId} scheduled for ${scheduledDate.toISOString()}`);
        return true;
    } catch (error) {
        console.error('[Scheduler] Error scheduling broadcast:', error);
        return false;
    }
};

/**
 * Set up recurring broadcast
 */
const setRecurring = async (broadcastId, options) => {
    const {
        recurringType,   // daily, weekly, monthly
        recurringDays,   // array of days (0-6 for weekly, 1-31 for monthly)
        recurringTime,   // HH:mm
        timezone = 'Asia/Jakarta',
        maxRuns = null
    } = options;

    try {
        const nextRun = calculateNextRun({
            recurringType,
            recurringDays: JSON.stringify(recurringDays || []),
            recurringTime,
            timezone
        });

        await prisma.broadcast.update({
            where: { id: broadcastId },
            data: {
                isRecurring: true,
                recurringType,
                recurringDays: recurringDays ? JSON.stringify(recurringDays) : null,
                recurringTime,
                timezone,
                maxRuns,
                nextRunAt: nextRun,
                status: 'scheduled'
            }
        });

        console.log(`[Scheduler] Recurring broadcast ${broadcastId} set up: ${recurringType} at ${recurringTime}`);
        return true;
    } catch (error) {
        console.error('[Scheduler] Error setting recurring broadcast:', error);
        return false;
    }
};

/**
 * Cancel/stop a recurring broadcast
 */
const cancelRecurring = async (broadcastId) => {
    try {
        await prisma.broadcast.update({
            where: { id: broadcastId },
            data: {
                isRecurring: false,
                status: 'cancelled',
                nextRunAt: null
            }
        });
        return true;
    } catch (error) {
        console.error('[Scheduler] Error cancelling recurring broadcast:', error);
        return false;
    }
};

/**
 * Pause a recurring broadcast
 */
const pauseRecurring = async (broadcastId) => {
    try {
        await prisma.broadcast.update({
            where: { id: broadcastId },
            data: { status: 'paused' }
        });
        return true;
    } catch (error) {
        console.error('[Scheduler] Error pausing broadcast:', error);
        return false;
    }
};

/**
 * Resume a paused recurring broadcast
 */
const resumeRecurring = async (broadcastId) => {
    try {
        const broadcast = await prisma.broadcast.findUnique({
            where: { id: broadcastId }
        });

        if (!broadcast || !broadcast.isRecurring) return false;

        const nextRun = calculateNextRun(broadcast);

        await prisma.broadcast.update({
            where: { id: broadcastId },
            data: {
                status: 'scheduled',
                nextRunAt: nextRun
            }
        });
        return true;
    } catch (error) {
        console.error('[Scheduler] Error resuming broadcast:', error);
        return false;
    }
};

/**
 * Get upcoming scheduled broadcasts
 * @param {number} days - Number of days to look ahead
 * @param {string} userId - User ID to filter by (optional for backwards compatibility)
 */
const getUpcoming = async (days = 7, userId = null) => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const where = {
        status: { in: ['scheduled', 'paused'] },
        OR: [
            { scheduledAt: { lte: endDate } },
            { nextRunAt: { lte: endDate } }
        ]
    };

    // SECURITY: Filter by user if userId provided
    if (userId) {
        where.device = { userId: userId };
    }

    return prisma.broadcast.findMany({
        where,
        orderBy: [
            { priority: 'desc' },
            { scheduledAt: 'asc' }
        ],
        include: {
            device: { select: { id: true, name: true } }
        }
    });
};

/**
 * Get calendar events for broadcasts
 * @param {string} startDate - Start date for calendar range
 * @param {string} endDate - End date for calendar range
 * @param {string} userId - User ID to filter by (optional for backwards compatibility)
 */
const getCalendarEvents = async (startDate, endDate, userId = null) => {
    const where = {
        OR: [
            {
                scheduledAt: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                }
            },
            {
                isRecurring: true,
                status: { in: ['scheduled', 'completed'] }
            }
        ]
    };

    // SECURITY: Filter by user if userId provided
    if (userId) {
        where.device = { userId: userId };
    }

    const broadcasts = await prisma.broadcast.findMany({
        where,
        include: {
            device: { select: { id: true, name: true } }
        }
    });

    const events = [];

    for (const broadcast of broadcasts) {
        if (broadcast.isRecurring) {
            // Generate recurring events
            const recurringEvents = generateRecurringEvents(broadcast, startDate, endDate);
            events.push(...recurringEvents);
        } else if (broadcast.scheduledAt) {
            events.push({
                id: broadcast.id,
                title: broadcast.name,
                start: broadcast.scheduledAt,
                end: broadcast.scheduledAt,
                status: broadcast.status,
                isRecurring: false,
                device: broadcast.device?.name,
                color: getStatusColor(broadcast.status)
            });
        }
    }

    return events.sort((a, b) => new Date(a.start) - new Date(b.start));
};

/**
 * Generate recurring events for calendar
 */
const generateRecurringEvents = (broadcast, startDate, endDate) => {
    const events = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const [hours, minutes] = (broadcast.recurringTime || '09:00').split(':').map(Number);

    let current = new Date(start);
    while (current <= end) {
        let shouldAdd = false;

        switch (broadcast.recurringType) {
            case 'daily':
                shouldAdd = true;
                break;
            case 'weekly':
                if (broadcast.recurringDays) {
                    const days = JSON.parse(broadcast.recurringDays);
                    shouldAdd = days.includes(current.getDay());
                }
                break;
            case 'monthly':
                if (broadcast.recurringDays) {
                    const dates = JSON.parse(broadcast.recurringDays);
                    shouldAdd = dates.includes(current.getDate());
                }
                break;
        }

        if (shouldAdd) {
            const eventDate = new Date(current);
            eventDate.setHours(hours, minutes, 0, 0);

            events.push({
                id: `${broadcast.id}-${eventDate.toISOString()}`,
                broadcastId: broadcast.id,
                title: `🔄 ${broadcast.name}`,
                start: eventDate,
                end: eventDate,
                status: broadcast.status,
                isRecurring: true,
                recurringType: broadcast.recurringType,
                device: broadcast.device?.name,
                color: '#6366f1'
            });
        }

        current.setDate(current.getDate() + 1);
    }

    return events;
};

/**
 * Get status color for calendar
 */
const getStatusColor = (status) => {
    switch (status) {
        case 'scheduled': return '#f59e0b';
        case 'running': return '#10b981';
        case 'completed': return '#6b7280';
        case 'paused': return '#6366f1';
        case 'cancelled': return '#ef4444';
        default: return '#374151';
    }
};

module.exports = {
    initialize,
    scheduleBroadcast,
    setRecurring,
    cancelRecurring,
    pauseRecurring,
    resumeRecurring,
    getUpcoming,
    getCalendarEvents,
    calculateNextRun,
    startBroadcast,
    TIMEZONES
};
