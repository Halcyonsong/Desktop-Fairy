package io.github.halcyonsong.common.aspect;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.multipart.MultipartFile;

import java.lang.reflect.Array;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class WebLogAspect {

    private static final int MAX_LOG_LENGTH = 1000;

    private static final Set<String> SENSITIVE_FIELDS = Set.of(
            "apiKey",
            "apikey",
            "authorization",
            "Authorization",
            "accessToken",
            "refreshToken",
            "token",
            "secret",
            "password"
    );

    private final ObjectMapper objectMapper;

    @Pointcut("within(io.github.halcyonsong..controller..*)")
    public void controllerPointcut() {
    }

    @Around("controllerPointcut() && !within(io.github.halcyonsong.chat.stream.controller.ChatController)")
    public Object doAround(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();

        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();

        if (attributes == null) {
            return joinPoint.proceed();
        }

        HttpServletRequest request = attributes.getRequest();

        log.info("REQUEST uri={} method={} handler={}.{} ip={}",
                request.getRequestURI(),
                request.getMethod(),
                joinPoint.getSignature().getDeclaringTypeName(),
                joinPoint.getSignature().getName(),
                request.getRemoteAddr());

        logRequestArgs(joinPoint.getArgs());

        try {
            Object result = joinPoint.proceed();

            logResponseResult(result);
            log.info("RESPONSE uri={} cost={}ms",
                    request.getRequestURI(),
                    System.currentTimeMillis() - startTime);

            return result;
        } catch (Throwable exception) {
            log.warn("REQUEST_FAILED uri={} cost={}ms error={}",
                    request.getRequestURI(),
                    System.currentTimeMillis() - startTime,
                    exception.getClass().getSimpleName());
            throw exception;
        }
    }

    private void logRequestArgs(Object[] args) {
        List<Object> logArgs = new ArrayList<>();

        for (Object arg : args) {
            if (arg instanceof HttpServletRequest || arg instanceof HttpServletResponse) {
                continue;
            }

            if (arg instanceof MultipartFile file) {
                logArgs.add("MultipartFile(name=" + file.getOriginalFilename()
                        + ", size=" + file.getSize() + ")");
                continue;
            }

            if (arg instanceof String stringArg) {
                logArgs.add(truncate(stringArg));
                continue;
            }

            logArgs.add(sanitizeForLog(arg));
        }

        try {
            log.info("REQUEST_ARGS {}", truncate(objectMapper.writeValueAsString(logArgs)));
        } catch (Exception exception) {
            log.warn("REQUEST_ARGS [参数无法序列化为JSON]");
        }
    }

    private void logResponseResult(Object result) {
        try {
            Object sanitizedResult = sanitizeForLog(result);
            String resultJson = sanitizedResult == null ? "null" : objectMapper.writeValueAsString(sanitizedResult);
            log.info("RESPONSE_BODY {}", truncate(resultJson));
        } catch (Exception exception) {
            log.warn("RESPONSE_BODY [结果无法序列化为JSON]");
        }
    }

    private Object sanitizeForLog(Object value) {
        if (value == null) {
            return null;
        }

        if (value instanceof String
                || value instanceof Number
                || value instanceof Boolean
                || value instanceof Character
                || value.getClass().isEnum()) {
            return value;
        }

        if (value instanceof MultipartFile file) {
            return "MultipartFile(name=" + file.getOriginalFilename()
                    + ", size=" + file.getSize() + ")";
        }

        if (value instanceof HttpServletRequest || value instanceof HttpServletResponse) {
            return null;
        }

        if (value instanceof Map<?, ?> map) {
            return sanitizeMap(map);
        }

        if (value instanceof Collection<?> collection) {
            List<Object> sanitizedList = new ArrayList<>(collection.size());
            for (Object item : collection) {
                sanitizedList.add(sanitizeForLog(item));
            }
            return sanitizedList;
        }

        if (value.getClass().isArray()) {
            int length = Array.getLength(value);
            List<Object> sanitizedArray = new ArrayList<>(length);
            for (int i = 0; i < length; i++) {
                sanitizedArray.add(sanitizeForLog(Array.get(value, i)));
            }
            return sanitizedArray;
        }

        try {
            Map<String, Object> beanMap = objectMapper.convertValue(value, new TypeReference<>() {
                    }
            );
            return sanitizeMap(beanMap);
        } catch (IllegalArgumentException exception) {
            return value.getClass().getSimpleName();
        }
    }

    private Map<String, Object> sanitizeMap(Map<?, ?> source) {
        Map<String, Object> sanitized = new LinkedHashMap<>();

        for (Map.Entry<?, ?> entry : source.entrySet()) {
            String key = String.valueOf(entry.getKey());
            Object rawValue = entry.getValue();

            if (isSensitiveField(key)) {
                sanitized.put(key, maskSensitiveValue(rawValue));
                continue;
            }

            sanitized.put(key, sanitizeForLog(rawValue));
        }

        return sanitized;
    }

    private boolean isSensitiveField(String fieldName) {
        return SENSITIVE_FIELDS.contains(fieldName);
    }

    private Object maskSensitiveValue(Object rawValue) {
        if (rawValue == null) {
            return null;
        }

        String text = String.valueOf(rawValue);
        if (text.isBlank()) {
            return "****";
        }

        return mask(text);
    }

    private String mask(String text) {
        if (text.length() <= 8) {
            return "****";
        }

        String prefix = text.substring(0, 4);
        String suffix = text.substring(text.length() - 4);
        return prefix + "****" + suffix;
    }

    private String truncate(String content) {
        if (content == null) {
            return null;
        }
        if (content.length() <= MAX_LOG_LENGTH) {
            return content;
        }
        return content.substring(0, MAX_LOG_LENGTH) + "... [Truncated]";
    }
}