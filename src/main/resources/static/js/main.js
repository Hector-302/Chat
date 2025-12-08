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

var stompClient = null;
var username = null;
var publicChatSubscription = null; // Para gestionar la suscripción al chat

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];

/**
 * Se ejecuta al enviar el formulario de nombre de usuario.
 * Inicia la conexión WebSocket.
 */
function login(event) {
    username = document.querySelector('#name').value.trim();

    if(username) {
        usernamePage.classList.add('hidden');
        lobbyPage.classList.remove('hidden');

        // Muestra un mensaje temporal de conexión en la lista de usuarios
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

/**
 * Callback que se ejecuta cuando la conexión es exitosa.
 * Se suscribe a los tópicos y se registra en el servidor.
 */
function onConnected() {
    // 1. Suscribirse al tópico de la lista de usuarios.
    stompClient.subscribe('/topic/users', onUsersReceived);

    // 2. Enviar mensaje de registro al servidor. Esto hará que el servidor
    // nos envíe la lista de usuarios completa.
    stompClient.send("/app/chat.register",
        {},
        JSON.stringify({sender: username, type: 'JOIN'})
    );
}

/**
 * Se ejecuta al hacer clic en "Entrar al foro".
 * Muestra la página de chat y se suscribe al chat público.
 */
function connect(event) {
    lobbyPage.classList.add('hidden');
    chatPage.classList.remove('hidden');

    // Suscribirse al chat público SÓLO al entrar a la sala
    publicChatSubscription = stompClient.subscribe('/topic/public', onMessageReceived);

    // Enviar un mensaje de JOIN para que los demás en el chat lo vean
    stompClient.send("/app/chat.addUser",
        {},
        JSON.stringify({sender: username, type: 'JOIN'})
    );
    event.preventDefault();
}

/**
 * Se ejecuta al hacer clic en "Volver al Login" desde el lobby.
 * Se desconecta completamente.
 */
function showLogin(event) {
    lobbyPage.classList.add('hidden');
    usernamePage.classList.remove('hidden');

    if (stompClient !== null) {
        stompClient.disconnect();
        stompClient = null;
    }
    connectedUsers.innerHTML = '';
    event.preventDefault();
}

/**
 * Se ejecuta al hacer clic en "Volver al Lobby" desde el chat.
 * Deja la sala de chat pero mantiene la conexión.
 */
function showLobby(event) {
    chatPage.classList.add('hidden');
    lobbyPage.classList.remove('hidden');

    // Anular la suscripción al chat público para no recibir más mensajes
    if (publicChatSubscription) {
        publicChatSubscription.unsubscribe();
        publicChatSubscription = null;
    }
    messageArea.innerHTML = '';
    event.preventDefault();
}

/**
 * Callback que se ejecuta al recibir la lista de usuarios.
 * Actualiza la UI del lobby.
 */
function onUsersReceived(payload) {
    var users = JSON.parse(payload.body);
    connectedUsers.innerHTML = ''; // Limpia el mensaje "Conectando..." o la lista anterior

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

                li.appendChild(statusIndicator);
                li.appendChild(nameElement);
                li.appendChild(stateLabel);
                connectedUsers.appendChild(li);
            });
    }
}


/**
 * Función callback que se ejecuta si hay un error en la conexión WebSocket.
 */
function onError(error) {
    console.error(error);
    connectingElement.textContent = 'No se pudo conectar al servidor WebSocket. Por favor, refresca la página.';
    connectingElement.style.color = 'red';
}

/**
 * Se ejecuta al enviar un mensaje de chat.
 */
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

/**
 * Callback que se ejecuta al recibir un mensaje en el chat público.
 */


 
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

/**
 * Obtiene un color para el avatar del usuario.
 */
function getAvatarColor(messageSender) {
    var hash = 0;
    for (var i = 0; i < messageSender.length; i++) {
        hash = 31 * hash + messageSender.charCodeAt(i);
    }
    var index = Math.abs(hash % colors.length);
    return colors[index];
}

// Asignación de eventos a los botones
usernameForm.addEventListener('submit', login, true)
forumButton.addEventListener('click', connect, true)
backToLoginButton.addEventListener('click', showLogin, true)
backToLobbyButton.addEventListener('click', showLobby, true)
messageForm.addEventListener('submit', sendMessage, true);