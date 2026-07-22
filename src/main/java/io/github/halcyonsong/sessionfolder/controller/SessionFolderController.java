package io.github.halcyonsong.sessionfolder.controller;

import io.github.halcyonsong.common.result.Result;
import io.github.halcyonsong.sessionfolder.pojo.dto.SessionFolderAuthorizeDTO;
import io.github.halcyonsong.sessionfolder.pojo.vo.SessionFolderReferenceVO;
import io.github.halcyonsong.sessionfolder.service.SessionFolderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/session-folder")
@RequiredArgsConstructor
public class SessionFolderController {

    private final SessionFolderService sessionFolderService;

    @PostMapping("/authorize")
    public Result<SessionFolderReferenceVO> authorize(@Valid @RequestBody SessionFolderAuthorizeDTO authorizeDTO) {
        return Result.success(sessionFolderService.authorize(authorizeDTO));
    }

    @GetMapping("/list")
    public Result<List<SessionFolderReferenceVO>> listBySessionId(@RequestParam("sessionId") String sessionId) {
        return Result.success(sessionFolderService.listBySessionId(sessionId));
    }

    @DeleteMapping("/{folderReferenceId}")
    public Result<Void> deleteBySessionIdAndFolderReferenceId(@PathVariable("folderReferenceId") String folderReferenceId,
                                                              @RequestParam("sessionId") String sessionId) {
        sessionFolderService.deleteBySessionIdAndFolderReferenceId(sessionId, folderReferenceId);
        return Result.success();
    }
}