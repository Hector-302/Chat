package com.example.websocketdemo.service;

import java.util.Collection;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.stereotype.Service;

@Service
public class UserRegistry {

    private final ConcurrentMap<String, String> sessionIdToUser = new ConcurrentHashMap<>();

    public void register(String sessionId, String username) {
        if (sessionId != null && username != null) {
            sessionIdToUser.put(sessionId, username);
        }
    }

    public void unregister(String sessionId) {
        if (sessionId != null) {
            sessionIdToUser.remove(sessionId);
        }
    }

    public String getUsername(String sessionId) {
        return sessionIdToUser.get(sessionId);
    }

    public Collection<String> getAllUsers() {
        return sessionIdToUser.values();
    }
}

