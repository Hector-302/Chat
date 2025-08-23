package com.example.websocketdemo.service;

import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SessionUserRegistry {

    private final ConcurrentHashMap<String, String> sessionIdToUsername = new ConcurrentHashMap<>();

    public void addUser(String sessionId, String username) {
        if (sessionId != null && username != null) {
            sessionIdToUsername.put(sessionId, username);
        }
    }

    public String removeUser(String sessionId) {
        return sessionIdToUsername.remove(sessionId);
    }

    public Collection<String> getAllUsers() {
        return sessionIdToUsername.values();
    }
}

