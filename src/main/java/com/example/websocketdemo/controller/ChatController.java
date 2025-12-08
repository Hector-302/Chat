package com.example.websocketdemo.controller;

import com.example.websocketdemo.model.ChatMessage;
import com.example.websocketdemo.service.ConversationHistoryService;
import com.example.websocketdemo.service.SessionUserRegistry;
import com.example.websocketdemo.service.UserPresenceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Arrays;
import java.util.stream.Collectors;

@Controller
public class ChatController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate; // Necesario para enviar mensajes a tópicos

    @Autowired
    private SessionUserRegistry sessionUserRegistry;

    @Autowired
    private UserPresenceService userPresenceService;

    @Autowired
    private ConversationHistoryService conversationHistoryService;

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

        // Registra al usuario y lo marca como conectado
        userPresenceService.markOnline(username);

        // Envía la lista de usuarios actualizada a todos los suscritos a /topic/users
        messagingTemplate.convertAndSend("/topic/users", userPresenceService.getUsersWithStatus());
    }

    /**
     * Se ejecuta cuando un usuario entra a la sala de chat.
     * Simplemente retransmite el mensaje de JOIN al chat público.
     */
    @MessageMapping("/chat.addUser")
    public void addUser(@Payload ChatMessage chatMessage, SimpMessageHeaderAccessor headerAccessor) {
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        chatMessage.setType(ChatMessage.MessageType.JOIN);
        messagingTemplate.convertAndSend("/topic/public", chatMessage);
    }

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload ChatMessage chatMessage) {
        chatMessage.setType(ChatMessage.MessageType.CHAT);
        messagingTemplate.convertAndSend("/topic/public", chatMessage);
    }

    @MessageMapping("/chat.private.{conversationId}")
    public void sendPrivate(@DestinationVariable String conversationId, @Payload ChatMessage chatMessage) {
        String normalizedId = buildConversationId(chatMessage.getSender(), chatMessage.getTarget());
        if (!normalizedId.isBlank()) {
            conversationId = normalizedId;
        }
        chatMessage.setConversationId(conversationId);
        chatMessage.setType(ChatMessage.MessageType.PRIVATE);
        messagingTemplate.convertAndSend("/topic/private." + conversationId, chatMessage);
        messagingTemplate.convertAndSend("/topic/private.inbox." + chatMessage.getTarget(), chatMessage);
        messagingTemplate.convertAndSend("/topic/private.inbox." + chatMessage.getSender(), chatMessage);
        conversationHistoryService.append(chatMessage);
    }

    private String buildConversationId(String sender, String target) {
        if (sender == null || target == null) {
            return "";
        }
        return Arrays.asList(sender, target)
                .stream()
                .sorted()
                .collect(Collectors.joining("-"));
    }
}