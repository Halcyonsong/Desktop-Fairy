package io.github.halcyonsong.chat.session.convertor;

import io.github.halcyonsong.chat.session.pojo.entity.ChatHistoryEntity;
import io.github.halcyonsong.chat.session.pojo.vo.ChatHistoryMessageVO;
import io.github.halcyonsong.common.converter.BaseConvertor;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface ChatHistoryConvertor extends BaseConvertor<ChatHistoryEntity, ChatHistoryMessageVO> {
}