package io.github.halcyonsong.common.support;

import io.github.halcyonsong.common.enums.ModelServiceErrorTypeEnum;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class ModelServiceErrorResolver {

    public ModelServiceErrorTypeEnum resolve(Throwable throwable) {
        String rawMessage = extractThrowableMessage(throwable).toLowerCase();

        if (containsAny(rawMessage, "401", "unauthorized", "invalid api key", "authentication")) {
            return ModelServiceErrorTypeEnum.UNAUTHORIZED;
        }

        if (containsAny(rawMessage, "403", "forbidden", "permission denied")) {
            return ModelServiceErrorTypeEnum.FORBIDDEN;
        }

        if (containsAny(rawMessage, "404", "not found")) {
            return ModelServiceErrorTypeEnum.NOT_FOUND;
        }

        if (containsAny(rawMessage,
                "429",
                "too many requests",
                "rate limit",
                "quota",
                "throttl")) {
            return ModelServiceErrorTypeEnum.RATE_LIMIT;
        }

        if (containsAny(rawMessage,
                "insufficient balance",
                "balance not enough",
                "credit",
                "余额不足",
                "额度不足")) {
            return ModelServiceErrorTypeEnum.INSUFFICIENT_BALANCE;
        }

        if (containsAny(rawMessage,
                "400",
                "bad request",
                "invalid request",
                "unsupported model",
                "model_not_found",
                "context length")) {
            return ModelServiceErrorTypeEnum.BAD_REQUEST;
        }

        if (containsAny(rawMessage,
                "timed out",
                "timeout",
                "readtimeoutexception",
                "sockettimeoutexception")) {
            return ModelServiceErrorTypeEnum.TIMEOUT;
        }

        if (containsAny(rawMessage,
                "connection reset",
                "broken pipe",
                "premature close",
                "socketexception",
                "aggregation error")) {
            return ModelServiceErrorTypeEnum.CONNECTION_RESET;
        }

        if (containsAny(rawMessage,
                "connection refused",
                "connectexception",
                "unknownhost",
                "failed to connect",
                "no route to host")) {
            return ModelServiceErrorTypeEnum.CONNECTION_FAILED;
        }

        if (containsAny(rawMessage, "500", "502", "503", "504", "internal server error")) {
            return ModelServiceErrorTypeEnum.SERVER_ERROR;
        }

        return ModelServiceErrorTypeEnum.UNKNOWN;
    }

    public String resolveMessage(Throwable throwable) {
        return resolve(throwable).getMessage();
    }

    private String extractThrowableMessage(Throwable throwable) {
        StringBuilder builder = new StringBuilder();
        Throwable current = throwable;

        while (current != null) {
            if (StringUtils.hasText(current.getMessage())) {
                builder.append(current.getMessage()).append(" | ");
            }
            current = current.getCause();
        }

        return builder.toString();
    }

    private boolean containsAny(String source, String... keywords) {
        if (!StringUtils.hasText(source) || keywords == null) {
            return false;
        }

        for (String keyword : keywords) {
            if (StringUtils.hasText(keyword) && source.contains(keyword.toLowerCase())) {
                return true;
            }
        }

        return false;
    }

    public boolean isModelServiceException(Throwable throwable) {
        String rawMessage = extractThrowableMessage(throwable).toLowerCase();
        return containsAny(rawMessage,
                "webclientresponseexception",
                "chat/completions",
                "spring.ai",
                "messageaggregator",
                "defaultclientresponse",
                "openai",
                "compatible-mode");
    }

}