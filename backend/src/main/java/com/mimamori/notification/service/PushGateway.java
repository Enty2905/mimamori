package com.mimamori.notification.service;

import java.util.Map;

public interface PushGateway {
    enum Result { ACCEPTED, RETRY, INVALID_TOKEN, UNAVAILABLE, FAILED }
    Result send(String token, String language, Map<String,String> routing);
}
