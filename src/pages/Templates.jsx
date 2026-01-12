import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    FileText,
    Plus,
    Search,
    FolderOpen,
    MoreVertical,
    Edit,
    Trash2,
    Copy,
    Eye,
    X,
    Check,
    Tag,
    Image,
    Video,
    File
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useConfirm } from '../components/ConfirmDialog';

const Templates = () => {
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [editingCategory, setEditingCategory] = useState(null);
    const [previewTemplate, setPreviewTemplate] = useState(null);
    const [previewVariables, setPreviewVariables] = useState({});

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        content: '',
        categoryId: '',
        mediaUrl: '',
        mediaType: ''
    });

    const [categoryForm, setCategoryForm] = useState({
        name: '',
        color: '#6366f1'
    });

    // Fetch templates
    const { data: templatesData, isLoading } = useQuery({
        queryKey: ['templates', searchQuery, selectedCategory],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (selectedCategory) params.append('categoryId', selectedCategory);
            const res = await api.get(`/templates?${params}`);
            return res.data;
        }
    });

    // Fetch categories
    const { data: categories } = useQuery({
        queryKey: ['template-categories'],
        queryFn: async () => {
            const res = await api.get('/templates/categories/list');
            return res.data;
        }
    });

    // Create template mutation
    const createMutation = useMutation({
        mutationFn: async (data) => {
            const res = await api.post('/templates', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Template created successfully');
            queryClient.invalidateQueries(['templates']);
            closeModal();
        },
        onError: (error) => {
            toast.error(error.response?.data?.error || 'Failed to create template');
        }
    });

    // Update template mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            const res = await api.put(`/templates/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Template updated successfully');
            queryClient.invalidateQueries(['templates']);
            closeModal();
        },
        onError: (error) => {
            toast.error(error.response?.data?.error || 'Failed to update template');
        }
    });

    // Delete template mutation
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const res = await api.delete(`/templates/${id}`);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Template deleted successfully');
            queryClient.invalidateQueries(['templates']);
        },
        onError: (error) => {
            toast.error(error.response?.data?.error || 'Failed to delete template');
        }
    });

    // Category mutations
    const createCategoryMutation = useMutation({
        mutationFn: async (data) => {
            const res = await api.post('/templates/categories', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Category created successfully');
            queryClient.invalidateQueries(['template-categories']);
            closeCategoryModal();
        }
    });

    const updateCategoryMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            const res = await api.put(`/templates/categories/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Category updated successfully');
            queryClient.invalidateQueries(['template-categories']);
            closeCategoryModal();
        }
    });

    const deleteCategoryMutation = useMutation({
        mutationFn: async (id) => {
            const res = await api.delete(`/templates/categories/${id}`);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Category deleted successfully');
            queryClient.invalidateQueries(['template-categories']);
            setSelectedCategory(null);
        }
    });

    // Extract variables from content
    const extractVariables = (content) => {
        const matches = content.match(/\{\{(\w+)\}\}/g) || [];
        return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
    };

    // Parse template with variables
    const parseContent = (content, variables) => {
        return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return variables[key] !== undefined ? variables[key] : match;
        });
    };

    // Modal handlers
    const openCreateModal = () => {
        setEditingTemplate(null);
        setFormData({ name: '', content: '', categoryId: selectedCategory || '', mediaUrl: '', mediaType: '' });
        setShowModal(true);
    };

    const openEditModal = (template) => {
        setEditingTemplate(template);
        setFormData({
            name: template.name,
            content: template.content,
            categoryId: template.categoryId || '',
            mediaUrl: template.mediaUrl || '',
            mediaType: template.mediaType || ''
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingTemplate(null);
        setFormData({ name: '', content: '', categoryId: '', mediaUrl: '', mediaType: '' });
    };

    const openPreviewModal = (template) => {
        setPreviewTemplate(template);
        const vars = extractVariables(template.content);
        const initialVars = {};
        vars.forEach(v => initialVars[v] = '');
        setPreviewVariables(initialVars);
        setShowPreviewModal(true);
    };

    const closePreviewModal = () => {
        setShowPreviewModal(false);
        setPreviewTemplate(null);
        setPreviewVariables({});
    };

    const openCategoryModal = (category = null) => {
        setEditingCategory(category);
        setCategoryForm(category ? { name: category.name, color: category.color } : { name: '', color: '#6366f1' });
        setShowCategoryModal(true);
    };

    const closeCategoryModal = () => {
        setShowCategoryModal(false);
        setEditingCategory(null);
        setCategoryForm({ name: '', color: '#6366f1' });
    };

    // Form handlers
    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingTemplate) {
            updateMutation.mutate({ id: editingTemplate.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleCategorySubmit = (e) => {
        e.preventDefault();
        if (editingCategory) {
            updateCategoryMutation.mutate({ id: editingCategory.id, data: categoryForm });
        } else {
            createCategoryMutation.mutate(categoryForm);
        }
    };

    const handleDelete = async (id) => {
        const isConfirmed = await confirm({
            title: 'Delete Template?',
            message: 'Are you sure you want to delete this template?',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        });
        if (isConfirmed) {
            deleteMutation.mutate(id);
        }
    };

    const handleDeleteCategory = async (id) => {
        const isConfirmed = await confirm({
            title: 'Delete Category?',
            message: 'Are you sure you want to delete this category? Templates in this category will become uncategorized.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        });
        if (isConfirmed) {
            deleteCategoryMutation.mutate(id);
        }
    };

    const copyToClipboard = (content) => {
        navigator.clipboard.writeText(content);
        toast.success('Template copied to clipboard');
    };

    const templates = templatesData?.templates || [];
    const variables = extractVariables(formData.content);

    return (
        <div className="templates-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Templates</h1>
                    <p className="page-subtitle">Manage message templates with personalization variables</p>
                </div>
                <button className="btn btn-primary" onClick={openCreateModal}>
                    <Plus size={18} />
                    Create Template
                </button>
            </div>

            <div className="templates-layout">
                {/* Categories Sidebar */}
                <div className="categories-sidebar">
                    <div className="categories-header">
                        <h3>Categories</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => openCategoryModal()}>
                            <Plus size={16} />
                        </button>
                    </div>
                    <div className="categories-list">
                        <div
                            className={`category-item ${!selectedCategory ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(null)}
                        >
                            <FolderOpen size={18} />
                            <span>All Templates</span>
                            <span className="category-count">{templatesData?.pagination?.total || 0}</span>
                        </div>
                        {categories?.map(cat => (
                            <div
                                key={cat.id}
                                className={`category-item ${selectedCategory === cat.id ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat.id)}
                            >
                                <div className="category-color" style={{ backgroundColor: cat.color }} />
                                <span>{cat.name}</span>
                                <span className="category-count">{cat._count?.templates || 0}</span>
                                <div className="category-actions">
                                    <button onClick={(e) => { e.stopPropagation(); openCategoryModal(cat); }}>
                                        <Edit size={14} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Templates Grid */}
                <div className="templates-content">
                    <div className="templates-toolbar">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="templates-loading">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="template-skeleton" />
                            ))}
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="empty-templates">
                            <FileText size={64} />
                            <h3>No templates yet</h3>
                            <p>Create your first template to speed up message sending</p>
                            <button className="btn btn-primary" onClick={openCreateModal}>
                                <Plus size={18} />
                                Create Template
                            </button>
                        </div>
                    ) : (
                        <div className="templates-grid">
                            {templates.map(template => (
                                <div key={template.id} className="template-card">
                                    <div className="template-card-header">
                                        <h4>{template.name}</h4>
                                        {template.category && (
                                            <span
                                                className="template-category-badge"
                                                style={{ backgroundColor: template.category.color + '20', color: template.category.color }}
                                            >
                                                {template.category.name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="template-card-content">
                                        <p>{template.content.substring(0, 150)}{template.content.length > 150 ? '...' : ''}</p>
                                        {extractVariables(template.content).length > 0 && (
                                            <div className="template-variables">
                                                {extractVariables(template.content).map(v => (
                                                    <span key={v} className="variable-tag">{"{{" + v + "}}"}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="template-card-footer">
                                        <span className="usage-count">Used {template.usageCount}x</span>
                                        <div className="template-actions">
                                            <button onClick={() => openPreviewModal(template)} title="Preview">
                                                <Eye size={16} />
                                            </button>
                                            <button onClick={() => copyToClipboard(template.content)} title="Copy">
                                                <Copy size={16} />
                                            </button>
                                            <button onClick={() => openEditModal(template)} title="Edit">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(template.id)} title="Delete" className="delete-btn">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            <div className={`modal-overlay ${showModal ? 'open' : ''}`} onClick={closeModal}>
                <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3 className="modal-title">{editingTemplate ? 'Edit Template' : 'Create New Template'}</h3>
                        <button className="btn btn-ghost btn-icon" onClick={closeModal}>
                            <X size={20} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Template Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Example: Welcome Message"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Category</label>
                                <select
                                    className="form-select"
                                    value={formData.categoryId}
                                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                >
                                    <option value="">No Category</option>
                                    {categories?.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Template Content
                                    <span className="form-hint-inline">Use {"{{name}}"} for variables</span>
                                </label>
                                <textarea
                                    className="form-textarea"
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    placeholder="Hello {{name}}, thank you for contacting us..."
                                    rows={6}
                                    required
                                />
                                {variables.length > 0 && (
                                    <div className="detected-variables">
                                        <span>Variables detected:</span>
                                        {variables.map(v => (
                                            <span key={v} className="variable-tag">{"{{" + v + "}}"}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Media URL (Optional)</label>
                                <input
                                    type="url"
                                    className="form-input"
                                    value={formData.mediaUrl}
                                    onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                                    placeholder="https://example.com/image.jpg"
                                />
                            </div>

                            {formData.mediaUrl && (
                                <div className="form-group">
                                    <label className="form-label">Media Type</label>
                                    <select
                                        className="form-select"
                                        value={formData.mediaType}
                                        onChange={(e) => setFormData({ ...formData, mediaType: e.target.value })}
                                    >
                                        <option value="">Select type</option>
                                        <option value="image">Image</option>
                                        <option value="video">Video</option>
                                        <option value="document">Document</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={createMutation.isPending || updateMutation.isPending}
                            >
                                {editingTemplate ? 'Save Changes' : 'Create Template'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Preview Modal */}
            <div className={`modal-overlay ${showPreviewModal ? 'open' : ''}`} onClick={closePreviewModal}>
                <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3 className="modal-title">Preview Template</h3>
                        <button className="btn btn-ghost btn-icon" onClick={closePreviewModal}>
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body">
                        {previewTemplate && (
                            <div className="preview-layout">
                                <div className="preview-variables-panel">
                                    <h4>Fill Variables</h4>
                                    {Object.keys(previewVariables).length === 0 ? (
                                        <p className="no-variables">This template has no variables</p>
                                    ) : (
                                        Object.keys(previewVariables).map(key => (
                                            <div key={key} className="form-group">
                                                <label className="form-label">{key}</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={previewVariables[key]}
                                                    onChange={(e) => setPreviewVariables({
                                                        ...previewVariables,
                                                        [key]: e.target.value
                                                    })}
                                                    placeholder={`Masukkan nilai ${key}`}
                                                />
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="preview-result-panel">
                                    <h4>Preview Result</h4>
                                    <div className="preview-bubble">
                                        {parseContent(previewTemplate.content, previewVariables)}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button
                            className="btn btn-primary"
                            onClick={() => previewTemplate && copyToClipboard(parseContent(previewTemplate.content, previewVariables))}
                        >
                            <Copy size={16} />
                            Copy Result
                        </button>
                    </div>
                </div>
            </div>

            {/* Category Modal */}
            <div className={`modal-overlay ${showCategoryModal ? 'open' : ''}`} onClick={closeCategoryModal}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3 className="modal-title">{editingCategory ? 'Edit Category' : 'Create New Category'}</h3>
                        <button className="btn btn-ghost btn-icon" onClick={closeCategoryModal}>
                            <X size={20} />
                        </button>
                    </div>
                    <form onSubmit={handleCategorySubmit}>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Category Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={categoryForm.name}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                    placeholder="Example: Promotion"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Color</label>
                                <div className="color-picker-row">
                                    <input
                                        type="color"
                                        value={categoryForm.color}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={categoryForm.color}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeCategoryModal}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary">
                                {editingCategory ? 'Save' : 'Create'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Templates;
