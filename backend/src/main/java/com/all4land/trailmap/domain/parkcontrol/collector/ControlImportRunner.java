package com.all4land.trailmap.domain.parkcontrol.collector;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name="park-control.import.enabled", havingValue="true")
public class ControlImportRunner implements ApplicationRunner {
    private final ControlCollector collector;
    private final ConfigurableApplicationContext context;

    public ControlImportRunner(ControlCollector collector, ConfigurableApplicationContext context) {
        this.collector = collector;
        this.context = context;
    }

    public void run(ApplicationArguments args) throws Exception {
        if (!"none".equalsIgnoreCase(context.getEnvironment().getProperty("spring.main.web-application-type")))
            throw new IllegalStateException("수집 시 spring.main.web-application-type=none으로 실행하세요");
        collector.collect();
        context.close();
    }
}
