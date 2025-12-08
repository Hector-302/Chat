package com.example.websocketdemo.controller;

import com.example.websocketdemo.model.ChatMessage;
import com.example.websocketdemo.service.SessionUserRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class ChatController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate; // Necesario para enviar mensajes a tópicos

    @Autowired
    private SessionUserRegistry sessionUserRegistry;

    /**
     * Se ejecuta cuando un cliente se conecta y se registra.
     * Añade al usuario al registro y notifica a todos los clientes la nueva lista de usuarios.
     */
    @MessageMapping("/chat.register")
    public void register(@Payload ChatMessage chatMessage, SimpMessageHeaderAccessor headerAccessor) {
        // Asocia el nombre de usuario con la sesión de WebSocket
        String username = chatMessage.getSender();
        headerAccessor.getSessionAttributes().put("username", username);

        // Añade el usuario al registro
        sessionUserRegistry.addUser(headerAccessor.getSessionId(), username);

        // Envía la lista de usuarios actualizada a todos los suscritos a /topic/users
        messagingTemplate.convertAndSend("/topic/users", sessionUserRegistry.getAllUsers());
    }

    /**
     * Se ejecuta cuando un usuario entra a la sala de chat.
     * Simplemente retransmite el mensaje de JOIN al chat público.
     */
    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Payload ChatMessage chatMessage) {
        return chatMessage;
    }

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage) {
        return chatMessage;
    }
}