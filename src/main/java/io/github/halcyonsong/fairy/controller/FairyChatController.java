package io.github.halcyonsong.fairy.controller;

import io.github.halcyonsong.common.result.Result;
import io.github.halcyonsong.fairy.pojo.AutoChatDTO;
import io.github.halcyonsong.fairy.service.FairyChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/fairy")
public class FairyChatController {

    private final FairyChatService fairyChatService;

    @PostMapping("/chat")
    public Result<String> autoReply(AutoChatDTO autoChatDto) {
        return Result.success(fairyChatService.autoReply(autoChatDto));
    }


}
