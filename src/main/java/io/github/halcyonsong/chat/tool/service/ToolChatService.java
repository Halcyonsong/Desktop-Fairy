package io.github.halcyonsong.chat.tool.service;

import io.github.halcyonsong.chat.stream.pojo.vo.ChatEventVO;
import io.github.halcyonsong.chat.tool.pojo.dto.ToolChatRequestDTO;
import reactor.core.publisher.Flux;

public interface ToolChatService {

    Flux<ChatEventVO> chat(ToolChatRequestDTO toolChatRequestDTO);
}