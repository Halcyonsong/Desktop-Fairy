package io.github.halcyonsong.chat.tool.tool;

import io.github.halcyonsong.sessionfolder.service.support.AuthorizedFolderReadSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.util.StringUtils;

@RequiredArgsConstructor
public class SessionFolderToolRuntimeFunctions {

    private final AuthorizedFolderReadSupport authorizedFolderReadSupport;
    private final String sessionId;

    @Tool(description = "List all authorized folders available in current session")
    public String listAuthorizedFolders() {
        return authorizedFolderReadSupport.listAuthorizedFolders(sessionId);
    }

    @Tool(description = "List entries under an authorized folder by folderReferenceId and optional relativePath")
    public String listFolderEntries(String folderReferenceId, String relativePath) {
        return authorizedFolderReadSupport.listFolderEntries(
                sessionId,
                folderReferenceId,
                StringUtils.hasText(relativePath) ? relativePath : null
        );
    }

    @Tool(description = "Search files by file name under an authorized folder by folderReferenceId")
    public String searchFilesInFolder(String folderReferenceId, String keyword, Integer maxResults) {
        return authorizedFolderReadSupport.searchFilesInFolder(
                sessionId,
                folderReferenceId,
                keyword,
                maxResults
        );
    }

    @Tool(description = "Read a text-like file under an authorized folder by folderReferenceId and relativePath")
    public String readFileInFolderAsText(String folderReferenceId, String relativePath, Integer maxChars) {
        return authorizedFolderReadSupport.readFileInFolderAsText(
                sessionId,
                folderReferenceId,
                relativePath,
                maxChars
        );
    }

    @Tool(description = "Get metadata of a file or directory under an authorized folder by folderReferenceId and relativePath")
    public String getFileMetadataInFolder(String folderReferenceId, String relativePath) {
        return authorizedFolderReadSupport.getFileMetadataInFolder(
                sessionId,
                folderReferenceId,
                relativePath
        );
    }

    @Tool(description = "Read a text-like file under an authorized folder by line range, using folderReferenceId, relativePath, startLine and maxLines")
    public String readFileLinesInFolderAsText(String folderReferenceId,
                                              String relativePath,
                                              Integer startLine,
                                              Integer maxLines) {
        return authorizedFolderReadSupport.readFileLinesInFolderAsText(
                sessionId,
                folderReferenceId,
                relativePath,
                startLine,
                maxLines
        );
    }

    @Tool(description = "Read a text-like file under an authorized folder by character segment, using folderReferenceId, relativePath, startChar and maxChars")
    public String readFileSegmentInFolderAsText(String folderReferenceId,
                                                String relativePath,
                                                Integer startChar,
                                                Integer maxChars) {
        return authorizedFolderReadSupport.readFileSegmentInFolderAsText(
                sessionId,
                folderReferenceId,
                relativePath,
                startChar,
                maxChars
        );
    }

}