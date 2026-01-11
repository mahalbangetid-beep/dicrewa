const prisma = require('../utils/prisma');

class TemplateService {
    /**
     * Get all templates for a user
     */
    async getTemplates(userId, options = {}) {
        const { page = 1, limit = 50, categoryId = null, search = '' } = options;
        const skip = (page - 1) * limit;

        const where = { userId };

        if (categoryId) {
            where.categoryId = categoryId;
        }

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { content: { contains: search } }
            ];
        }

        const [templates, total] = await Promise.all([
            prisma.template.findMany({
                where,
                include: {
                    category: {
                        select: { id: true, name: true, color: true }
                    }
                },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.template.count({ where })
        ]);

        return {
            templates,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get a single template
     */
    async getTemplate(userId, id) {
        const template = await prisma.template.findFirst({
            where: { id, userId },
            include: {
                category: {
                    select: { id: true, name: true, color: true }
                }
            }
        });

        if (!template) {
            throw new Error('Template not found');
        }

        return template;
    }

    /**
     * Create a new template
     */
    async createTemplate(userId, data) {
        const { name, content, categoryId, mediaUrl, mediaType } = data;

        return prisma.template.create({
            data: {
                name,
                content,
                categoryId: categoryId || null,
                mediaUrl: mediaUrl || null,
                mediaType: mediaType || null,
                userId
            },
            include: {
                category: {
                    select: { id: true, name: true, color: true }
                }
            }
        });
    }

    /**
     * Update a template
     */
    async updateTemplate(userId, id, data) {
        const template = await prisma.template.findFirst({
            where: { id, userId }
        });

        if (!template) {
            throw new Error('Template not found');
        }

        return prisma.template.update({
            where: { id },
            data: {
                name: data.name,
                content: data.content,
                categoryId: data.categoryId || null,
                mediaUrl: data.mediaUrl || null,
                mediaType: data.mediaType || null
            },
            include: {
                category: {
                    select: { id: true, name: true, color: true }
                }
            }
        });
    }

    /**
     * Delete a template
     */
    async deleteTemplate(userId, id) {
        const template = await prisma.template.findFirst({
            where: { id, userId }
        });

        if (!template) {
            throw new Error('Template not found');
        }

        return prisma.template.delete({ where: { id } });
    }

    /**
     * Increment usage count
     */
    async useTemplate(userId, id) {
        const template = await prisma.template.findFirst({
            where: { id, userId }
        });

        if (!template) {
            throw new Error('Template not found');
        }

        return prisma.template.update({
            where: { id },
            data: { usageCount: { increment: 1 } }
        });
    }

    /**
     * Parse template variables and replace with values
     */
    parseTemplate(content, variables = {}) {
        return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return variables[key] !== undefined ? variables[key] : match;
        });
    }

    /**
     * Extract variable names from template content
     */
    extractVariables(content) {
        const matches = content.match(/\{\{(\w+)\}\}/g) || [];
        return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
    }

    // ==================== CATEGORIES ====================

    /**
     * Get all categories for a user
     */
    async getCategories(userId) {
        return prisma.templateCategory.findMany({
            where: { userId },
            include: {
                _count: { select: { templates: true } }
            },
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Create a category
     */
    async createCategory(userId, name, color = '#6366f1') {
        return prisma.templateCategory.create({
            data: { name, color, userId }
        });
    }

    /**
     * Update a category
     */
    async updateCategory(userId, id, data) {
        const category = await prisma.templateCategory.findFirst({
            where: { id, userId }
        });

        if (!category) {
            throw new Error('Category not found');
        }

        return prisma.templateCategory.update({
            where: { id },
            data: {
                name: data.name,
                color: data.color
            }
        });
    }

    /**
     * Delete a category
     */
    async deleteCategory(userId, id) {
        const category = await prisma.templateCategory.findFirst({
            where: { id, userId }
        });

        if (!category) {
            throw new Error('Category not found');
        }

        // Templates will have categoryId set to null due to onDelete: SetNull
        return prisma.templateCategory.delete({ where: { id } });
    }
}

module.exports = TemplateService;
