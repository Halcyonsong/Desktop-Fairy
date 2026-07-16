package io.github.halcyonsong.chat.sum.convertor;

import io.github.halcyonsong.chat.sum.pojo.entity.ChatSummaryEntity;
import io.github.halcyonsong.chat.sum.pojo.vo.ChatSummaryVO;
import io.github.halcyonsong.common.converter.BaseConvertor;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface ChatSummaryConvertor extends BaseConvertor<ChatSummaryEntity, ChatSummaryVO> {
}