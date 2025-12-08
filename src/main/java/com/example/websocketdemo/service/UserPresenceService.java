package com.example.websocketdemo.service;

import com.example.websocketdemo.model.UserStatus;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class UserPresenceService {

    private final ConcurrentHashMap<String, Boolean> usersStatus = new ConcurrentHashMap<>();

    public void markOnline(String username) {
        if (username == null) {
            return;
        }
        usersStatus.put(username, true);
    }

    public void markOffline(String username) {
        if (username == null) {
            return;
        }
        usersStatus.put(username, false);
    }

    public boolean isKnownUser(String username) {
        return username != null && usersStatus.containsKey(username);
    }

    public boolean isOnline(String username) {
        return Boolean.TRUE.equals(usersStatus.get(username));
    }

    public Collection<UserStatus> getUsersWithStatus() {
        return usersStatus.entrySet()
                .stream()
                .map(entry -> new UserStatus(entry.getKey(), entry.getValue()))
                .collect(Collectors.toList());
    }
}
