import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    MessageSquare,
    Search,
    Pin,
    Check,
    CheckCheck,
    Send,
    Paperclip,
    Smile,
    MoreVertical,
    ArrowLeft,
    User,
    Phone,
    Users,
    Clock,
    Zap,
    RefreshCw,
    Sparkles,
    Wand2,
    Brain,
    Trash2,
    X,
    Plus,
    Archive,
    ArchiveRestore
} from 'lucide-react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import SmartReply from '../components/ai/SmartReply';
import SentimentBadge from '../components/ai/SentimentBadge';
import SmartCompose from '../components/ai/SmartCompose';
import { API_URL } from '../utils/config';

const Inbox = () => {
    const queryClient = useQueryClient();
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [messageInput, setMessageInput] = useState('');
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [showSmartReply, setShowSmartReply] = useState(false);
    const [showSmartCompose, setShowSmartCompose] = useState(false);
    const [aiEnabled, setAiEnabled] = useState(false);
    const [lastIncomingMessage, setLastIncomingMessage] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showChatMenu, setShowChatMenu] = useState(false);
    const [emojiCategory, setEmojiCategory] = useState('smileys');
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [newChatPhone, setNewChatPhone] = useState('');
    const [newChatName, setNewChatName] = useState('');
    const [newChatDeviceId, setNewChatDeviceId] = useState('');
    const [selectedDeviceId, setSelectedDeviceId] = useState('all'); // 'all' or device ID
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);


    // Comprehensive emoji collection with categories like WhatsApp
    const emojiCategories = {
        smileys: {
            name: '😊',
            title: 'Smileys & People',
            emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖']
        },
        gestures: {
            name: '👋',
            title: 'Gestures & Body',
            emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸']
        },
        hearts: {
            name: '❤️',
            title: 'Hearts & Love',
            emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '❤️‍🔥', '❤️‍🩹', '💋', '💌', '💍', '💐', '🌹', '🥀', '🌸', '💮', '🏵️', '🌺', '🌻', '🌼', '🌷']
        },
        animals: {
            name: '🐶',
            title: 'Animals & Nature',
            emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🐓', '🦃', '🦤', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔']
        },
        food: {
            name: '🍕',
            title: 'Food & Drink',
            emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊']
        },
        activities: {
            name: '⚽',
            title: 'Activities',
            emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩']
        },
        travel: {
            name: '🚗',
            title: 'Travel & Places',
            emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '🪝', '⛽', '🚧', '🚦', '🚥', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🛖', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋', '⛩️', '🛤️', '🛣️', '🗾', '🎑', '🏞️', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁']
        },
        objects: {
            name: '💡',
            title: 'Objects',
            emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '🪧', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓']
        },
        symbols: {
            name: '❤️',
            title: 'Symbols',
            emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '🟰', '♾️', '💲', '💱', '™️', '©️', '®️', '👁️‍🗨️', '🔚', '🔙', '🔛', '🔝', '🔜', '〰️', '➰', '➿', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧']
        }
    };

    // Check if AI is configured
    useEffect(() => {
        const checkAI = async () => {
            try {
                const res = await fetch(`${API_URL}/ai/status`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                const data = await res.json();
                setAiEnabled(data.configured === true);
            } catch (err) {
                setAiEnabled(false);
            }
        };
        checkAI();
    }, []);

    // Fetch conversations (filtered by device if selected)
    const { data: conversationsData, isLoading: loadingConversations, refetch: refetchConversations } = useQuery({
        queryKey: ['inbox-conversations', searchQuery, selectedDeviceId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (selectedDeviceId && selectedDeviceId !== 'all') {
                params.append('deviceId', selectedDeviceId);
            }
            const res = await api.get(`/inbox/conversations?${params}`);
            return res.data;
        },
        refetchInterval: 30000 // Fallback refresh every 30 seconds (Socket.io handles real-time updates)
    });

    // Fetch messages for selected conversation
    const { data: messagesData, isLoading: loadingMessages, refetch: refetchMessages } = useQuery({
        queryKey: ['inbox-messages', selectedConversation?.id],
        queryFn: async () => {
            if (!selectedConversation) return null;
            const res = await api.get(`/inbox/conversations/${selectedConversation.id}/messages`);
            return res.data;
        },
        enabled: !!selectedConversation,
        refetchInterval: 30000 // Fallback refresh every 30 seconds (Socket.io handles real-time updates)
    });

    // Socket.io connection for real-time updates (using centralized context)
    const { socket, joinRoom, leaveRoom } = useSocket();

    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (data) => {
            console.log('[Inbox] Socket: message.created received', data);
            // Refresh conversations and messages when new message arrives
            console.log('[Inbox] Triggering refetchConversations...');
            queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
            refetchConversations();
            if (selectedConversation?.id) {
                refetchMessages();
            }
        };

        const handleMessageStatus = (data) => {
            console.log('[Inbox] Socket: message.updated received', data);
            // Refresh when message status changes
            if (selectedConversation?.id) {
                refetchMessages();
            }
        };

        // Listen to correct event names from backend
        socket.on('message.created', handleNewMessage);
        socket.on('message.updated', handleMessageStatus);

        return () => {
            socket.off('message.created', handleNewMessage);
            socket.off('message.updated', handleMessageStatus);
        };
    }, [socket, selectedConversation?.id]);

    // Update last incoming message for AI suggestions
    useEffect(() => {
        if (messagesData?.messages && messagesData.messages.length > 0) {
            const incoming = messagesData.messages.filter(m => m.type === 'incoming');
            if (incoming.length > 0) {
                const lastMsg = incoming[incoming.length - 1];
                setLastIncomingMessage(lastMsg.message);
                // Auto show smart reply if AI is enabled and there's a new message
                if (aiEnabled && lastMsg.message) {
                    setShowSmartReply(true);
                }
            }
        }
    }, [messagesData?.messages, aiEnabled]);

    // Fetch quick replies
    const { data: quickReplies } = useQuery({
        queryKey: ['quick-replies'],
        queryFn: async () => {
            const res = await api.get('/inbox/quick-replies');
            return res.data;
        }
    });

    // Fetch unread count
    const { data: unreadData } = useQuery({
        queryKey: ['inbox-unread'],
        queryFn: async () => {
            const res = await api.get('/inbox/unread-count');
            return res.data;
        },
        refetchInterval: 10000
    });

    // Fetch devices for new chat
    const { data: devicesData } = useQuery({
        queryKey: ['devices-for-inbox'],
        queryFn: async () => {
            const res = await api.get('/devices');
            return res.data;
        }
    });

    // Auto-join device rooms for real-time updates
    useEffect(() => {
        if (!socket || !devicesData?.data) return;

        const devices = devicesData.data;

        // Join all user's device rooms
        devices.forEach(device => {
            joinRoom(device.id);
        });

        return () => {
            // Leave rooms when unmounting
            devices.forEach(device => {
                leaveRoom(device.id);
            });
        };
    }, [socket, devicesData?.data, joinRoom, leaveRoom]);

    // Create conversation mutation
    const createConversationMutation = useMutation({
        mutationFn: async ({ deviceId, phone, name }) => {
            const res = await api.post('/inbox/conversations', { deviceId, phone, name });
            return res.data;
        },
        onSuccess: (data) => {
            setShowNewChatModal(false);
            setNewChatPhone('');
            setNewChatName('');
            setNewChatDeviceId('');
            refetchConversations();
            if (data.data) {
                setSelectedConversation(data.data);
            }
        },
        onError: (error) => {
            alert('Error: ' + (error.response?.data?.error || error.message));
        }
    });

    // Send message mutation
    const sendMessageMutation = useMutation({
        mutationFn: async ({ conversationId, message }) => {
            const res = await api.post(`/inbox/conversations/${conversationId}/messages`, { message });
            return res.data;
        },
        onSuccess: () => {
            setMessageInput('');
            setShowSmartReply(false);
            // Immediately refetch for instant UI update
            refetchMessages();
            refetchConversations();
        },
        onError: (error) => {
            const errorMessage = error.response?.data?.error || error.message || 'Failed to send message';
            alert('Error: ' + errorMessage);
            console.error('[Inbox] Send message error:', error);
        }
    });

    // Toggle pin mutation
    const togglePinMutation = useMutation({
        mutationFn: async (conversationId) => {
            const res = await api.patch(`/inbox/conversations/${conversationId}/pin`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['inbox-conversations']);
        }
    });

    // Toggle archive mutation
    const toggleArchiveMutation = useMutation({
        mutationFn: async (conversationId) => {
            const res = await api.patch(`/inbox/conversations/${conversationId}/archive`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['inbox-conversations']);
            setSelectedConversation(null);
        }
    });

    // Delete conversation mutation
    const deleteConversationMutation = useMutation({
        mutationFn: async (conversationId) => {
            const res = await api.delete(`/inbox/conversations/${conversationId}`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['inbox-conversations']);
            setSelectedConversation(null);
        },
        onError: (error) => {
            alert('Error: ' + (error.response?.data?.error || 'Failed to delete conversation'));
        }
    });

    // Scroll to bottom of messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messagesData?.messages]);

    // Handle quick reply shortcut detection
    const handleInputChange = (e) => {
        const value = e.target.value;
        setMessageInput(value);

        // Show quick replies when typing /
        if (value.startsWith('/')) {
            setShowQuickReplies(true);
        } else {
            setShowQuickReplies(false);
        }
    };

    // Insert quick reply
    const insertQuickReply = (content) => {
        setMessageInput(content);
        setShowQuickReplies(false);
        inputRef.current?.focus();
    };

    // Use AI suggestion
    const useAiSuggestion = (suggestion) => {
        setMessageInput(suggestion);
        setShowSmartReply(false);
        inputRef.current?.focus();
    };

    // Insert from Smart Compose
    const insertFromCompose = (content) => {
        setMessageInput(content);
        setShowSmartCompose(false);
        inputRef.current?.focus();
    };

    // Insert emoji into message
    const insertEmoji = (emoji) => {
        setMessageInput(prev => prev + emoji);
        setShowEmojiPicker(false);
        inputRef.current?.focus();
    };

    // Send message
    const handleSendMessage = () => {
        if (!messageInput.trim() || !selectedConversation) return;

        sendMessageMutation.mutate({
            conversationId: selectedConversation.id,
            message: messageInput.trim()
        });
    };

    // Handle key press
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Format time
    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        }
        return date.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' });
    };

    // Get status icon
    const getStatusIcon = (status) => {
        switch (status) {
            case 'read':
                return <CheckCheck size={14} className="text-blue-500" />;
            case 'delivered':
                return <CheckCheck size={14} className="text-gray-400" />;
            case 'sent':
                return <Check size={14} className="text-gray-400" />;
            default:
                return <Clock size={14} className="text-gray-400" />;
        }
    };

    // Get context messages for AI
    const getContextMessages = () => {
        if (!messagesData?.messages) return [];
        return messagesData.messages.slice(-5).map(m => m.message);
    };

    // Filter quick replies based on input
    const filteredQuickReplies = quickReplies?.filter(qr =>
        qr.shortcut.toLowerCase().includes(messageInput.toLowerCase())
    ) || [];

    const conversations = conversationsData?.conversations || [];
    const messages = messagesData?.messages || [];

    return (
        <div className="inbox-container">
            {/* Conversation List */}
            <div className={`conversation-list ${selectedConversation ? 'hidden-mobile' : ''}`}>
                <div className="conversation-list-header">
                    <h2>
                        <MessageSquare size={24} />
                        Inbox
                        {unreadData?.unreadCount > 0 && (
                            <span className="unread-badge-header">{unreadData.unreadCount}</span>
                        )}
                    </h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            className="new-chat-btn"
                            onClick={() => setShowNewChatModal(true)}
                            title="New Chat"
                            style={{
                                background: 'var(--primary)',
                                color: 'white',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                </div>

                {/* Device Tabs */}
                {devicesData?.data && devicesData.data.length > 1 && (
                    <div className="device-tabs">
                        <button
                            className={`device-tab ${selectedDeviceId === 'all' ? 'active' : ''}`}
                            onClick={() => setSelectedDeviceId('all')}
                        >
                            All Devices
                            <span className="tab-count">{conversations.length}</span>
                        </button>
                        {devicesData.data.map(device => {
                            const deviceConvCount = conversationsData?.conversations?.filter(c => c.deviceId === device.id).length || 0;
                            return (
                                <button
                                    key={device.id}
                                    className={`device-tab ${selectedDeviceId === device.id ? 'active' : ''}`}
                                    onClick={() => setSelectedDeviceId(device.id)}
                                    title={device.name}
                                >
                                    <span className="device-tab-name">{device.name}</span>
                                    <span className="tab-count">{deviceConvCount}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="conversation-search">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="conversation-items">
                    {loadingConversations ? (
                        <div className="loading-placeholder">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="conversation-skeleton" />
                            ))}
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="empty-conversations">
                            <MessageSquare size={48} />
                            <p>No conversations yet</p>
                        </div>
                    ) : (
                        conversations.map(conv => {
                            const device = devicesData?.data?.find(d => d.id === conv.deviceId);
                            return (
                                <div
                                    key={conv.id}
                                    className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}`}
                                    onClick={() => setSelectedConversation(conv)}
                                >
                                    <div className="conversation-avatar">
                                        {conv.isGroup ? (
                                            <Users size={24} />
                                        ) : (
                                            <User size={24} />
                                        )}
                                    </div>
                                    <div className="conversation-info">
                                        <div className="conversation-top">
                                            <span className="conversation-name">
                                                {conv.isPinned && <Pin size={12} className="pin-icon" />}
                                                {conv.name || conv.pushName || conv.remoteJid?.split('@')[0] || 'Unknown'}
                                                {device && devicesData.data.length > 1 && (
                                                    <span className="device-badge">{device.name}</span>
                                                )}
                                            </span>
                                            <span className="conversation-time">{formatTime(conv.lastMessageAt)}</span>
                                        </div>
                                        <div className="conversation-bottom">
                                            <span className="conversation-preview">{conv.lastMessage || 'No messages'}</span>
                                            {conv.unreadCount > 0 && (
                                                <span className="unread-badge">{conv.unreadCount}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Chat View */}
            <div className={`chat-view ${!selectedConversation ? 'hidden-mobile' : ''}`}>
                {!selectedConversation ? (
                    <div className="no-conversation-selected">
                        <MessageSquare size={64} />
                        <h3>Pilih Percakapan</h3>
                        <p>Pilih percakapan dari daftar untuk mulai chat</p>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="chat-header">
                            <button className="back-button" onClick={() => setSelectedConversation(null)}>
                                <ArrowLeft size={20} />
                            </button>
                            <div className="chat-header-info">
                                <div className="chat-header-avatar">
                                    {selectedConversation.isGroup ? <Users size={24} /> : <User size={24} />}
                                </div>
                                <div>
                                    <h3>{selectedConversation.name || selectedConversation.pushName || selectedConversation.remoteJid?.split('@')[0] || 'Unknown'}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="chat-header-phone">
                                            <Phone size={12} />
                                            {selectedConversation.remoteJid?.split('@')[0] || 'Unknown'}
                                        </span>
                                        {(() => {
                                            const device = devicesData?.data?.find(d => d.id === selectedConversation.deviceId);
                                            return device && devicesData.data.length > 1 ? (
                                                <span className="chat-header-device">
                                                    via {device.name}
                                                </span>
                                            ) : null;
                                        })()}
                                    </div>
                                </div>
                            </div>
                            <div className="chat-header-actions">
                                {aiEnabled && (
                                    <button
                                        onClick={() => setShowSmartReply(!showSmartReply)}
                                        className={showSmartReply ? 'active ai-btn' : 'ai-btn'}
                                        title="Smart Reply (AI)"
                                    >
                                        <Sparkles size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={() => togglePinMutation.mutate(selectedConversation.id)}
                                    className={selectedConversation.isPinned ? 'active' : ''}
                                    title={selectedConversation.isPinned ? 'Unpin' : 'Pin'}
                                >
                                    <Pin size={18} />
                                </button>
                                <button
                                    onClick={() => toggleArchiveMutation.mutate(selectedConversation.id)}
                                    title={selectedConversation.isArchived ? 'Restore from Archive' : 'Archive'}
                                >
                                    {selectedConversation.isArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
                                </button>
                                <div className="chat-menu-wrapper" style={{ position: 'relative' }}>
                                    <button
                                        title="More"
                                        onClick={() => setShowChatMenu(!showChatMenu)}
                                    >
                                        <MoreVertical size={18} />
                                    </button>
                                    {showChatMenu && (
                                        <div className="chat-dropdown-menu">
                                            <button
                                                className="dropdown-item"
                                                onClick={() => {
                                                    queryClient.invalidateQueries(['inbox-messages']);
                                                    setShowChatMenu(false);
                                                }}
                                            >
                                                <RefreshCw size={16} />
                                                Refresh Messages
                                            </button>
                                            <button
                                                className="dropdown-item danger"
                                                onClick={() => {
                                                    if (confirm('Delete this conversation and all its messages?')) {
                                                        deleteConversationMutation.mutate(selectedConversation.id);
                                                    }
                                                    setShowChatMenu(false);
                                                }}
                                            >
                                                <Trash2 size={16} />
                                                Delete Conversation
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="chat-messages">
                            {loadingMessages ? (
                                <div className="loading-messages">Loading messages...</div>
                            ) : messages.length === 0 ? (
                                <div className="no-messages">
                                    <p>No messages in this conversation yet</p>
                                </div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <div
                                        key={msg.id || idx}
                                        className={`message-bubble ${msg.type === 'outgoing' ? 'outgoing' : 'incoming'}`}
                                    >
                                        <div className="message-content">
                                            {msg.message}
                                        </div>
                                        <div className="message-meta">
                                            <span className="message-time">
                                                {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {msg.type === 'outgoing' && getStatusIcon(msg.status)}
                                            {msg.type === 'incoming' && aiEnabled && (
                                                <SentimentBadge
                                                    message={msg.message}
                                                    size="small"
                                                    autoAnalyze={false}
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* AI Smart Reply */}
                        {aiEnabled && showSmartReply && lastIncomingMessage && (
                            <SmartReply
                                message={lastIncomingMessage}
                                context={getContextMessages()}
                                onSelect={useAiSuggestion}
                            />
                        )}

                        {/* Quick Replies Popup */}
                        {showQuickReplies && filteredQuickReplies.length > 0 && (
                            <div className="quick-replies-popup">
                                {filteredQuickReplies.map(qr => (
                                    <div
                                        key={qr.id}
                                        className="quick-reply-item"
                                        onClick={() => insertQuickReply(qr.content)}
                                    >
                                        <Zap size={14} />
                                        <span className="qr-shortcut">{qr.shortcut}</span>
                                        <span className="qr-content">{qr.content}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Input Area */}
                        <div className="chat-input-area">
                            {aiEnabled && (
                                <button
                                    className="ai-compose-button"
                                    title="Smart Compose (AI)"
                                    onClick={() => setShowSmartCompose(true)}
                                >
                                    <Wand2 size={20} />
                                </button>
                            )}
                            <button className="attach-button" title="Attach file">
                                <Paperclip size={20} />
                            </button>
                            <div className="input-wrapper">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder={aiEnabled ? "Type a message... (/ quick reply, ✨ AI)" : "Type a message... (use / for quick reply)"}
                                    value={messageInput}
                                    onChange={handleInputChange}
                                    onKeyPress={handleKeyPress}
                                />
                                <div className="emoji-picker-wrapper" style={{ position: 'relative' }}>
                                    <button
                                        className="emoji-button"
                                        title="Emoji"
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    >
                                        <Smile size={20} />
                                    </button>
                                    {showEmojiPicker && (
                                        <div className="emoji-picker-popup emoji-picker-large">
                                            <div className="emoji-picker-header">
                                                <span>{emojiCategories[emojiCategory]?.title || 'Select Emoji'}</span>
                                                <button onClick={() => setShowEmojiPicker(false)}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div className="emoji-category-tabs">
                                                {Object.entries(emojiCategories).map(([key, category]) => (
                                                    <button
                                                        key={key}
                                                        className={`emoji-category-btn ${emojiCategory === key ? 'active' : ''}`}
                                                        onClick={() => setEmojiCategory(key)}
                                                        title={category.title}
                                                    >
                                                        {category.name}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="emoji-grid-scrollable">
                                                {emojiCategories[emojiCategory]?.emojis.map((emoji, idx) => (
                                                    <button
                                                        key={idx}
                                                        className="emoji-item"
                                                        onClick={() => insertEmoji(emoji)}
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button
                                className="send-button"
                                onClick={handleSendMessage}
                                disabled={!messageInput.trim() || sendMessageMutation.isPending}
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Smart Compose Modal */}
            <SmartCompose
                isOpen={showSmartCompose}
                onClose={() => setShowSmartCompose(false)}
                onInsert={insertFromCompose}
                initialContext={lastIncomingMessage || ''}
            />

            {/* New Chat Modal */}
            {showNewChatModal && (
                <div className="modal-overlay open" onClick={() => setShowNewChatModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>New Conversation</h3>
                            <button className="close-btn" onClick={() => setShowNewChatModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Device</label>
                                <select
                                    value={newChatDeviceId}
                                    onChange={e => setNewChatDeviceId(e.target.value)}
                                    required
                                >
                                    <option value="">Select Device...</option>
                                    {devicesData?.data?.filter(d => d.status === 'connected').map(device => (
                                        <option key={device.id} value={device.id}>
                                            {device.name} ({device.phone || 'No phone'})
                                        </option>
                                    ))}
                                </select>
                                {devicesData?.data?.filter(d => d.status === 'connected').length === 0 && (
                                    <small style={{ color: 'var(--danger)' }}>No connected devices. Please connect a device first.</small>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Phone Number</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 081234567890"
                                    value={newChatPhone}
                                    onChange={e => setNewChatPhone(e.target.value)}
                                    required
                                />
                                <small>Enter phone number with or without country code</small>
                            </div>
                            <div className="form-group">
                                <label>Name (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Contact name"
                                    value={newChatName}
                                    onChange={e => setNewChatName(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowNewChatModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={() => {
                                    if (!newChatDeviceId || !newChatPhone) {
                                        alert('Please select device and enter phone number');
                                        return;
                                    }
                                    createConversationMutation.mutate({
                                        deviceId: newChatDeviceId,
                                        phone: newChatPhone,
                                        name: newChatName
                                    });
                                }}
                                disabled={createConversationMutation.isPending}
                            >
                                {createConversationMutation.isPending ? 'Creating...' : 'Start Chat'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contact Info Panel - Future enhancement */}
            {/* <div className="contact-info-panel">...</div> */}
        </div>
    );
};

export default Inbox;
