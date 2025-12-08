'use strict';

var usernamePage = document.querySelector('#username-page');
var lobbyPage = document.querySelector('#lobby-page');
var chatPage = document.querySelector('#chat-page');
var usernameForm = document.querySelector('#usernameForm');
var forumButton = document.querySelector('#forumButton');
var backToLoginButton = document.querySelector('#backToLogin');
var backToLobbyButton = document.querySelector('#backToLobby');
var messageForm = document.querySelector('#messageForm');
var messageInput = document.querySelector('#message');
var messageArea = document.querySelector('#messageArea');
var connectingElement = document.querySelector('.connecting');
var connectedUsers = document.querySelector('#connectedUsers');
var openChats = document.querySelector('#openChats');
var privateChatPanel = document.querySelector('#private-chat-panel');
var privateMessageArea = document.querySelector('#privateMessageArea');
var privateMessageForm = document.querySelector('#privateMessageForm');
var privateMessageInput = document.querySelector('#privateMessage');
var privateChatHeading = document.querySelector('#privateChatHeading');
var noPrivateChat = document.querySelector('#noPrivateChat');

var stompClient = null;
var username = null;
var publicChatSubscription = null;

var conversations = {};
var activeConversationId = null;

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];

function login(event) {
    username = document.querySelector('#name').value.trim();

    if(username) {
        usernamePage.classList.add('hidden');
        lobbyPage.classList.remove('hidden');

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

    stompClient.send("/app/chat.register",
        {},
        JSON.stringify({sender: username, type: 'JOIN'})
    );
}

function connect(event) {
    lobbyPage.classList.add('hidden');
    chatPage.classList.remove('hidden');

    publicChatSubscription = stompClient.subscribe('/topic/public', onMessageReceived);

    stompClient.send("/app/chat.addUser",
        {},
        JSON.stringify({sender: username, type: 'JOIN'})
    );
    event.preventDefault();
}

function showLogin(event) {
    lobbyPage.classList.add('hidden');
    usernamePage.classList.remove('hidden');

    resetPrivateChats();

    if (stompClient !== null) {
        stompClient.disconnect();
        stompClient = null;
    }
    connectedUsers.innerHTML = '';
    event.preventDefault();
}

function showLobby(event) {
    chatPage.classList.add('hidden');
    lobbyPage.classList.remove('hidden');

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
    connectedUsers.innerHTML = '';

    if (!users || users.length === 0) {
        var li = document.createElement('li');
        li.textContent = 'No hay usuarios conectados';
        connectedUsers.appendChild(li);
    } else {
        users
            .slice()
            .sort(function(a, b) {
                if (a.online === b.online) {
                    return a.username.localeCompare(b.username);
                }
                return a.online ? -1 : 1;
            })
            .forEach(function(user) {
                var li = document.createElement('li');
                li.classList.add('user-row');

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

                if (user.online && user.username !== username) {
                    li.addEventListener('click', function() {
                        startPrivateConversation(user.username);
                    });
                }

                li.appendChild(statusIndicator);
                li.appendChild(nameElement);
                li.appendChild(stateLabel);
                connectedUsers.appendChild(li);
            });
    }
}

function onError(error) {
    console.error(error);
    connectingElement.textContent = 'No se pudo conectar al servidor WebSocket. Por favor, refresca la página.';
    connectingElement.style.color = 'red';
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
    var conversationId = buildConversationId(username, targetUser);
    if (!conversations[conversationId]) {
        conversations[conversationId] = { target: targetUser, messages: [] };
    }
    setActiveConversation(conversationId);
    renderOpenChats();
}

function buildConversationId(userA, userB) {
    return [userA, userB].sort().join('-');
}

function setActiveConversation(conversationId) {
    activeConversationId = conversationId;
    var conversation = conversations[conversationId];
    if (!conversation) {
        return;
    }

    privateChatPanel.classList.remove('hidden');
    noPrivateChat.classList.add('hidden');
    privateChatHeading.textContent = 'Chat con ' + conversation.target;
    renderConversationMessages(conversationId);
    renderOpenChats();
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

    if (!conversations[conversationId]) {
        var targetUser = message.sender === username ? message.target : message.sender;
        conversations[conversationId] = { target: targetUser, messages: [] };
        if (!activeConversationId) {
            activeConversationId = conversationId;
        }
    }

    conversations[conversationId].messages.push({
        sender: message.sender,
        content: message.content
    });

    if (conversationId === activeConversationId) {
        renderConversationMessages(conversationId);
    }

    if (activeConversationId === conversationId) {
        setActiveConversation(conversationId);
    }

    renderOpenChats();
}

function sendPrivateMessage(event) {
    var messageContent = privateMessageInput.value.trim();
    if (!messageContent || !stompClient || !activeConversationId) {
        event.preventDefault();
        return;
    }

    var conversation = conversations[activeConversationId];
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

function getAvatarColor(messageSender) {
    var hash = 0;
    for (var i = 0; i < messageSender.length; i++) {
        hash = 31 * hash + messageSender.charCodeAt(i);
    }
    var index = Math.abs(hash % colors.length);
    return colors[index];
}

usernameForm.addEventListener('submit', login, true);
forumButton.addEventListener('click', connect, true);
backToLoginButton.addEventListener('click', showLogin, true);
backToLobbyButton.addEventListener('click', showLobby, true);
messageForm.addEventListener('submit', sendMessage, true);
privateMessageForm.addEventListener('submit', sendPrivateMessage, true);
