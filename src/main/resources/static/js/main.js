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

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];

/**
 * Se ejecuta al enviar el formulario de nombre de usuario.
 * Oculta la página de login y muestra la del lobby.
 */
function login(event) {
    username = document.querySelector('#name').value.trim();

    if(username) {
        usernamePage.classList.add('hidden');
        lobbyPage.classList.remove('hidden');

        var socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);
        stompClient.connect({username: username}, onConnected, onError);
    }
    event.preventDefault();
}

/**
 * Se ejecuta al hacer clic en el botón del foro en el lobby.
 * Oculta el lobby, muestra la página de chat e inicia la conexión WebSocket.
 */
function connect(event) {
    lobbyPage.classList.add('hidden');
    chatPage.classList.remove('hidden');
    connectingElement.classList.add('hidden');

    if(stompClient) {
        stompClient.subscribe('/topic/public', onMessageReceived);
        stompClient.send("/app/chat.addUser", {}, JSON.stringify({sender: username, type: 'JOIN'}));
    }
    event.preventDefault();
}

/**
 * Se ejecuta al hacer clic en el botón "Volver al Login".
 * Oculta el lobby y muestra la página de inicio de sesión.
 */
function showLogin(event) {
    lobbyPage.classList.add('hidden');
    usernamePage.classList.remove('hidden');
    if(stompClient !== null) {
        stompClient.disconnect();
        stompClient = null;
    }
    connectedUsers.innerHTML = '';
    event.preventDefault();
}

/**
 * Se ejecuta al hacer clic en el botón "Volver al Lobby".
 * Oculta la página de chat, muestra el lobby, se desconecta del WebSocket y limpia el área de mensajes.
 */
function showLobby(event) {
    chatPage.classList.add('hidden');
    lobbyPage.classList.remove('hidden');
    if(stompClient) {
        var chatMessage = {sender: username, type: 'LEAVE'};
        stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
    }
    messageArea.innerHTML = '';
    event.preventDefault();
}


/**
 * Función callback que se ejecuta cuando la conexión con el servidor WebSocket es exitosa.
 * Se suscribe al topic de usuarios para mantener la lista actualizada.
 */
function onConnected() {
    stompClient.subscribe('/topic/users', onUsersReceived);
}


/**
 * Función callback que se ejecuta si hay un error en la conexión WebSocket.
 * Muestra un mensaje de error en la pantalla.
 */
function onError(error) {
    connectingElement.textContent = 'Could not connect to WebSocket server. Please refresh this page to try again!';
    connectingElement.style.color = 'red';
}


/**
 * Se ejecuta al enviar el formulario de mensaje en el chat.
 * Construye y envía el objeto del mensaje al servidor a través de WebSocket.
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
 * Función callback que se ejecuta cada vez que se recibe un mensaje del topic público.
 * Procesa el mensaje y lo añade al área de chat, distinguiendo entre mensajes de unión, salida o chat normal.
 */
function onMessageReceived(payload) {
    var message = JSON.parse(payload.body);

    var messageElement = document.createElement('li');

    if(message.type === 'JOIN') {
        messageElement.classList.add('event-message');
        message.content = message.sender + ' joined!';
    } else if (message.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        message.content = message.sender + ' left!';
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
 * Actualiza la lista de usuarios conectados en el lobby.
 */
function onUsersReceived(payload) {
    var users = JSON.parse(payload.body);
    connectedUsers.innerHTML = '';
    if (users.length === 0) {
        var li = document.createElement('li');
        li.textContent = 'No hay usuarios conectados';
        connectedUsers.appendChild(li);
    } else {
        users.forEach(function(user) {
            var li = document.createElement('li');
            li.textContent = user;
            connectedUsers.appendChild(li);
        });
    }
}


/**
 * Se ejecuta desde onMessageReceived para obtener un color consistente para el avatar del usuario.
 * Calcula un hash a partir del nombre de usuario para seleccionar un color del array.
 */
function getAvatarColor(messageSender) {
    var hash = 0;
    for (var i = 0; i < messageSender.length; i++) {
        hash = 31 * hash + messageSender.charCodeAt(i);
    }

    var index = Math.abs(hash % colors.length);
    return colors[index];
}

usernameForm.addEventListener('submit', login, true)
forumButton.addEventListener('click', connect, true)
backToLoginButton.addEventListener('click', showLogin, true)
backToLobbyButton.addEventListener('click', showLobby, true)
messageForm.addEventListener('submit', sendMessage, true);
