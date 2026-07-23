package io.github.halcyonsong.chat.tool.service.support.status;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionRequestState {

    // FILE / FOLDER
    private String requestType;

    private String absolutePath;

    private String reason;
}