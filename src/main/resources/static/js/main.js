'use strict';

var usernamePage = document.querySelector('#username-page');
var lobbyPage = document.querySelector('#lobby-page');
var chatPage = document.querySelector('#chat-page');
var usernameForm = document.querySelector('#usernameForm');
var messageForm = document.querySelector('#messageForm');
var messageInput = document.querySelector('#message');
var messageArea = document.querySelector('#messageArea');
var userListElement = document.querySelector('#userList');
var connectingElement = document.querySelector('.connecting');

var stompClient = null;
var username = null;
var currentRecipient = null;
var conversations = {};

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];

function connect(event) {
    username = document.querySelector('#name').value.trim();

    if(username) {
        usernamePage.classList.add('hidden');
        lobbyPage.classList.remove('hidden');

        var socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);

        stompClient.connect({}, onConnected, onError);
    }
    event.preventDefault();
}


function onConnected() {
    stompClient.subscribe('/topic/users', onUserListReceived);
    stompClient.subscribe('/user/queue/messages', onPrivateMessage);

    // Tell your username to the server
    stompClient.send("/app/chat.addUser",
        {},
        JSON.stringify({sender: username, type: 'JOIN'})
    );

    connectingElement.classList.add('hidden');
}


function onError(error) {
    connectingElement.textContent = 'Could not connect to WebSocket server. Please refresh this page to try again!';
    connectingElement.style.color = 'red';
}


function sendMessage(event) {
    var messageContent = messageInput.value.trim();

    if(messageContent && stompClient && currentRecipient) {
        var chatMessage = {
            sender: username,
            content: messageInput.value,
            type: 'CHAT',
            recipient: currentRecipient
        };

        stompClient.send("/app/chat.privateMessage", {}, JSON.stringify(chatMessage));
        addMessageToConversation(currentRecipient, chatMessage);
        messageInput.value = '';
    }
    event.preventDefault();
}


function onPrivateMessage(payload) {
    var message = JSON.parse(payload.body);
    addMessageToConversation(message.sender, message);
}


function onUserListReceived(payload) {
    var users = JSON.parse(payload.body);
    userListElement.innerHTML = '';
    var others = users.filter(function(user) { return user !== username; });

    if(others.length === 0) {
        var li = document.createElement('li');
        li.textContent = 'No hay usuarios conectados';
        userListElement.appendChild(li);
    } else {
        others.forEach(function(user) {
            var li = document.createElement('li');
            li.textContent = user;
            li.addEventListener('click', function() { openChat(user); });
            userListElement.appendChild(li);
        });
    }
}


function openChat(user) {
    currentRecipient = user;
    lobbyPage.classList.add('hidden');
    chatPage.classList.remove('hidden');
    messageArea.innerHTML = '';
    var messages = conversations[user] || [];
    messages.forEach(appendMessage);
}


function addMessageToConversation(user, message) {
    if(!conversations[user]) {
        conversations[user] = [];
    }
    conversations[user].push(message);
    if(currentRecipient === user) {
        appendMessage(message);
    }
}


function appendMessage(message) {
    var messageElement = document.createElement('li');
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

    var textElement = document.createElement('p');
    var messageText = document.createTextNode(message.content);
    textElement.appendChild(messageText);
    messageElement.appendChild(textElement);

    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}


function getAvatarColor(messageSender) {
    var hash = 0;
    for (var i = 0; i < messageSender.length; i++) {
        hash = 31 * hash + messageSender.charCodeAt(i);
    }

    var index = Math.abs(hash % colors.length);
    return colors[index];
}

usernameForm.addEventListener('submit', connect, true)
messageForm.addEventListener('submit', sendMessage, true)
