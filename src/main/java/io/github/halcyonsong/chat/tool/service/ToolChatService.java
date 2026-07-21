package io.github.halcyonsong.chat.tool.service;

import io.github.halcyonsong.chat.stream.pojo.dto.ChatRequestDTO;
import io.github.halcyonsong.chat.stream.pojo.vo.ChatEventVO;
import reactor.core.publisher.Flux;

public interface ToolChatService {

    Flux<ChatEventVO> chat(ChatRequestDTO chatRequestDTO);
}