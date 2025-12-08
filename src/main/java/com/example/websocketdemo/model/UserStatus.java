package com.example.websocketdemo.model;

public class UserStatus {
    private String username;
    private boolean online;

    public UserStatus(String username, boolean online) {
        this.username = username;
        this.online = online;
    }

    public UserStatus() {
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public boolean isOnline() {
        return online;
    }

    public void setOnline(boolean online) {
        this.online = online;
    }
}
