package io.github.halcyonsong.chat.tool.controller;

import io.github.halcyonsong.chat.stream.pojo.vo.ChatEventVO;
import io.github.halcyonsong.chat.tool.pojo.dto.ToolChatRequestDTO;
import io.github.halcyonsong.chat.tool.service.ToolChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

@RequiredArgsConstructor
@RequestMapping("/ai/tool-chat")
@RestController
public class ToolChatController {

    private final ToolChatService toolChatService;

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ChatEventVO> chat(@Valid @RequestBody ToolChatRequestDTO toolChatRequestDTO) {
        return toolChatService.chat(toolChatRequestDTO);
    }
}