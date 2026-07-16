package io.github.halcyonsong.chat.sum.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import io.github.halcyonsong.chat.sum.pojo.entity.ChatSummaryEntity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ChatSummaryMapper extends BaseMapper<ChatSummaryEntity> {
}