const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect } = require('../middleware/auth');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');

/**
 * Validate phone number format
 * Returns cleaned phone or null if invalid
 */
const validatePhoneNumber = (phone) => {
    if (!phone || typeof phone !== 'string') return null;
    const cleaned = phone.trim().replace(/[^\d+]/g, '');

    // International format with +
    if (cleaned.startsWith('+') && cleaned.length >= 11 && cleaned.length <= 16) {
        return cleaned;
    }
    // Local format (8-15 digits)
    if (/^\d{8,15}$/.test(cleaned)) {
        return cleaned;
    }
    return null;
};

// Apply auth middleware
router.use(protect);

// GET /api/contacts/tags - Get all unique tags for user
router.get('/tags', async (req, res, next) => {
    try {
        // Multi-tenant: only get tags for this user
        const tags = await prisma.tag.findMany({
            where: { userId: req.user.id },
            select: { name: true },
            orderBy: { name: 'asc' }
        });

        const tagNames = tags.map(t => t.name);

        return res.json({
            success: true,
            data: tagNames
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/contacts - List all contacts
router.get('/', async (req, res, next) => {
    try {
        const { page, limit, skip } = parsePagination(req.query);
        const { search, tag } = req.query;

        // Multi-tenant: always filter by userId
        const where = { userId: req.user.id };

        if (search) {
            where.AND = [{
                OR: [
                    { name: { contains: search } },
                    { phone: { contains: search } },
                    { email: { contains: search } }
                ]
            }];
        }

        if (tag) {
            where.tags = {
                some: {
                    tag: {
                        name: tag,
                        userId: req.user.id // Tag must also belong to user
                    }
                }
            };
        }

        const [contacts, total] = await Promise.all([
            prisma.contact.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    tags: {
                        include: {
                            tag: true
                        }
                    }
                }
            }),
            prisma.contact.count({ where })
        ]);

        // Transform response to flatten tags
        const formattedContacts = contacts.map(c => ({
            ...c,
            tags: c.tags.map(t => t.tag.name)
        }));

        paginatedResponse(res, formattedContacts, {
            page,
            limit,
            total
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/contacts/:id - Get contact details
router.get('/:id', async (req, res, next) => {
    try {
        // Multi-tenant: ensure contact belongs to user
        const contact = await prisma.contact.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: {
                tags: {
                    include: {
                        tag: true
                    }
                }
            }
        });

        if (!contact) {
            return errorResponse(res, 'Contact not found', 404);
        }

        const formattedContact = {
            ...contact,
            tags: contact.tags.map(t => t.tag.name)
        };

        successResponse(res, formattedContact);
    } catch (error) {
        next(error);
    }
});

// POST /api/contacts - Create contact
router.post('/', async (req, res, next) => {
    try {
        const { name, phone, email, tags } = req.body; // tags is array of strings
        const { planLimitsService } = require('../services/planLimitsService');

        if (!name || !phone) {
            return errorResponse(res, 'name and phone are required', 400);
        }

        // Check plan limits
        const limitCheck = await planLimitsService.canAddContact(req.user.id, 1);
        if (!limitCheck.allowed) {
            return errorResponse(res, limitCheck.reason, 403);
        }

        // Check if phone exists for this user
        const existing = await prisma.contact.findFirst({
            where: {
                phone,
                userId: req.user.id
            }
        });

        if (existing) {
            return errorResponse(res, 'Phone number already exists', 400);
        }

        // Handle tags: create if not exists
        // Note: Prisma many-to-many explicit relation via ContactTag
        // Let's use transaction
        const result = await prisma.$transaction(async (tx) => {
            const contact = await tx.contact.create({
                data: {
                    userId: req.user.id, // Multi-tenant: assign to current user
                    name,
                    phone,
                    email
                }
            });

            if (tags && Array.isArray(tags)) {
                for (const tagName of tags) {
                    // Multi-tenant: find tag for this user
                    let tag = await tx.tag.findFirst({
                        where: { name: tagName, userId: req.user.id }
                    });
                    if (!tag) {
                        tag = await tx.tag.create({
                            data: { name: tagName, userId: req.user.id }
                        });
                    }
                    await tx.contactTag.create({
                        data: {
                            contactId: contact.id,
                            tagId: tag.id
                        }
                    });
                }
            }
            return contact;
        });

        successResponse(res, result, 'Contact created', 201);
    } catch (error) {
        next(error);
    }
});

// PUT /api/contacts/:id - Update contact
router.put('/:id', async (req, res, next) => {
    try {
        const { name, phone, email, tags } = req.body;

        // Multi-tenant: ensure contact belongs to user
        const contact = await prisma.contact.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!contact) return errorResponse(res, 'Contact not found', 404);

        await prisma.$transaction(async (tx) => {
            // Update basic info
            await tx.contact.update({
                where: { id: req.params.id },
                data: { name, phone, email }
            });

            // Update tags if provided
            if (tags && Array.isArray(tags)) {
                // Delete existing
                await tx.contactTag.deleteMany({
                    where: { contactId: req.params.id }
                });

                // Add new
                for (const tagName of tags) {
                    // Multi-tenant: find tag for this user
                    let tag = await tx.tag.findFirst({
                        where: { name: tagName, userId: req.user.id }
                    });
                    if (!tag) {
                        tag = await tx.tag.create({
                            data: { name: tagName, userId: req.user.id }
                        });
                    }
                    await tx.contactTag.create({
                        data: {
                            contactId: req.params.id,
                            tagId: tag.id
                        }
                    });
                }
            }
        });

        successResponse(res, { id: req.params.id }, 'Contact updated');
    } catch (error) {
        next(error);
    }
});

// DELETE /api/contacts/:id - Delete contact
router.delete('/:id', async (req, res, next) => {
    try {
        // Multi-tenant: ensure contact belongs to user
        const contact = await prisma.contact.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });
        if (!contact) return errorResponse(res, 'Contact not found', 404);

        await prisma.contact.delete({ where: { id: req.params.id } });
        successResponse(res, { id: req.params.id }, 'Contact deleted');
    } catch (error) {
        next(error);
    }
});

// POST /api/contacts/import - Bulk import (Simple implementation)
router.post('/import', async (req, res, next) => {
    try {
        const { contacts } = req.body;
        const { planLimitsService } = require('../services/planLimitsService');

        if (!contacts || !Array.isArray(contacts)) {
            return errorResponse(res, 'contacts array is required', 400);
        }

        // Validate and filter contacts (must have valid phone and name)
        let invalidPhones = 0;
        const validContacts = [];

        for (const c of contacts) {
            if (!c.name) continue;

            const validatedPhone = validatePhoneNumber(c.phone);
            if (validatedPhone) {
                validContacts.push({
                    ...c,
                    phone: validatedPhone
                });
            } else {
                invalidPhones++;
            }
        }

        if (validContacts.length === 0) {
            return errorResponse(res, `No valid contacts to import. ${invalidPhones} contacts have invalid phone numbers.`, 400);
        }

        // Check which contacts already exist FOR THIS USER
        const existingContacts = await prisma.contact.findMany({
            where: {
                phone: { in: validContacts.map(c => c.phone) },
                userId: req.user.id
            },
            select: { phone: true }
        });
        const existingPhoneSet = new Set(existingContacts.map(c => c.phone));
        const newContacts = validContacts.filter(c => !existingPhoneSet.has(c.phone));

        // Check plan limits before importing
        if (newContacts.length > 0) {
            const limitCheck = await planLimitsService.canAddContact(req.user.id, newContacts.length);
            if (!limitCheck.allowed) {
                return errorResponse(res, `${limitCheck.reason} (trying to import ${newContacts.length} new contacts)`, 403);
            }
        }

        let imported = 0;
        let skipped = existingPhoneSet.size;
        let errors = 0;

        // OPTIMIZED: Use createMany for bulk insert instead of N+1 individual creates
        if (newContacts.length > 0) {
            try {
                const result = await prisma.contact.createMany({
                    data: newContacts.map(c => ({
                        name: c.name,
                        phone: c.phone,
                        email: c.email || null,
                        userId: req.user.id
                    })),
                    skipDuplicates: true // Skip any duplicates that might slip through
                });
                imported = result.count;

                // If some were skipped due to duplicates, add to skipped count
                if (result.count < newContacts.length) {
                    skipped += (newContacts.length - result.count);
                }
            } catch (err) {
                console.error('[Contacts] Bulk import error:', err.message);
                errors = newContacts.length;
            }
        }

        successResponse(res, { imported, skipped, errors }, `Import completed. ${imported} imported, ${skipped} skipped (existing), ${errors} failed.`);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
