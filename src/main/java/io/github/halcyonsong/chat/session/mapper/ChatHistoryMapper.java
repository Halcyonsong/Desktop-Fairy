package io.github.halcyonsong.chat.session.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import io.github.halcyonsong.chat.session.pojo.entity.ChatHistoryEntity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ChatHistoryMapper extends BaseMapper<ChatHistoryEntity> {
}