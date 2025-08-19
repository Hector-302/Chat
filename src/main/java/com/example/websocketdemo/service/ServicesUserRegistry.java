package com.example.websocketdemo.service;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ServicesUserRegistry {

    private final Map<String, String> users = new ConcurrentHashMap<>();

    public void addUser(String sessionId, String username) {
        users.put(sessionId, username);
    }

    public void removeUser(String sessionId) {
        users.remove(sessionId);
    }

    public List<String> getAllUsers() {
        return new ArrayList<>(users.values());
    }
}
