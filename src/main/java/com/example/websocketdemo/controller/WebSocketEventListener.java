package com.example.websocketdemo.controller;

import com.example.websocketdemo.model.ChatMessage;
import com.example.websocketdemo.service.SessionUserRegistry;
import com.example.websocketdemo.service.UserPresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;


@Component
public class WebSocketEventListener {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketEventListener.class);

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private SessionUserRegistry sessionUserRegistry;

    @Autowired
    private UserPresenceService userPresenceService;

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();

        // Usamos el sessionId para eliminar al usuario y obtener su nombre
        String username = sessionUserRegistry.removeUser(sessionId);

        if (username != null) {
            boolean stillConnected = sessionUserRegistry.hasActiveSession(username);

            if (!stillConnected) {
                logger.info("User Disconnected : " + username);

                // Creamos un mensaje de LEAVE para el chat público
                ChatMessage chatMessage = new ChatMessage();
                chatMessage.setType(ChatMessage.MessageType.LEAVE);
                chatMessage.setSender(username);
                messagingTemplate.convertAndSend("/topic/public", chatMessage);

                // Marca al usuario como desconectado solo si no tiene otras sesiones
                userPresenceService.markOffline(username);
            }

            // Enviamos la lista de usuarios actualizada
            messagingTemplate.convertAndSend("/topic/users", userPresenceService.getUsersWithStatus());
        }
    }
}
