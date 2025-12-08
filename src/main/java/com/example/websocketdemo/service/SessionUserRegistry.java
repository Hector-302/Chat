package com.example.websocketdemo.service;

import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class SessionUserRegistry {

    private final ConcurrentMap<String, String> sessionIdToUsername = new ConcurrentHashMap<>();

    public void addUser(String sessionId, String username) {
        if (sessionId != null && username != null) {
            sessionIdToUsername.put(sessionId, username);
        }
    }

    public String removeUser(String sessionId) {
        return sessionIdToUsername.remove(sessionId);
    }

    public boolean hasActiveSession(String username) {
        return username != null && sessionIdToUsername.containsValue(username);
    }

    public Collection<String> getAllUsers() {
        return sessionIdToUsername.values();
    }
}

