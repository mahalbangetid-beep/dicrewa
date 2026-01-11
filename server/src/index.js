require('dotenv').config();

// ==================== ENVIRONMENT VALIDATION ====================
// Validate critical environment variables before starting the server
const validateEnvironment = () => {
    const errors = [];
    const warnings = [];

    // Required environment variables
    if (!process.env.JWT_SECRET) {
        errors.push('JWT_SECRET is required but not set');
    } else if (process.env.JWT_SECRET.length < 32) {
        errors.push('JWT_SECRET must be at least 32 characters long for security');
    }

    if (!process.env.DATABASE_URL) {
        errors.push('DATABASE_URL is required but not set');
    }

    // Warning for optional but recommended variables
    if (!process.env.BACKEND_URL) {
        warnings.push('BACKEND_URL is not set - payment gateway webhooks will use localhost and WILL FAIL in production');
    }

    // If there are errors, exit the process
    if (errors.length > 0) {
        console.error('\n❌ FATAL: Environment validation failed:');
        errors.forEach(err => console.error(`   - ${err}`));
        console.error('\nPlease check your .env file and ensure all required variables are set.\n');
        process.exit(1);
    }

    // Show warnings but continue
    if (warnings.length > 0) {
        console.warn('\n⚠️  Environment warnings:');
        warnings.forEach(warn => console.warn(`   - ${warn}`));
        console.warn('');
    }

    console.log('✅ Environment validation passed');
};

// Run validation
validateEnvironment();

// ==================== AUTO DATABASE MIGRATION ====================
// Ensure database tables exist before app starts
const initDatabase = () => {
    try {
        const { execSync } = require('child_process');
        console.log('🔄 Checking database schema...');
        execSync('npx prisma db push --accept-data-loss', {
            stdio: 'inherit',
            cwd: process.cwd()
        });
        console.log('✅ Database schema is up to date');
    } catch (error) {
        console.error('⚠️ Database migration warning:', error.message);
        console.log('Continuing anyway - tables may already exist');
    }
};

// Run in production only
if (process.env.NODE_ENV === 'production') {
    initDatabase();
}
// ================================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
const prisma = require('./utils/prisma');

// Import routes
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const messageRoutes = require('./routes/messages');
const contactRoutes = require('./routes/contacts');
const webhookRoutes = require('./routes/webhooks');
const broadcastRoutes = require('./routes/broadcast');
const autoReplyRoutes = require('./routes/autoReply');
const settingsRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');
const inboxRoutes = require('./routes/inbox');
const templateRoutes = require('./routes/templates');
const chatbotRoutes = require('./routes/chatbots');
const securityRoutes = require('./routes/security');
const analyticsRoutes = require('./routes/analytics');
const integrationRoutes = require('./routes/integrations');
const aiRoutes = require('./routes/ai');
const schedulerRoutes = require('./routes/scheduler');
const billingRoutes = require('./routes/billing');
const teamRoutes = require('./routes/team');
const groupRoutes = require('./routes/groups');
const knowledgeRoutes = require('./routes/knowledge');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { generalLimiter, authLimiter } = require('./middleware/rateLimiter');

// Import Services
const WhatsAppService = require('./services/whatsapp');
const AutoReplyService = require('./services/autoReply');
const webhookService = require('./services/webhook');
const broadcastService = require('./services/broadcast');
const InboxService = require('./services/inboxService');
const integrationService = require('./services/integrationService');
const schedulerService = require('./services/scheduler');
const billingService = require('./services/billing');
const chatbotService = require('./services/chatbotService');

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

// JWT for Socket.IO authentication
const jwt = require('jsonwebtoken');

// Socket.IO Authentication Middleware
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error('Authentication required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user info to socket for later use
        socket.userId = decoded.userId || decoded.id;
        socket.userEmail = decoded.email;

        console.log(`[Socket] Authenticated user ${socket.userId} connected`);
        next();
    } catch (err) {
        console.error('[Socket] Authentication failed:', err.message);
        next(new Error('Invalid or expired token'));
    }
});

// Initialize Services
const whatsappService = new WhatsAppService(io);
const autoReplyService = new AutoReplyService(whatsappService);
const inboxService = new InboxService(whatsappService);
broadcastService.init(whatsappService);

// Schedule cleanup for ProcessedAutoReply records (every hour)
setInterval(() => {
    autoReplyService.cleanupOldRecords().catch(err => {
        console.error('[Server] Cleanup error:', err.message);
    });
}, 60 * 60 * 1000); // 1 hour

// Run cleanup on startup
autoReplyService.cleanupOldRecords().catch(() => { });

/**
 * Handle incoming message from WhatsApp Service
 */
const handleIncomingMessage = async (data) => {
    try {
        // Skip messages from self to avoid loops or unnecessary processing
        if (data.fromMe) return;

        // Get device to find owner's userId (for multi-tenant isolation)
        const device = await prisma.device.findUnique({
            where: { id: data.deviceId },
            select: { userId: true }
        });

        if (!device) {
            console.log(`[Server] Device not found: ${data.deviceId}`);
            return;
        }

        const deviceOwnerId = device.userId;

        // Check if sender is blocked (Blacklist feature - per user)
        const senderPhone = data.from.split('@')[0];
        const blockedContact = await prisma.contact.findFirst({
            where: {
                phone: senderPhone,
                isBlocked: true,
                userId: deviceOwnerId // Multi-tenant: check blocked contacts for this user
            }
        });

        if (blockedContact) {
            console.log(`[Server] Message from blocked contact ignored: ${senderPhone}`);
            return;
        }

        // Check for duplicate message (Deduplication)
        const existingMessage = await prisma.message.findFirst({
            where: {
                waMessageId: data.messageId,
                deviceId: data.deviceId
            }
        });

        if (existingMessage) {
            console.log(`[Server] Duplicate message ignored: ${data.messageId}`);
            return;
        }

        console.log(`[Server] Saving incoming message from ${data.from} on device ${data.deviceId}`);

        // Save to database
        const savedMessage = await prisma.message.create({
            data: {
                deviceId: data.deviceId,
                type: 'incoming',
                waMessageId: data.messageId, // Save WA ID
                from: data.from,
                fromName: data.pushName,
                message: data.message || '', // Text content
                mediaType: data.type,
                status: 'delivered', // Incoming is always delivered/received
            }
        });

        // Trigger Auto Reply
        await autoReplyService.processMessage(data);

        // Trigger Chatbot Flow (with real-time message sending)
        if (data.type === 'text' && data.message) {
            try {
                // Create sendMessage callback for chatbot to use
                const sendChatbotMessage = async (deviceId, to, text, options = {}) => {
                    if (options.type === 'image' && options.mediaUrl) {
                        await whatsappService.sendImage(deviceId, to, options.mediaUrl, text);
                    } else {
                        await whatsappService.sendMessage(deviceId, to, text);
                    }
                };

                const chatbotResult = await chatbotService.executeChatbotFlow(
                    data.deviceId,
                    data.from,
                    data.message,
                    sendChatbotMessage
                );

                if (chatbotResult) {
                    console.log(`[Server] Chatbot "${chatbotResult.chatbotName}" sent ${chatbotResult.messagesSent} messages`);
                }
            } catch (chatbotErr) {
                console.error('[Server] Chatbot execution error:', chatbotErr.message);
            }
        }

        // Trigger Webhook (multi-tenant: only trigger for device owner)
        await webhookService.trigger('message.received', {
            ...data,
            dbId: savedMessage.id
        }, deviceOwnerId);

        // Trigger Integration notifications (Telegram, Discord, etc.) - Multi-tenant isolated
        await integrationService.triggerEvent('message.received', {
            ...data,
            dbId: savedMessage.id
        }, deviceOwnerId);

        // Emit Socket Event (Room-based for multi-tenant isolation)
        io.to(`device:${data.deviceId}`).emit('message.created', savedMessage);

        // Update inbox conversation with pushName
        await inboxService.updateConversationWithMessage(
            data.deviceId,
            data.from,
            data.message || '[Media]',
            true, // isIncoming
            data.pushName // Pass pushName to update conversation
        );

    } catch (err) {
        console.error('[Server] Error saving incoming message:', err);
    }
};

// Wrapper to inject callbacks globally
const originalCreateSession = whatsappService.createSession.bind(whatsappService);
whatsappService.createSession = async (deviceId, callbacks = {}) => {
    const mergedCallbacks = {
        ...callbacks,
        onMessage: async (data) => {
            await handleIncomingMessage(data);
            if (callbacks.onMessage) await callbacks.onMessage(data);
        },
        onMessageUpdate: async (data) => {
            // Handle message status updates (read/delivered icons)
            try {
                // Update DB only if message exists (outgoing)
                // data.messageId matches waMessageId
                if (data.messageId) {
                    await prisma.message.updateMany({
                        where: {
                            waMessageId: data.messageId,
                            deviceId: deviceId
                        },
                        data: { status: data.status }
                    }).catch(() => { });
                }

                // Get device owner for multi-tenant webhook trigger
                const device = await prisma.device.findUnique({
                    where: { id: deviceId },
                    select: { userId: true }
                });

                // Webhook (multi-tenant: only trigger for device owner)
                await webhookService.trigger(`message.${data.status}`, data, device?.userId);

                // Emit Socket Event (Room-based for multi-tenant isolation)
                io.to(`device:${deviceId}`).emit('message.updated', {
                    waMessageId: data.messageId,
                    deviceId: deviceId,
                    status: data.status
                });
            } catch (e) { }

            if (callbacks.onMessageUpdate) await callbacks.onMessageUpdate(data);
        }
    };
    return await originalCreateSession(deviceId, mergedCallbacks);
};

// Make io and services accessible to routes
app.set('io', io);
app.set('whatsapp', whatsappService);
app.set('webhook', webhookService);
app.set('broadcast', broadcastService);
app.set('inbox', inboxService);

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general rate limiting to all routes
app.use(generalLimiter.default || generalLimiter);

// Health check
app.get('/health', (req, res) => {
    const sessions = whatsappService.getAllSessions();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'KeWhats API',
        version: '1.0.0',
        whatsapp: {
            activeSessions: sessions.length,
            sessions: sessions.map(s => ({
                deviceId: s.deviceId,
                status: s.status
            }))
        }
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/auto-reply', autoReplyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/chatbots', chatbotRoutes.default || chatbotRoutes);
app.use('/api/security', securityRoutes.default || securityRoutes);
app.use('/api/analytics', analyticsRoutes.default || analyticsRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/branding', require('./routes/branding'));
app.use('/api/public', require('./routes/public'));
app.use('/api/monitoring', require('./routes/monitoring'));
app.use('/api/system-settings', require('./routes/systemSettings'));

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id, '- User:', socket.userId);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });

    // Join room for device updates (with ownership verification)
    socket.on('join:device', async (deviceId) => {
        try {
            // Verify device ownership
            const device = await prisma.device.findFirst({
                where: {
                    id: deviceId,
                    userId: socket.userId
                }
            });

            if (!device) {
                console.warn(`[Socket] Unauthorized join attempt: User ${socket.userId} tried to join device ${deviceId}`);
                socket.emit('error', { message: 'Unauthorized: You do not own this device' });
                return;
            }

            socket.join(`device:${deviceId}`);
            console.log(`[Socket] User ${socket.userId} joined device:${deviceId}`);

            // Send current status
            const status = whatsappService.getSessionStatus(deviceId);
            socket.emit('device.status', { deviceId, ...status });

            // Check if there is an active QR for this device and emit it
            const latestQR = whatsappService.getLatestQR(deviceId);
            if (latestQR && status.status !== 'connected') {
                socket.emit('qr', { deviceId, qr: latestQR });
            }
        } catch (err) {
            console.error('[Socket] Error in join:device:', err.message);
            socket.emit('error', { message: 'Failed to join device room' });
        }
    });

    // Leave device room
    socket.on('leave:device', (deviceId) => {
        socket.leave(`device:${deviceId}`);
        console.log(`[Socket] User ${socket.userId} left device:${deviceId}`);
    });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, async () => {
    console.log(`
  ╔═══════════════════════════════════════════════════╗
  ║                                                   ║
  ║   🚀 KeWhats API Server                           ║
  ║                                                   ║
  ║   Server running on: http://localhost:${PORT}        ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}                     ║
  ║                                                   ║
  ╚═══════════════════════════════════════════════════╝
  `);

    // Load existing WhatsApp sessions
    console.log('[Server] Loading existing WhatsApp sessions...');
    await whatsappService.loadExistingSessions();
    console.log('[Server] Session loading complete');

    // Initialize scheduler service
    console.log('[Server] Initializing scheduler...');
    await schedulerService.initialize();
    console.log('[Server] Scheduler initialized');

    // Initialize billing plans
    console.log('[Server] Initializing billing plans...');
    await billingService.initializePlans();
    console.log('[Server] Billing plans initialized');

    // Initialize integration scheduler
    console.log('[Server] Initializing integration scheduler...');
    const integrationScheduler = require('./services/integrationScheduler');
    await integrationScheduler.initialize();
    console.log('[Server] Integration scheduler initialized');
});

module.exports = { app, io, whatsappService };
