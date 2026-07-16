package io.github.halcyonsong.chat.stream.controller;


import io.github.halcyonsong.chat.stream.pojo.dto.ChatDTO;
import io.github.halcyonsong.chat.stream.pojo.dto.ChatRequestDTO;
import io.github.halcyonsong.chat.stream.pojo.vo.ChatEventVO;
import io.github.halcyonsong.chat.stream.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

@RequiredArgsConstructor
@RequestMapping("/ai/chat")
@RestController
public class ChatController {

    private final ChatService chatService;

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ChatEventVO> chat(@Valid @RequestBody ChatRequestDTO chatRequestDTO) {
        return chatService.chat(chatRequestDTO);
    }

    @PostMapping(value = "/stop")
    public void interrupt(@RequestParam("sessionId") String sessionId) {
        this.chatService.interrupt(sessionId);
    }

}
