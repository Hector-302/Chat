package com.example.websocketdemo.service;

import com.example.websocketdemo.model.ChatMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ConversationHistoryService {

    private final Map<String, Deque<ChatMessage>> conversations = new ConcurrentHashMap<>();
    private final int maxMessagesPerConversation;

    public ConversationHistoryService(@Value("${chat.history.max-messages:50}") int maxMessagesPerConversation) {
        this.maxMessagesPerConversation = Math.max(1, maxMessagesPerConversation);
    }

    public void append(ChatMessage message) {
        if (message == null || message.getConversationId() == null || message.getConversationId().isBlank()) {
            return;
        }

        ChatMessage messageCopy = copyMessage(message);
        Deque<ChatMessage> history = conversations.computeIfAbsent(messageCopy.getConversationId(), key -> new ArrayDeque<>());

        synchronized (history) {
            if (history.size() >= maxMessagesPerConversation) {
                history.removeFirst();
            }
            history.addLast(messageCopy);
        }
    }

    public List<ChatMessage> getHistory(String conversationId) {
        if (conversationId == null || conversationId.isBlank()) {
            return List.of();
        }

        Deque<ChatMessage> history = conversations.get(conversationId);
        if (history == null) {
            return List.of();
        }

        synchronized (history) {
            return history.stream()
                    .map(this::copyMessage)
                    .collect(Collectors.toCollection(ArrayList::new));
        }
    }

    private ChatMessage copyMessage(ChatMessage original) {
        ChatMessage copy = new ChatMessage();
        copy.setType(original.getType());
        copy.setContent(original.getContent());
        copy.setSender(original.getSender());
        copy.setTarget(original.getTarget());
        copy.setConversationId(original.getConversationId());
        return copy;
    }
}
