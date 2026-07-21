package io.github.halcyonsong.common.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ModelServiceErrorTypeEnum {

    UNAUTHORIZED("UNAUTHORIZED", "模型服务认证失败，请检查 API Key 是否有效、是否过期，或供应商鉴权配置是否正确。"),
    FORBIDDEN("FORBIDDEN", "模型服务拒绝访问，请检查当前账号或模型权限。"),
    NOT_FOUND("NOT_FOUND", "模型服务地址不可用，请检查请求地址或接口路径是否正确。"),
    RATE_LIMIT("RATE_LIMIT", "模型服务请求过于频繁，或当前额度不足，请稍后重试。"),
    INSUFFICIENT_BALANCE("INSUFFICIENT_BALANCE", "模型服务额度不足，请充值或检查当前账号配额。"),
    TIMEOUT("TIMEOUT", "模型服务响应超时，请稍后重试。"),
    CONNECTION_RESET("CONNECTION_RESET", "模型已开始返回内容，但流式连接在中途被中断。请稍后重试，或检查网络、代理及供应商服务稳定性。"),
    CONNECTION_FAILED("CONNECTION_FAILED", "无法连接到模型服务，请检查请求地址和网络连接。"),
    SERVER_ERROR("SERVER_ERROR", "模型服务暂时不可用，请稍后重试。"),
    BAD_REQUEST("BAD_REQUEST", "模型服务请求参数异常，请检查模型名称、请求体或供应商兼容格式。"),
    UNKNOWN("UNKNOWN", "模型服务调用失败，请稍后重试。");

    private final String code;
    private final String message;
}