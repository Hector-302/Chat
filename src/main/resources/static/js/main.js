'use strict';

var usernamePage = document.querySelector('#username-page');
var appShell = document.querySelector('#app-shell');
var appTitle = document.querySelector('#appTitle');
var lobbyPage = document.querySelector('#lobby-page');
var chatPage = document.querySelector('#chat-page');
var settingsPage = document.querySelector('#settings-page');
var usernameForm = document.querySelector('#usernameForm');
var forumButton = document.querySelector('#forumButton');
var backToLoginButton = document.querySelector('#backToLogin');
var messageForm = document.querySelector('#messageForm');
var messageInput = document.querySelector('#message');
var messageArea = document.querySelector('#messageArea');
var connectingElement = document.querySelector('.connecting');
var connectionStatusBanner = document.querySelector('#connectionStatus');
var connectedUsers = document.querySelector('#connectedUsers');
var connectedUsersSearch = document.querySelector('#connectedUsersSearch');
var openChats = document.querySelector('#openChats');
var privateChatPanel = document.querySelector('#private-chat-panel');
var privateMessageArea = document.querySelector('#privateMessageArea');
var privateMessageForm = document.querySelector('#privateMessageForm');
var privateMessageInput = document.querySelector('#privateMessage');
var privateChatHeading = document.querySelector('#privateChatHeading');
var noPrivateChat = document.querySelector('#noPrivateChat');
var navButtons = document.querySelectorAll('.nav-item[data-target]');

var STORAGE_KEY = 'chat-state';

var stompClient = null;
var username = null;
var publicChatSubscription = null;
var knownUsers = [];
var latestUsers = [];

var conversations = {};
var activeConversationId = null;

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];

var savedState = loadSavedState();
if (savedState && savedState.username) {
    document.querySelector('#name').value = savedState.username;
}

function loadSavedState() {
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn('No se pudo leer el estado guardado', e);
        return null;
    }
}

function persistState() {
    if (!username) {
        return;
    }
    try {
        var serializableConversations = {};
        Object.keys(conversations).forEach(function(id) {
            var conversation = conversations[id];
            serializableConversations[id] = {
                target: conversation.target,
                messages: conversation.messages || [],
                unreadCount: conversation.unreadCount || 0
            };
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            username: username,
            conversations: serializableConversations,
            activeConversationId: activeConversationId
        }));
    } catch (e) {
        console.warn('No se pudo guardar el estado', e);
    }
}

function showConnectionStatus(message, type) {
    if (!connectionStatusBanner) {
        return;
    }

    connectionStatusBanner.textContent = message;
    connectionStatusBanner.classList.remove('hidden', 'status-success', 'status-error', 'status-info', 'status-warning');
    if (type) {
        connectionStatusBanner.classList.add('status-' + type);
    }
}

function setConnectingFeedback(message, type) {
    if (!connectingElement) {
        return;
    }
    connectingElement.textContent = message;
    connectingElement.classList.remove('status-success', 'status-error', 'status-info', 'status-warning');
    if (type) {
        connectingElement.classList.add('status-' + type);
    }
}

function updateTitle(sectionId) {
    if (!appTitle) {
        return;
    }
    var titles = {
        'lobby-page': 'Usuarios',
        'chat-page': 'Chat Demo',
        'settings-page': 'Ajustes'
    };

    appTitle.textContent = titles[sectionId] || 'Chat Demo';
}

function showSection(sectionId) {
    [lobbyPage, chatPage, settingsPage].forEach(function(section) {
        if (!section) {
            return;
        }

        if (section.id === sectionId) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    });

    navButtons.forEach(function(button) {
        var isActive = button.dataset.target === sectionId;
        button.classList.toggle('active', isActive);
    });

    updateTitle(sectionId);
}

function restoreStateAfterLogin() {
    var state = loadSavedState();
    if (!state || state.username !== username) {
        return;
    }

    conversations = state.conversations || {};
    activeConversationId = state.activeConversationId || null;

    Object.keys(conversations).forEach(function(id) {
        var conversation = conversations[id];
        conversation.messages = conversation.messages || [];
        conversation.unreadCount = conversation.unreadCount || 0;
        subscribeToConversation(id, conversation.target);
    });

    renderOpenChats();

    if (activeConversationId && conversations[activeConversationId]) {
        setActiveConversation(activeConversationId);
    }

    refreshUserUnreadBadges();
}

function login(event) {
    username = document.querySelector('#name').value.trim();

    if(username) {
        usernamePage.classList.add('hidden');
        if (appShell) {
            appShell.classList.remove('hidden');
        }

        showSection('lobby-page');

        showConnectionStatus('Conectando...', 'info');

        connectedUsers.innerHTML = '';
        var li = document.createElement('li');
        li.textContent = 'Conectando...';
        connectedUsers.appendChild(li);

        var socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);
        stompClient.connect({}, onConnected, onError);
    }
    event.preventDefault();
}

function onConnected() {
    stompClient.subscribe('/topic/users', onUsersReceived);
    stompClient.subscribe('/topic/private.inbox.' + username, onPrivateMessageReceived);

    if (stompClient && stompClient.ws) {
        stompClient.ws.onclose = onSocketClosed;
    }

    stompClient.send("/app/chat.register",
        {},
        JSON.stringify({sender: username, type: 'JOIN'})
    );

    showConnectionStatus('Conectado como ' + username, 'success');
    setConnectingFeedback('Conectado', 'success');
    restoreStateAfterLogin();
}

function connect(event) {
    showSection('chat-page');

    publicChatSubscription = stompClient.subscribe('/topic/public', onMessageReceived);

    stompClient.send("/app/chat.addUser",
        {},
        JSON.stringify({sender: username, type: 'JOIN'})
    );
    event.preventDefault();
}

function showLogin(event) {
    showSection('lobby-page');
    usernamePage.classList.remove('hidden');
    if (appShell) {
        appShell.classList.add('hidden');
    }

    resetPrivateChats();

    if (stompClient !== null) {
        stompClient.disconnect();
        stompClient = null;
    }
    showConnectionStatus('Desconectado', 'warning');
    connectedUsers.innerHTML = '';
    event.preventDefault();
}

function showLobby(event) {
    showSection('lobby-page');

    if (publicChatSubscription) {
        publicChatSubscription.unsubscribe();
        publicChatSubscription = null;
    }
    messageArea.innerHTML = '';
    event.preventDefault();
}

function resetPrivateChats() {
    conversations = {};
    activeConversationId = null;
    openChats.innerHTML = '';
    privateMessageArea.innerHTML = '';
    privateChatPanel.classList.add('hidden');
    noPrivateChat.classList.remove('hidden');
}

function onUsersReceived(payload) {
    var users = JSON.parse(payload.body);
    latestUsers = users || [];
    knownUsers = latestUsers.map(function(user) { return user.username; });
    renderConnectedUsers();
}

function renderConnectedUsers() {
    if (!connectedUsers) {
        return;
    }

    var searchTerm = connectedUsersSearch ? connectedUsersSearch.value.trim().toLowerCase() : '';
    connectedUsers.innerHTML = '';

    var sortedUsers = latestUsers.slice().sort(function(a, b) {
        if (a.online === b.online) {
            return a.username.localeCompare(b.username);
        }
        return a.online ? -1 : 1;
    });

    var filteredUsers = sortedUsers.filter(function(user) {
        return !searchTerm || user.username.toLowerCase().indexOf(searchTerm) !== -1;
    });

    if (filteredUsers.length === 0) {
        var emptyLi = document.createElement('li');
        emptyLi.textContent = searchTerm ? 'No hay usuarios que coincidan' : 'No hay usuarios conectados';
        connectedUsers.appendChild(emptyLi);
        return;
    }

    filteredUsers.forEach(function(user) {
        var li = document.createElement('li');
        li.classList.add('user-row');
        li.dataset.username = user.username;

        var statusIndicator = document.createElement('span');
        statusIndicator.classList.add('user-status');
        statusIndicator.classList.add(user.online ? 'online' : 'offline');
        statusIndicator.title = user.online ? 'En línea' : 'Desconectado';

        var nameElement = document.createElement('span');
        nameElement.classList.add('user-name');
        nameElement.textContent = user.username;

        var stateLabel = document.createElement('span');
        stateLabel.classList.add('user-state-label');
        stateLabel.classList.add(user.online ? 'online' : 'offline');
        stateLabel.textContent = user.online ? 'En línea' : 'Desconectado';

        var unread = getUnreadCountForUser(user.username);
        var unreadBadge = null;
        if (unread > 0) {
            unreadBadge = document.createElement('span');
            unreadBadge.classList.add('unread-badge');
            unreadBadge.textContent = unread;
        }

        if (user.online && user.username !== username) {
            li.addEventListener('click', function() {
                startPrivateConversation(user.username);
            });
        }

        li.appendChild(statusIndicator);
        li.appendChild(nameElement);
        li.appendChild(stateLabel);
        if (unreadBadge) {
            li.appendChild(unreadBadge);
        }
        connectedUsers.appendChild(li);
    });
}

function onError(error) {
    console.error(error);
    setConnectingFeedback('No se pudo conectar al servidor WebSocket. Por favor, refresca la página.', 'error');
    showConnectionStatus('Error al conectar con el servidor.', 'error');
}

function onSocketClosed() {
    setConnectingFeedback('Desconectado del servidor', 'warning');
    showConnectionStatus('Sesión desconectada. Reintenta conectar.', 'warning');
}

function sendMessage(event) {
    var messageContent = messageInput.value.trim();
    if(messageContent && stompClient) {
        var chatMessage = {
            sender: username,
            content: messageInput.value,
            type: 'CHAT'
        };
        stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
        messageInput.value = '';
    }
    event.preventDefault();
}

function startPrivateConversation(targetUser) {
    if (!isValidRecipient(targetUser)) {
        return;
    }
    var conversationId = buildConversationId(username, targetUser);

    ensureConversation(conversationId, targetUser);

    subscribeToConversation(conversationId, targetUser);
    setActiveConversation(conversationId);
    renderOpenChats();
    persistState();
}

function buildConversationId(userA, userB) {
    return [userA, userB].sort().join('-');
}

function subscribeToConversation(conversationId, targetUser) {
    ensureConversation(conversationId, targetUser);
    var conversation = conversations[conversationId];

    if (!conversation.subscription && stompClient) {
        conversation.subscription = stompClient.subscribe('/topic/private.' + conversationId, function() {
            // La suscripción se usa para disparar el envío del historial desde el servidor.
            // Los mensajes en tiempo real siguen llegando por el inbox del usuario.
        });
    }
}

function setActiveConversation(conversationId) {
    activeConversationId = conversationId;
    var conversation = conversations[conversationId];
    if (!conversation) {
        return;
    }

    markConversationAsRead(conversationId);

    privateChatPanel.classList.remove('hidden');
    noPrivateChat.classList.add('hidden');
    privateChatHeading.textContent = 'Chat con ' + conversation.target;
    renderConversationMessages(conversationId);
    renderOpenChats();
    refreshUserUnreadBadges();
    persistState();
}

function renderOpenChats() {
    openChats.innerHTML = '';
    Object.keys(conversations).forEach(function(id) {
        var conversation = conversations[id];
        var li = document.createElement('li');
        var button = document.createElement('button');
        button.textContent = 'Chat con ' + conversation.target;
        if (id === activeConversationId) {
            button.classList.add('active-chat');
        }
        button.addEventListener('click', function() {
            setActiveConversation(id);
        });
        li.appendChild(button);

        var meta = document.createElement('span');
        meta.classList.add('chat-meta');
        meta.textContent = conversation.messages.length + ' msgs';
        li.appendChild(meta);

        if (conversation.unreadCount) {
            var unreadChip = document.createElement('span');
            unreadChip.classList.add('unread-badge');
            unreadChip.textContent = conversation.unreadCount + ' sin leer';
            li.appendChild(unreadChip);
        }

        openChats.appendChild(li);
    });

    if (Object.keys(conversations).length === 0) {
        noPrivateChat.classList.remove('hidden');
        privateChatPanel.classList.add('hidden');
    }
}

function renderConversationMessages(conversationId) {
    var conversation = conversations[conversationId];
    if (!conversation) {
        return;
    }

    privateMessageArea.innerHTML = '';
    conversation.messages.forEach(function(msg) {
        var row = document.createElement('div');
        row.classList.add('message-row');

        var senderSpan = document.createElement('span');
        senderSpan.classList.add('sender');
        senderSpan.textContent = msg.sender + ':';
        row.appendChild(senderSpan);

        var text = document.createElement('span');
        text.textContent = msg.content;
        row.appendChild(text);

        privateMessageArea.appendChild(row);
    });
    privateMessageArea.scrollTop = privateMessageArea.scrollHeight;
}

function renderSystemPrivateMessage(message) {
    privateMessageArea.innerHTML = '';
    var row = document.createElement('div');
    row.classList.add('message-row', 'system-row');
    var text = document.createElement('span');
    text.textContent = message.content;
    row.appendChild(text);
    privateMessageArea.appendChild(row);
    setConnectingFeedback(message.content, 'error');
    showConnectionStatus(message.content, 'error');
}

function onMessageReceived(payload) {
    var message = JSON.parse(payload.body);
    var messageElement = document.createElement('li');

    if(message.type === 'JOIN') {
        messageElement.classList.add('event-message');
        message.content = message.sender + ' se ha unido al chat!';
    } else if (message.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        message.content = message.sender + ' ha dejado el chat!';
    } else {
        messageElement.classList.add('chat-message');

        var avatarElement = document.createElement('i');
        var avatarText = document.createTextNode(message.sender[0]);
        avatarElement.appendChild(avatarText);
        avatarElement.style['background-color'] = getAvatarColor(message.sender);
        messageElement.appendChild(avatarElement);

        var usernameElement = document.createElement('span');
        var usernameText = document.createTextNode(message.sender);
        usernameElement.appendChild(usernameText);
        messageElement.appendChild(usernameElement);
    }

    var textElement = document.createElement('p');
    var messageText = document.createTextNode(message.content);
    textElement.appendChild(messageText);
    messageElement.appendChild(textElement);

    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}

function onPrivateMessageReceived(payload) {
    var message = JSON.parse(payload.body);
    var conversationId = message.conversationId || buildConversationId(message.sender, message.target);

    var targetUser = message.sender === username ? message.target : message.sender;
    if (message.type === 'PRIVATE_ERROR') {
        renderSystemPrivateMessage(message);
        return;
    }

    ensureConversation(conversationId, targetUser);
    if (!activeConversationId) {
        activeConversationId = conversationId;
    }

    var added = appendMessageIfNew(conversationId, message);

    if (added) {
        if (conversationId === activeConversationId) {
            renderConversationMessages(conversationId);
            markConversationAsRead(conversationId);
        } else if (message.sender !== username) {
            conversations[conversationId].unreadCount = (conversations[conversationId].unreadCount || 0) + 1;
        }
    }

    if (activeConversationId === conversationId) {
        setActiveConversation(conversationId);
    }

    renderOpenChats();
    refreshUserUnreadBadges();
    persistState();
}

function sendPrivateMessage(event) {
    var messageContent = privateMessageInput.value.trim();
    if (!messageContent || !stompClient || !activeConversationId) {
        event.preventDefault();
        return;
    }

    var conversation = conversations[activeConversationId];
    if (!isValidRecipient(conversation.target)) {
        event.preventDefault();
        return;
    }
    var chatMessage = {
        sender: username,
        content: messageContent,
        target: conversation.target,
        type: 'PRIVATE',
        conversationId: activeConversationId
    };

    stompClient.send('/app/chat.private.' + activeConversationId, {}, JSON.stringify(chatMessage));
    privateMessageInput.value = '';
    event.preventDefault();
}

function isValidRecipient(targetUser) {
    if (!targetUser || targetUser === username) {
        showConnectionStatus('Debes seleccionar a otro usuario para conversar.', 'error');
        return false;
    }
    if (knownUsers.indexOf(targetUser) === -1) {
        showConnectionStatus('El usuario seleccionado no existe o no está disponible.', 'error');
        return false;
    }
    return true;
}

function getAvatarColor(messageSender) {
    var hash = 0;
    for (var i = 0; i < messageSender.length; i++) {
        hash = 31 * hash + messageSender.charCodeAt(i);
    }
    var index = Math.abs(hash % colors.length);
    return colors[index];
}

function ensureConversation(conversationId, targetUser) {
    if (!conversations[conversationId]) {
        conversations[conversationId] = { target: targetUser, messages: [], unreadCount: 0 };
    }
    if (!conversations[conversationId].messages) {
        conversations[conversationId].messages = [];
    }
    if (conversations[conversationId].unreadCount === undefined) {
        conversations[conversationId].unreadCount = 0;
    }
}

function appendMessageIfNew(conversationId, message) {
    var conversation = conversations[conversationId];
    if (!conversation) {
        return false;
    }

    var createdAt = message.createdAt || Date.now();
    var exists = conversation.messages.some(function(existing) {
        return existing.sender === message.sender &&
            existing.content === message.content &&
            existing.createdAt === createdAt;
    });

    if (!exists) {
        conversation.messages.push({
            sender: message.sender,
            content: message.content,
            createdAt: createdAt
        });
        return true;
    }
    return false;
}

function markConversationAsRead(conversationId) {
    if (conversations[conversationId]) {
        conversations[conversationId].unreadCount = 0;
        persistState();
    }
}

function refreshUserUnreadBadges() {
    var userRows = connectedUsers.querySelectorAll('.user-row');
    userRows.forEach(function(row) {
        var user = row.dataset.username;
        var unread = getUnreadCountForUser(user);
        var badge = row.querySelector('.unread-badge');

        if (unread > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.classList.add('unread-badge');
                row.appendChild(badge);
            }
            badge.textContent = unread;
        } else if (badge) {
            badge.remove();
        }
    });
}

function getUnreadCountForUser(user) {
    if (!user || user === username) {
        return 0;
    }
    var id = buildConversationId(username, user);
    var conversation = conversations[id];
    return conversation && conversation.unreadCount ? conversation.unreadCount : 0;
}

usernameForm.addEventListener('submit', login, true);
forumButton.addEventListener('click', connect, true);
backToLoginButton.addEventListener('click', showLogin, true);
messageForm.addEventListener('submit', sendMessage, true);
privateMessageForm.addEventListener('submit', sendPrivateMessage, true);

navButtons.forEach(function(button) {
    button.addEventListener('click', function() {
        showSection(button.dataset.target);
    });
});

if (connectedUsersSearch) {
    connectedUsersSearch.addEventListener('input', renderConnectedUsers);
}
