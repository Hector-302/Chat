package com.example.websocketdemo.controller;

import com.example.websocketdemo.model.ChatMessage;
import com.example.websocketdemo.service.ServicesUserRegistry;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

/**
 * Created by rajeevkumarsingh on 24/07/17.
 */
@Controller
public class ChatController {

    private final ServicesUserRegistry userRegistry;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatController(ServicesUserRegistry userRegistry,
                          SimpMessagingTemplate messagingTemplate) {
        this.userRegistry = userRegistry;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage) {
        return chatMessage;
    }

    @MessageMapping("/chat.privateMessage")
    public void privateMessage(@Payload ChatMessage msg) {
        messagingTemplate.convertAndSendToUser(
                msg.getRecipient(), "/queue/messages", msg);
    }

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Payload ChatMessage chatMessage,
                               SimpMessageHeaderAccessor headerAccessor) {
        // Add username in web socket session
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());

        // Register user and broadcast updated list
        userRegistry.addUser(headerAccessor.getSessionId(), chatMessage.getSender());
        messagingTemplate.convertAndSend("/topic/users", userRegistry.getAllUsers());

        return chatMessage;
    }

}
