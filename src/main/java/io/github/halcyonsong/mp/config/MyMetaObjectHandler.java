package io.github.halcyonsong.mp.config;

import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import org.apache.ibatis.reflection.MetaObject;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class MyMetaObjectHandler implements MetaObjectHandler {

    private static final String FIELD_CREATE_TIME = "createTime";
    private static final String FIELD_UPDATE_TIME = "updateTime";

    @Override
    public void insertFill(MetaObject metaObject) {
        this.fillStrategy(metaObject, FIELD_CREATE_TIME, LocalDateTime.now());
        this.fillStrategy(metaObject, FIELD_UPDATE_TIME, LocalDateTime.now());
    }

    @Override
    public void updateFill(MetaObject metaObject) {
        this.fillStrategy(metaObject, FIELD_UPDATE_TIME, LocalDateTime.now());
    }
}
