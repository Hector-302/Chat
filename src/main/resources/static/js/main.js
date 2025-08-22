'use strict';

var usernamePage = document.querySelector('#username-page');
var lobbyPage = document.querySelector('#lobby-page');
var chatPage = document.querySelector('#chat-page');
var usernameForm = document.querySelector('#usernameForm');
var messageForm = document.querySelector('#messageForm');
var messageInput = document.querySelector('#message');
var messageArea = document.querySelector('#messageArea');
var connectingElement = document.querySelector('.connecting');
var userListElement = document.querySelector('#userList');

var stompClient = null;
var username = null;

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];

function connect(event) {
    username = document.querySelector('#name').value.trim();

    if(username) {
        usernamePage.classList.add('hidden');
        // Mostramos el lobby y nos aseguramos de que el chat permanezca oculto.
        lobbyPage.classList.remove('hidden');
        chatPage.classList.add('hidden');

        var socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);

        // --- CORRECCIÓN CLAVE AQUÍ ---
        // Pasamos el username como una cabecera en la conexión.
        var headers = {
            username: username
        };
        stompClient.connect(headers, onConnected, onError); // <-- ¡Aquí está el cambio!
    }
    event.preventDefault();
}


function onConnected() {
    // Suscribirse a los topics
    stompClient.subscribe('/topic/public', onMessageReceived);
    stompClient.subscribe('/topic/users', onUsersReceived);

    // Enviar el mensaje de "JOIN" para que aparezca en el chat público
    // Esta acción es ahora solo para notificar en el chat, no para registrar al usuario.
    stompClient.send("/app/chat.addUser",
        {},
        JSON.stringify({sender: username, type: 'JOIN'})
    )

    // Ocultamos el mensaje "Connecting..." que está en la página de chat
    connectingElement.classList.add('hidden');
}


function onError(error) {
    // Escondemos el lobby y mostramos la página de login de nuevo con un error.
    lobbyPage.classList.add('hidden');
    usernamePage.classList.remove('hidden');

    // Mostramos un mensaje de error más visible para el usuario
    var errorElement = document.createElement('p');
    errorElement.textContent = 'No se pudo conectar al servidor WebSocket. Por favor, revisa tu nombre de usuario e inténtalo de nuevo.';
    errorElement.style.color = 'red';
    usernamePage.querySelector('.username-page-container').appendChild(errorElement);
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

function onUsersReceived(payload) {
    // Excluimos al usuario actual y actualizamos la lista en tiempo real
    var users = JSON.parse(payload.body).filter(function(user) {
        return user !== username;
    });

    userListElement.innerHTML = '';

    if (users.length === 0) {
        var noUsersLi = document.createElement('li');
        noUsersLi.textContent = 'No hay usuarios conectados.';
        noUsersLi.style.fontStyle = 'italic';
        noUsersLi.style.color = '#888';
        userListElement.appendChild(noUsersLi);
    } else {
        users.forEach(function(user) {
            var li = document.createElement('li');
            li.appendChild(document.createTextNode(user));

            li.addEventListener('click', function() {
                lobbyPage.classList.add('hidden');
                chatPage.classList.remove('hidden');
            });

            userListElement.appendChild(li);
        });
    }
}


function getAvatarColor(messageSender) {
    var hash = 0;
    for (var i = 0; i < messageSender.length; i++) {
        hash = 31 * hash + messageSender.charCodeAt(i);
    }

    var index = Math.abs(hash % colors.length);
    return colors[index];
}

usernameForm.addEventListener('submit', connect, true);
messageForm.addEventListener('submit', sendMessage, true);
