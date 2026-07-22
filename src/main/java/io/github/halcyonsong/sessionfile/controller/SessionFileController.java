package io.github.halcyonsong.sessionfile.controller;

import io.github.halcyonsong.common.result.Result;
import io.github.halcyonsong.sessionfile.pojo.dto.SessionFileAuthorizeDTO;
import io.github.halcyonsong.sessionfile.pojo.vo.SessionFileReferenceVO;
import io.github.halcyonsong.sessionfile.service.SessionFileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/session-file")
@RequiredArgsConstructor
public class SessionFileController {

    private final SessionFileService sessionFileService;

    @PostMapping("/authorize")
    public Result<SessionFileReferenceVO> authorize(@Valid @RequestBody SessionFileAuthorizeDTO authorizeDTO) {
        return Result.success(sessionFileService.authorize(authorizeDTO));
    }

    @GetMapping("/list")
    public Result<List<SessionFileReferenceVO>> listBySessionId(@RequestParam("sessionId") String sessionId) {
        return Result.success(sessionFileService.listBySessionId(sessionId));
    }

    @DeleteMapping("/{fileReferenceId}")
    public Result<Void> deleteBySessionIdAndFileReferenceId(@PathVariable("fileReferenceId") String fileReferenceId,
                                                            @RequestParam("sessionId") String sessionId) {
        sessionFileService.deleteBySessionIdAndFileReferenceId(sessionId, fileReferenceId);
        return Result.success();
    }
}