package io.github.halcyonsong.chat.sum.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import io.github.halcyonsong.chat.sum.pojo.entity.ChatSummaryCursorEntity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ChatSummaryCursorMapper extends BaseMapper<ChatSummaryCursorEntity> {
}