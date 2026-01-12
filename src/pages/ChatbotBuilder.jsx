import { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    addEdge,
    useNodesState,
    useEdgesState,
    MarkerType,
    Panel,
    Handle,
    Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
    Save,
    Play,
    Pause,
    Plus,
    Settings,
    ArrowLeft,
    MessageSquare,
    GitBranch,
    Clock,
    Code,
    FileText,
    Zap,
    CheckCircle,
    AlertCircle,
    Trash2,
    Copy,
    ChevronDown,
    Smartphone,
    Brain
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useConfirm } from '../components/ConfirmDialog';

// Custom Node Components with Handles
const StartNode = ({ data }) => (
    <div className="chatbot-node start-node">
        <div className="node-header">
            <Zap size={14} />
            <span>Start</span>
        </div>
        <div className="node-body">
            <p>Flow starts here</p>
        </div>
        <Handle type="source" position={Position.Bottom} id="out" className="handle-source" />
    </div>
);

const MessageNode = ({ data, selected }) => (
    <div className={`chatbot-node message-node ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} id="in" className="handle-target" />
        <div className="node-header">
            <MessageSquare size={14} />
            <span>Message</span>
        </div>
        <div className="node-body">
            <p>{data.message || 'Enter your message...'}</p>
            {data.mediaUrl && (
                <div className="node-media-badge">📎 Media attached</div>
            )}
        </div>
        <Handle type="source" position={Position.Bottom} id="out" className="handle-source" />
    </div>
);

const ConditionNode = ({ data, selected }) => (
    <div className={`chatbot-node condition-node ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} id="in" className="handle-target" />
        <div className="node-header">
            <GitBranch size={14} />
            <span>Condition</span>
        </div>
        <div className="node-body">
            <p className="condition-text">
                If <strong>{data.field || 'message'}</strong> {data.operator || 'contains'} "<em>{data.value || '...'}</em>"
            </p>
        </div>
        <div className="condition-handles">
            <Handle
                type="source"
                position={Position.Bottom}
                id="yes"
                className="handle-source handle-yes"
                style={{ left: '30%' }}
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="no"
                className="handle-source handle-no"
                style={{ left: '70%' }}
            />
        </div>
        <div className="condition-labels">
            <span className="label-yes">Yes</span>
            <span className="label-no">No</span>
        </div>
    </div>
);

const DelayNode = ({ data, selected }) => (
    <div className={`chatbot-node delay-node ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} id="in" className="handle-target" />
        <div className="node-header">
            <Clock size={14} />
            <span>Delay</span>
        </div>
        <div className="node-body">
            <p>Wait {data.seconds || 1} second(s)</p>
        </div>
        <Handle type="source" position={Position.Bottom} id="out" className="handle-source" />
    </div>
);

const ApiCallNode = ({ data, selected }) => (
    <div className={`chatbot-node api-node ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} id="in" className="handle-target" />
        <div className="node-header">
            <Code size={14} />
            <span>API Call</span>
        </div>
        <div className="node-body">
            <p className="api-method">{data.method || 'GET'}</p>
            <p className="api-url">{data.url || 'Enter URL...'}</p>
        </div>
        <Handle type="source" position={Position.Bottom} id="out" className="handle-source" />
    </div>
);

const TemplateNode = ({ data, selected }) => (
    <div className={`chatbot-node template-node ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} id="in" className="handle-target" />
        <div className="node-header">
            <FileText size={14} />
            <span>Template</span>
        </div>
        <div className="node-body">
            <p>{data.templateName || 'Select template...'}</p>
        </div>
        <Handle type="source" position={Position.Bottom} id="out" className="handle-source" />
    </div>
);

const KnowledgeNode = ({ data, selected }) => (
    <div className={`chatbot-node knowledge-node ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} id="in" className="handle-target" />
        <div className="node-header" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
            <Brain size={14} />
            <span>Smart Knowledge</span>
        </div>
        <div className="node-body">
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {data.knowledgeBaseName || 'Select knowledge base...'}
            </p>
            {data.fallbackMessage && (
                <p style={{ fontSize: '0.7rem', color: 'var(--warning)', marginTop: '4px' }}>+ Fallback</p>
            )}
        </div>
        <Handle type="source" position={Position.Bottom} id="out" className="handle-source" />
    </div>
);

// Node types configuration
const nodeTypes = {
    startNode: StartNode,
    messageNode: MessageNode,
    conditionNode: ConditionNode,
    delayNode: DelayNode,
    apiCallNode: ApiCallNode,
    templateNode: TemplateNode,
    knowledgeNode: KnowledgeNode
};

// Node palette items
const nodePalette = [
    { type: 'messageNode', label: 'Message', icon: MessageSquare, color: '#10b981' },
    { type: 'conditionNode', label: 'Condition', icon: GitBranch, color: '#f59e0b' },
    { type: 'delayNode', label: 'Delay', icon: Clock, color: '#6366f1' },
    { type: 'apiCallNode', label: 'API Call', icon: Code, color: '#ef4444' },
    { type: 'templateNode', label: 'Template', icon: FileText, color: '#8b5cf6' },
    { type: 'knowledgeNode', label: 'Smart Knowledge', icon: Brain, color: '#8b5cf6' }
];

export default function ChatbotBuilder() {
    const confirm = useConfirm();
    // State
    const [chatbots, setChatbots] = useState([]);
    const [selectedChatbot, setSelectedChatbot] = useState(null);
    const [isBuilderMode, setIsBuilderMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [devices, setDevices] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [knowledgeBases, setKnowledgeBases] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [showNodeEditor, setShowNodeEditor] = useState(false);

    // Form state for new/edit chatbot
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        deviceId: '',
        triggerType: 'keyword',
        triggerKeywords: ''
    });

    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Memoized node types
    const memoizedNodeTypes = useMemo(() => nodeTypes, []);

    // Derive current node from nodes array (always fresh)
    const currentNode = useMemo(() => {
        if (!selectedNodeId) return null;
        return nodes.find(n => n.id === selectedNodeId) || null;
    }, [nodes, selectedNodeId]);

    // Load chatbots on mount
    useEffect(() => {
        fetchChatbots();
        fetchDevices();
        fetchTemplates();
        fetchKnowledgeBases();
    }, []);

    const fetchChatbots = async () => {
        try {
            setIsLoading(true);
            const res = await api.get('/chatbots');
            setChatbots(res.data.data || []);
        } catch (error) {
            console.error('Error fetching chatbots:', error);
            toast.error('Failed to load chatbots');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDevices = async () => {
        try {
            const res = await api.get('/devices');
            setDevices(res.data.data || []);
        } catch (error) {
            console.error('Error fetching devices:', error);
        }
    };

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/templates');
            setTemplates(res.data.data || []);
        } catch (error) {
            console.error('Error fetching templates:', error);
        }
    };

    const fetchKnowledgeBases = async () => {
        try {
            const res = await api.get('/knowledge');
            // Only show ready knowledge bases
            setKnowledgeBases((res.data.data || []).filter(kb => kb.status === 'ready'));
        } catch (error) {
            console.error('Error fetching knowledge bases:', error);
        }
    };

    // Handle connection between nodes
    const onConnect = useCallback((params) => {
        const newEdge = {
            ...params,
            type: 'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed }
        };
        setEdges((eds) => addEdge(newEdge, eds));
    }, [setEdges]);

    // Handle node click
    const onNodeClick = useCallback((event, node) => {
        if (node.type !== 'startNode') {
            setSelectedNodeId(node.id);
            setShowNodeEditor(true);
        }
    }, []);

    // Add new node from palette
    const addNode = (type) => {
        const id = `${type}-${Date.now()}`;
        const position = {
            x: 250 + Math.random() * 100,
            y: 100 + nodes.length * 100
        };

        let data = { label: type };

        switch (type) {
            case 'messageNode':
                data = { message: '', mediaUrl: '' };
                break;
            case 'conditionNode':
                data = { field: 'message', operator: 'contains', value: '' };
                break;
            case 'delayNode':
                data = { seconds: 1 };
                break;
            case 'apiCallNode':
                data = { url: '', method: 'GET' };
                break;
            case 'templateNode':
                data = { templateId: '', templateName: '' };
                break;
            case 'knowledgeNode':
                data = { knowledgeBaseId: '', knowledgeBaseName: '', fallbackMessage: '' };
                break;
        }

        const newNode = { id, type, position, data };
        setNodes((nds) => [...nds, newNode]);
        toast.success('Node added');
    };

    // Update node data
    const updateNodeData = (nodeId, newData) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: { ...node.data, ...newData } };
                }
                return node;
            })
        );
    };

    // Delete selected node
    const deleteSelectedNode = () => {
        if (currentNode && currentNode.type !== 'startNode') {
            setNodes((nds) => nds.filter((n) => n.id !== currentNode.id));
            setEdges((eds) => eds.filter((e) =>
                e.source !== currentNode.id && e.target !== currentNode.id
            ));
            setSelectedNodeId(null);
            setShowNodeEditor(false);
            toast.success('Node deleted');
        }
    };

    // Create new chatbot
    const handleCreate = async () => {
        if (!formData.name.trim()) {
            toast.error('Please enter a name');
            return;
        }

        try {
            const res = await api.post('/chatbots', formData);
            setChatbots([res.data.data, ...chatbots]);
            setShowModal(false);
            setFormData({
                name: '',
                description: '',
                deviceId: '',
                triggerType: 'keyword',
                triggerKeywords: ''
            });
            toast.success('Chatbot created');
        } catch (error) {
            console.error('Error creating chatbot:', error);
            toast.error('Failed to create chatbot');
        }
    };

    // Open builder for a chatbot
    const openBuilder = (chatbot) => {
        setSelectedChatbot(chatbot);
        setNodes(chatbot.nodes || [{ id: 'start-1', type: 'startNode', position: { x: 250, y: 50 }, data: { label: 'Start' } }]);
        setEdges(chatbot.edges || []);
        setFormData({
            name: chatbot.name,
            description: chatbot.description || '',
            deviceId: chatbot.deviceId || '',
            triggerType: chatbot.triggerType || 'keyword',
            triggerKeywords: chatbot.triggerKeywords || ''
        });
        setIsBuilderMode(true);
    };

    // Save flow
    const saveFlow = async () => {
        if (!selectedChatbot) return;

        try {
            setIsSaving(true);
            await api.put(`/chatbots/${selectedChatbot.id}`, {
                ...formData,
                nodes,
                edges
            });
            toast.success('Flow saved successfully');
            fetchChatbots();
        } catch (error) {
            console.error('Error saving flow:', error);
            toast.error('Failed to save flow');
        } finally {
            setIsSaving(false);
        }
    };

    // Toggle chatbot active status
    const toggleActive = async (chatbot) => {
        try {
            await api.post(`/chatbots/${chatbot.id}/activate`, {
                isActive: !chatbot.isActive
            });
            fetchChatbots();
            toast.success(`Chatbot ${!chatbot.isActive ? 'activated' : 'deactivated'}`);
        } catch (error) {
            console.error('Error toggling chatbot:', error);
            toast.error('Failed to update status');
        }
    };

    // Delete chatbot
    const deleteChatbot = async (chatbot) => {
        const isConfirmed = await confirm({
            title: 'Delete Chatbot?',
            message: `Delete "${chatbot.name}"? This action cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        });
        if (!isConfirmed) return;

        try {
            await api.delete(`/chatbots/${chatbot.id}`);
            setChatbots(chatbots.filter(c => c.id !== chatbot.id));
            toast.success('Chatbot deleted successfully');
        } catch (error) {
            console.error('Error deleting chatbot:', error);
            toast.error('Failed to delete chatbot');
        }
    };

    // Duplicate chatbot
    const duplicateChatbot = async (chatbot) => {
        try {
            const res = await api.post(`/chatbots/${chatbot.id}/duplicate`);
            setChatbots([res.data.data, ...chatbots]);
            toast.success('Chatbot duplicated');
        } catch (error) {
            console.error('Error duplicating chatbot:', error);
            toast.error('Failed to duplicate chatbot');
        }
    };

    // Back to list
    const goBack = () => {
        setIsBuilderMode(false);
        setSelectedChatbot(null);
        setSelectedNodeId(null);
        setShowNodeEditor(false);
    };

    // Render loading state
    if (isLoading) {
        return (
            <div className="page-container">
                <div className="loading-container">
                    <div className="loading-spinner" />
                    <p>Loading chatbots...</p>
                </div>
            </div>
        );
    }

    // Render builder mode
    if (isBuilderMode && selectedChatbot) {
        return (
            <div className="chatbot-builder-container">
                {/* Header */}
                <div className="builder-header">
                    <div className="builder-header-left">
                        <button className="btn btn-ghost" onClick={goBack}>
                            <ArrowLeft size={18} />
                        </button>
                        <div className="builder-title">
                            <h2>{formData.name}</h2>
                            <span className={`status-badge ${selectedChatbot.isActive ? 'active' : 'inactive'}`}>
                                {selectedChatbot.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                    <div className="builder-header-right">
                        <button className="btn btn-ghost" onClick={() => setShowSettingsModal(true)}>
                            <Settings size={18} />
                            Settings
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={saveFlow}
                            disabled={isSaving}
                        >
                            <Save size={18} />
                            {isSaving ? 'Saving...' : 'Save Flow'}
                        </button>
                    </div>
                </div>

                {/* Main builder area */}
                <div className="builder-content">
                    {/* Node palette */}
                    <div className="node-palette">
                        <h3>Add Nodes</h3>
                        {nodePalette.map((item) => (
                            <button
                                key={item.type}
                                className="palette-item"
                                onClick={() => addNode(item.type)}
                                style={{ '--node-color': item.color }}
                            >
                                <item.icon size={18} />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* React Flow canvas */}
                    <div className="flow-canvas">
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onNodeClick={onNodeClick}
                            nodeTypes={memoizedNodeTypes}
                            fitView
                            snapToGrid
                            snapGrid={[15, 15]}
                            defaultEdgeOptions={{
                                type: 'smoothstep',
                                animated: true,
                                markerEnd: { type: MarkerType.ArrowClosed }
                            }}
                        >
                            <Background variant="dots" gap={20} size={1} />
                            <Controls />
                            <MiniMap
                                nodeStrokeColor="#374151"
                                nodeColor="#1f2937"
                                maskColor="rgba(0, 0, 0, 0.5)"
                            />
                            <Panel position="bottom-center" className="flow-hint">
                                Drag to connect nodes • Click node to edit • Scroll to zoom
                            </Panel>
                        </ReactFlow>
                    </div>

                    {/* Node editor sidebar */}
                    {showNodeEditor && currentNode && (
                        <div className="node-editor">
                            <div className="node-editor-header">
                                <h3>Edit Node</h3>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowNodeEditor(false)}>
                                    ×
                                </button>
                            </div>
                            <div className="node-editor-content">
                                {currentNode.type === 'messageNode' && (
                                    <>
                                        <div className="form-group">
                                            <label>Message</label>
                                            <textarea
                                                value={currentNode.data.message || ''}
                                                onChange={(e) => updateNodeData(currentNode.id, { message: e.target.value })}
                                                placeholder="Enter your message..."
                                                rows={4}
                                            />
                                            <small>Use {"{{message}}"} for incoming message, {"{{senderId}}"} for sender</small>
                                        </div>
                                        <div className="form-group">
                                            <label>Media URL (optional)</label>
                                            <input
                                                type="text"
                                                value={currentNode.data.mediaUrl || ''}
                                                onChange={(e) => updateNodeData(currentNode.id, { mediaUrl: e.target.value })}
                                                placeholder="https://example.com/image.jpg"
                                            />
                                        </div>
                                    </>
                                )}

                                {currentNode.type === 'conditionNode' && (
                                    <>
                                        <div className="form-group">
                                            <label>Field</label>
                                            <select
                                                value={currentNode.data.field || 'message'}
                                                onChange={(e) => updateNodeData(currentNode.id, { field: e.target.value })}
                                            >
                                                <option value="message">Message</option>
                                                <option value="senderId">Sender ID</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Operator</label>
                                            <select
                                                value={currentNode.data.operator || 'contains'}
                                                onChange={(e) => updateNodeData(currentNode.id, { operator: e.target.value })}
                                            >
                                                <option value="contains">Contains</option>
                                                <option value="equals">Equals</option>
                                                <option value="startsWith">Starts with</option>
                                                <option value="endsWith">Ends with</option>
                                                <option value="notContains">Not contains</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Value</label>
                                            <input
                                                type="text"
                                                value={currentNode.data.value || ''}
                                                onChange={(e) => updateNodeData(currentNode.id, { value: e.target.value })}
                                                placeholder="Enter value to match..."
                                            />
                                        </div>
                                    </>
                                )}

                                {currentNode.type === 'delayNode' && (
                                    <div className="form-group">
                                        <label>Delay (seconds)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="300"
                                            value={currentNode.data.seconds || 1}
                                            onChange={(e) => updateNodeData(currentNode.id, { seconds: parseInt(e.target.value) || 1 })}
                                        />
                                    </div>
                                )}

                                {currentNode.type === 'apiCallNode' && (
                                    <>
                                        <div className="form-group">
                                            <label>Method</label>
                                            <select
                                                value={currentNode.data.method || 'GET'}
                                                onChange={(e) => updateNodeData(currentNode.id, { method: e.target.value })}
                                            >
                                                <option value="GET">GET</option>
                                                <option value="POST">POST</option>
                                                <option value="PUT">PUT</option>
                                                <option value="DELETE">DELETE</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>URL</label>
                                            <input
                                                type="text"
                                                value={currentNode.data.url || ''}
                                                onChange={(e) => updateNodeData(currentNode.id, { url: e.target.value })}
                                                placeholder="https://api.example.com/endpoint"
                                            />
                                        </div>
                                    </>
                                )}

                                {currentNode.type === 'templateNode' && (
                                    <div className="form-group">
                                        <label>Template</label>
                                        <select
                                            value={currentNode.data.templateId || ''}
                                            onChange={(e) => {
                                                const template = templates.find(t => t.id === e.target.value);
                                                updateNodeData(currentNode.id, {
                                                    templateId: e.target.value,
                                                    templateName: template?.name || ''
                                                });
                                            }}
                                        >
                                            <option value="">Select template...</option>
                                            {templates.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {currentNode.type === 'knowledgeNode' && (
                                    <>
                                        <div className="form-group">
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Brain size={14} style={{ color: 'var(--primary-500)' }} />
                                                Knowledge Base
                                            </label>
                                            <select
                                                value={currentNode.data.knowledgeBaseId || ''}
                                                onChange={(e) => {
                                                    const kb = knowledgeBases.find(k => k.id === e.target.value);
                                                    updateNodeData(currentNode.id, {
                                                        knowledgeBaseId: e.target.value,
                                                        knowledgeBaseName: kb?.name || ''
                                                    });
                                                }}
                                            >
                                                <option value="">Select knowledge base...</option>
                                                {knowledgeBases.map(kb => (
                                                    <option key={kb.id} value={kb.id}>
                                                        {kb.name} ({kb.chunkCount} chunks)
                                                    </option>
                                                ))}
                                            </select>
                                            {knowledgeBases.length === 0 && (
                                                <small style={{ color: 'var(--warning)' }}>
                                                    No knowledge bases available. Create one in Smart Knowledge page.
                                                </small>
                                            )}
                                        </div>
                                        <div className="form-group">
                                            <label>Fallback Message (optional)</label>
                                            <textarea
                                                value={currentNode.data.fallbackMessage || ''}
                                                onChange={(e) => updateNodeData(currentNode.id, { fallbackMessage: e.target.value })}
                                                placeholder="Message to send if no relevant answer found..."
                                                rows={3}
                                            />
                                            <small>Sent when AI cannot find a relevant answer from the knowledge base</small>
                                        </div>
                                        <div style={{
                                            padding: '10px',
                                            background: 'rgba(139, 92, 246, 0.1)',
                                            borderRadius: 'var(--radius-md)',
                                            marginBottom: '12px'
                                        }}>
                                            <small style={{ color: 'var(--primary-400)' }}>
                                                💡 The incoming message will be sent to the AI which will search the knowledge base and generate a response.
                                            </small>
                                        </div>
                                    </>
                                )}

                                <button
                                    className="btn btn-danger btn-block"
                                    onClick={deleteSelectedNode}
                                >
                                    <Trash2 size={16} />
                                    Delete Node
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Settings Modal */}
                <div className={`modal-overlay ${showSettingsModal ? 'open' : ''}`}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Chatbot Settings</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowSettingsModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="My Chatbot"
                                />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="What does this chatbot do?"
                                    rows={3}
                                />
                            </div>
                            <div className="form-group">
                                <label>Device</label>
                                <select
                                    value={formData.deviceId}
                                    onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                                >
                                    <option value="">All Devices</option>
                                    {devices.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Trigger Type</label>
                                <select
                                    value={formData.triggerType}
                                    onChange={(e) => setFormData({ ...formData, triggerType: e.target.value })}
                                >
                                    <option value="keyword">Keyword Match</option>
                                    <option value="exact">Exact Match</option>
                                    <option value="all">All Messages</option>
                                </select>
                            </div>
                            {(formData.triggerType === 'keyword' || formData.triggerType === 'exact') && (
                                <div className="form-group">
                                    <label>Trigger Keywords</label>
                                    <input
                                        type="text"
                                        value={formData.triggerKeywords}
                                        onChange={(e) => setFormData({ ...formData, triggerKeywords: e.target.value })}
                                        placeholder="hello, hi, help (comma separated)"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowSettingsModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={() => { saveFlow(); setShowSettingsModal(false); }}>
                                Save Settings
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Render chatbot list
    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-title">
                    <h1>Chatbot Builder</h1>
                    <p>Create visual chatbot flows with drag-and-drop</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={18} />
                    Create Chatbot
                </button>
            </div>

            {/* Stats cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                        <Zap size={24} />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">Total Chatbots</p>
                        <h3 className="stat-value">{chatbots.length}</h3>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981, #14b8a6)' }}>
                        <CheckCircle size={24} />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">Active Chatbots</p>
                        <h3 className="stat-value">{chatbots.filter(c => c.isActive).length}</h3>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
                        <Play size={24} />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">Total Executions</p>
                        <h3 className="stat-value">{chatbots.reduce((sum, c) => sum + (c.executionCount || 0), 0)}</h3>
                    </div>
                </div>
            </div>

            {/* Chatbot grid */}
            <div className="chatbot-grid">
                {chatbots.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <Zap size={48} />
                        </div>
                        <h3>No chatbots yet</h3>
                        <p>Create your first chatbot to automate conversations</p>
                        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                            <Plus size={18} />
                            Create Chatbot
                        </button>
                    </div>
                ) : (
                    chatbots.map(chatbot => (
                        <div key={chatbot.id} className="chatbot-card">
                            <div className="chatbot-card-header">
                                <div className="chatbot-info">
                                    <h3>{chatbot.name}</h3>
                                    <p>{chatbot.description || 'No description'}</p>
                                </div>
                                <div className={`status-indicator ${chatbot.isActive ? 'active' : 'inactive'}`}>
                                    {chatbot.isActive ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                </div>
                            </div>
                            <div className="chatbot-card-body">
                                <div className="chatbot-meta">
                                    <span className="meta-item">
                                        <GitBranch size={14} />
                                        {(chatbot.nodes?.length || 0)} nodes
                                    </span>
                                    <span className="meta-item">
                                        <Play size={14} />
                                        {chatbot.executionCount || 0} runs
                                    </span>
                                    {chatbot.device && (
                                        <span className="meta-item">
                                            <Smartphone size={14} />
                                            {chatbot.device.name}
                                        </span>
                                    )}
                                </div>
                                <div className="chatbot-trigger">
                                    <span className="trigger-badge">
                                        {chatbot.triggerType === 'keyword' && '🔑 Keywords'}
                                        {chatbot.triggerType === 'exact' && '🎯 Exact'}
                                        {chatbot.triggerType === 'all' && '📨 All Messages'}
                                    </span>
                                    {chatbot.triggerKeywords && (
                                        <span className="trigger-keywords">{chatbot.triggerKeywords}</span>
                                    )}
                                </div>
                            </div>
                            <div className="chatbot-card-footer">
                                <button className="btn btn-secondary" onClick={() => openBuilder(chatbot)}>
                                    <Settings size={16} />
                                    Edit Flow
                                </button>
                                <div className="chatbot-actions">
                                    <button
                                        className={`btn btn-icon ${chatbot.isActive ? 'btn-warning' : 'btn-success'}`}
                                        onClick={() => toggleActive(chatbot)}
                                        title={chatbot.isActive ? 'Deactivate' : 'Activate'}
                                    >
                                        {chatbot.isActive ? <Pause size={16} /> : <Play size={16} />}
                                    </button>
                                    <button
                                        className="btn btn-icon btn-ghost"
                                        onClick={() => duplicateChatbot(chatbot)}
                                        title="Duplicate"
                                    >
                                        <Copy size={16} />
                                    </button>
                                    <button
                                        className="btn btn-icon btn-danger"
                                        onClick={() => deleteChatbot(chatbot)}
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create Modal */}
            <div className={`modal-overlay ${showModal ? 'open' : ''}`}>
                <div className="modal">
                    <div className="modal-header">
                        <h3>Create New Chatbot</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>×</button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Name *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Welcome Bot"
                            />
                        </div>
                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="What does this chatbot do?"
                                rows={3}
                            />
                        </div>
                        <div className="form-group">
                            <label>Device (optional)</label>
                            <select
                                value={formData.deviceId}
                                onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                            >
                                <option value="">All Devices</option>
                                {devices.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Trigger Type</label>
                            <select
                                value={formData.triggerType}
                                onChange={(e) => setFormData({ ...formData, triggerType: e.target.value })}
                            >
                                <option value="keyword">Keyword Match</option>
                                <option value="exact">Exact Match</option>
                                <option value="all">All Messages</option>
                            </select>
                        </div>
                        {(formData.triggerType === 'keyword' || formData.triggerType === 'exact') && (
                            <div className="form-group">
                                <label>Trigger Keywords</label>
                                <input
                                    type="text"
                                    value={formData.triggerKeywords}
                                    onChange={(e) => setFormData({ ...formData, triggerKeywords: e.target.value })}
                                    placeholder="hello, hi, help (comma separated)"
                                />
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate}>Create Chatbot</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
