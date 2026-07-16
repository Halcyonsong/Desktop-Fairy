package io.github.halcyonsong.chat.session.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import io.github.halcyonsong.chat.session.pojo.entity.ChatSessionEntity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ChatSessionMapper extends BaseMapper<ChatSessionEntity> {
}