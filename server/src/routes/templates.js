const express = require('express');
const router = express.Router();
const { protect: auth } = require('../middleware/auth');
const TemplateService = require('../services/templateService');

const templateService = new TemplateService();

// ==================== TEMPLATES ====================

/**
 * GET /api/templates
 * Get all templates for authenticated user
 */
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 50, categoryId, search } = req.query;

        const result = await templateService.getTemplates(req.user.id, {
            page: parseInt(page),
            limit: parseInt(limit),
            categoryId: categoryId || null,
            search: search || ''
        });

        res.json(result);
    } catch (error) {
        console.error('[Templates] Error fetching templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

/**
 * GET /api/templates/:id
 * Get a single template
 */
router.get('/:id', auth, async (req, res) => {
    try {
        const template = await templateService.getTemplate(req.user.id, req.params.id);
        res.json(template);
    } catch (error) {
        console.error('[Templates] Error fetching template:', error);
        if (error.message === 'Template not found') {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.status(500).json({ error: 'Failed to fetch template' });
    }
});

/**
 * POST /api/templates
 * Create a new template
 */
router.post('/', auth, async (req, res) => {
    try {
        const { name, content, categoryId, mediaUrl, mediaType } = req.body;
        const { planLimitsService } = require('../services/planLimitsService');

        if (!name || !content) {
            return res.status(400).json({ error: 'Name and content are required' });
        }

        // Check plan limits
        const limitCheck = await planLimitsService.canAddTemplate(req.user.id);
        if (!limitCheck.allowed) {
            return res.status(403).json({ error: limitCheck.reason });
        }

        const template = await templateService.createTemplate(req.user.id, {
            name,
            content,
            categoryId,
            mediaUrl,
            mediaType
        });

        res.status(201).json(template);
    } catch (error) {
        console.error('[Templates] Error creating template:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

/**
 * PUT /api/templates/:id
 * Update a template
 */
router.put('/:id', auth, async (req, res) => {
    try {
        const { name, content, categoryId, mediaUrl, mediaType } = req.body;

        const template = await templateService.updateTemplate(req.user.id, req.params.id, {
            name,
            content,
            categoryId,
            mediaUrl,
            mediaType
        });

        res.json(template);
    } catch (error) {
        console.error('[Templates] Error updating template:', error);
        if (error.message === 'Template not found') {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.status(500).json({ error: 'Failed to update template' });
    }
});

/**
 * DELETE /api/templates/:id
 * Delete a template
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        await templateService.deleteTemplate(req.user.id, req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Templates] Error deleting template:', error);
        if (error.message === 'Template not found') {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

/**
 * POST /api/templates/:id/use
 * Record template usage and return parsed content
 */
router.post('/:id/use', auth, async (req, res) => {
    try {
        const { variables = {} } = req.body;

        const template = await templateService.getTemplate(req.user.id, req.params.id);
        await templateService.useTemplate(req.user.id, req.params.id);

        const parsedContent = templateService.parseTemplate(template.content, variables);

        res.json({
            template,
            parsedContent,
            variables: templateService.extractVariables(template.content)
        });
    } catch (error) {
        console.error('[Templates] Error using template:', error);
        if (error.message === 'Template not found') {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.status(500).json({ error: 'Failed to use template' });
    }
});

/**
 * POST /api/templates/:id/preview
 * Preview template with variables (without incrementing usage)
 */
router.post('/:id/preview', auth, async (req, res) => {
    try {
        const { variables = {} } = req.body;

        const template = await templateService.getTemplate(req.user.id, req.params.id);
        const parsedContent = templateService.parseTemplate(template.content, variables);

        res.json({
            original: template.content,
            parsed: parsedContent,
            variables: templateService.extractVariables(template.content)
        });
    } catch (error) {
        console.error('[Templates] Error previewing template:', error);
        if (error.message === 'Template not found') {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.status(500).json({ error: 'Failed to preview template' });
    }
});

// ==================== CATEGORIES ====================

/**
 * GET /api/templates/categories
 * Get all categories
 */
router.get('/categories/list', auth, async (req, res) => {
    try {
        const categories = await templateService.getCategories(req.user.id);
        res.json(categories);
    } catch (error) {
        console.error('[Templates] Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

/**
 * POST /api/templates/categories
 * Create a category
 */
router.post('/categories', auth, async (req, res) => {
    try {
        const { name, color } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const category = await templateService.createCategory(req.user.id, name, color);
        res.status(201).json(category);
    } catch (error) {
        console.error('[Templates] Error creating category:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Category name already exists' });
        }
        res.status(500).json({ error: 'Failed to create category' });
    }
});

/**
 * PUT /api/templates/categories/:id
 * Update a category
 */
router.put('/categories/:id', auth, async (req, res) => {
    try {
        const { name, color } = req.body;
        const category = await templateService.updateCategory(req.user.id, req.params.id, { name, color });
        res.json(category);
    } catch (error) {
        console.error('[Templates] Error updating category:', error);
        if (error.message === 'Category not found') {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.status(500).json({ error: 'Failed to update category' });
    }
});

/**
 * DELETE /api/templates/categories/:id
 * Delete a category
 */
router.delete('/categories/:id', auth, async (req, res) => {
    try {
        await templateService.deleteCategory(req.user.id, req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Templates] Error deleting category:', error);
        if (error.message === 'Category not found') {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

module.exports = router;
