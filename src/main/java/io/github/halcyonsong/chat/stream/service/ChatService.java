package io.github.halcyonsong.chat.stream.service;

import io.github.halcyonsong.chat.stream.pojo.dto.ChatRequestDTO;
import io.github.halcyonsong.chat.stream.pojo.vo.ChatEventVO;
import reactor.core.publisher.Flux;

public interface ChatService {

    // 流式输出对话
    Flux<ChatEventVO> chat(ChatRequestDTO chatRequestDTO);

    // 停止生成
    void interrupt(String sessionId);

}
